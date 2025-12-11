'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';

// --- Supabase 設定 ---
const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

type Staff = { id: number; name: string; role: string; display_order: number; work_rule: 'normal'|'2week'|'4week'|'none'; };
type Shift = 'M' | 'A' | 'N';

export default function StaffRosterView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [rosterMap, setRosterMap] = useState<Record<string, Shift[]>>({});
  const [complianceErrors, setComplianceErrors] = useState<Record<number, string[]>>({});

  useEffect(() => { fetchStaff(); fetchRoster(); }, [currentDate]);

  // 1. 抓取員工 (排除主管與醫師)
  const fetchStaff = async () => {
    const { data } = await supabase.from('staff').select('*').order('display_order');
    if (data) {
      // 排除 醫師 和 主管
      const validStaff = data.filter((s: any) => s.role !== '醫師' && s.role !== '主管');
      // @ts-ignore
      setStaffList(validStaff);
    }
  };

  // 2. 抓取班表 (修正日期時區問題)
  const fetchRoster = async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    // 建立當月第一天與下個月第一天的字串
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    // 計算下個月的年月份
    const nextMonthDate = new Date(year, month, 1); // JS月份從0開始，所以month變數(1-12)剛好是下個月的index
    const endStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

    const { data } = await supabase.from('roster').select('*').gte('date', startStr).lt('date', endStr);
    
    const map: Record<string, Shift[]> = {};
    data?.forEach((r: any) => { 
      // r.date 從資料庫出來是 YYYY-MM-DD
      map[`${r.staff_id}_${r.date}`] = r.shifts; 
    });
    setRosterMap(map);
  };

  // 3. 產生日期陣列 (強制使用本地時間字串)
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysCount = new Date(year, month + 1, 0).getDate();
    
    return Array.from({ length: daysCount }, (_, i) => {
      const d = new Date(year, month, i + 1);
      // 強制格式化為 YYYY-MM-DD，避免時區導致日期跑掉
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      return { 
        dateObj: d, 
        dateStr: dateStr, // 這是關鍵，必須跟資料庫完全一致
        dayOfWeek: d.getDay() 
      };
    });
  };

  // 4. 勞基法檢核
  useEffect(() => { validateCompliance(); }, [rosterMap, staffList]);

  const validateCompliance = () => {
    const errors: Record<number, string[]> = {};
    const days = getDaysInMonth();

    staffList.forEach(staff => {
      const staffErrors: string[] = [];
      const rule = staff.work_rule || 'normal';
      if (rule === 'none') return; // 不適用

      let consecutiveDays = 0;
      let maxConsecutive = (rule === '4week') ? 12 : 6; 
      
      days.forEach(day => {
        const key = `${staff.id}_${day.dateStr}`;
        const shifts = rosterMap[key] || [];

        if (shifts.length > 0) {
          consecutiveDays++;
        } else {
          consecutiveDays = 0; 
        }

        if (consecutiveDays > maxConsecutive) {
          // 避免重複推入相同的錯誤訊息
          if (!staffErrors.includes(`連續工作超過 ${maxConsecutive} 天`)) {
            staffErrors.push(`連續工作超過 ${maxConsecutive} 天`);
          }
        }
      });
      if (staffErrors.length > 0) errors[staff.id] = staffErrors;
    });
    setComplianceErrors(errors);
  };

  // 5. 更新操作
  const updateWorkRule = async (staffId: number, rule: any) => {
    await supabase.from('staff').update({ work_rule: rule }).eq('id', staffId);
    setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, work_rule: rule } : s));
  };

  const toggleShift = async (staffId: number, dateStr: string, shift: Shift) => {
    const key = `${staffId}_${dateStr}`;
    const currentShifts = rosterMap[key] || [];
    
    // 切換邏輯：有就刪，沒有就加
    let newShifts = currentShifts.includes(shift) 
      ? currentShifts.filter(s => s !== shift) 
      : [...currentShifts, shift];
    
    // 樂觀更新 (先改畫面)
    setRosterMap(prev => ({ ...prev, [key]: newShifts }));

    // 寫入資料庫
    const { data: existing } = await supabase.from('roster').select('id').eq('staff_id', staffId).eq('date', dateStr).single();
    if (existing) {
      if (newShifts.length === 0) await supabase.from('roster').delete().eq('id', existing.id);
      else await supabase.from('roster').update({ shifts: newShifts }).eq('id', existing.id);
    } else if (newShifts.length > 0) {
      await supabase.from('roster').insert([{ staff_id: staffId, date: dateStr, shifts: newShifts }]);
    }
  };

  const days = getDaysInMonth();
  const weekDays = ['日','一','二','三','四','五','六'];

  return (
    <div className="max-w-full overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-4 animate-fade-in">
      {/* 標題與月份切換 */}
      <div className="flex justify-between mb-4 sticky left-0 min-w-[800px]">
        <div className="flex items-center gap-4 bg-slate-100 p-1 rounded-full">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-white rounded-full"><ChevronLeft size={16}/></button>
          <h2 className="text-lg font-bold min-w-[100px] text-center">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</h2>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-white rounded-full"><ChevronRight size={16}/></button>
        </div>
        <div className="flex gap-2 text-xs items-center">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-400 rounded-sm"></span>早</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded-sm"></span>午</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-purple-400 rounded-sm"></span>晚</span>
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-2 border bg-slate-50 sticky left-0 z-20 min-w-[180px] text-left text-sm text-slate-500 shadow-sm">員工 / 工時制</th>
            {days.map(d => (
              <th key={d.dateStr} className={`p-1 border text-center min-w-[40px] ${d.dayOfWeek===0||d.dayOfWeek===6?'bg-red-50 text-red-600':'bg-slate-50'}`}>
                <div className="text-xs font-bold">{d.dateObj.getDate()}</div><div className="text-[10px]">{weekDays[d.dayOfWeek]}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {staffList.map(staff => (
            <tr key={staff.id}>
              <td className="p-2 border font-bold text-slate-700 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top">
                <div className="flex justify-between items-center mb-1">
                  <div>
                    {staff.name}
                    <div className="text-[10px] text-slate-400">{staff.role}</div>
                  </div>
                  {/* 🟢 這裡補上了 'none' 不適用選項 */}
                  <select 
                    value={staff.work_rule || 'normal'}
                    onChange={(e) => updateWorkRule(staff.id, e.target.value)}
                    className="text-[10px] border rounded bg-slate-50 max-w-[80px]"
                  >
                    <option value="normal">正常</option>
                    <option value="2week">2週</option>
                    <option value="4week">4週</option>
                    <option value="none">不適用</option>
                  </select>
                </div>
                {/* 違規警告 */}
                {complianceErrors[staff.id] && (
                  <div className="mt-1 text-[10px] text-red-600 bg-red-50 p-1 rounded border border-red-100 flex items-start gap-1">
                    <ShieldAlert size={12} className="shrink-0 mt-[1px]"/>
                    <div>{complianceErrors[staff.id][0]}</div>
                  </div>
                )}
              </td>
              {days.map(d => {
                const key = `${staff.id}_${d.dateStr}`;
                const shifts = rosterMap[key] || [];
                return (
                  <td key={d.dateStr} className="border p-1 text-center align-top h-16 hover:bg-slate-50">
                    <div className="flex flex-col gap-[2px] h-full justify-center">
                      {(['M','A','N'] as Shift[]).map(s => (
                        <button key={s} onClick={() => toggleShift(staff.id, d.dateStr, s)} 
                          className={`h-2.5 w-full rounded-[2px] transition ${shifts.includes(s) ? (s==='M'?'bg-orange-400':s==='A'?'bg-blue-400':'bg-purple-400') : 'bg-slate-100 hover:bg-gray-200'}`}
                        />
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
