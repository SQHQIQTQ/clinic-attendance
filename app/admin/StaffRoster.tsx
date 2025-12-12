'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';

// --- 設定區 ---
const SHIFT_CONFIG = {
  M: { label: '早', activeClass: 'bg-orange-400', hoverClass: 'hover:bg-orange-200', time: '08:00-12:30', hours: 4.5 },
  A: { label: '午', activeClass: 'bg-blue-400',   hoverClass: 'hover:bg-blue-200',   time: '15:00-18:00', hours: 3.0 },
  N: { label: '晚', activeClass: 'bg-purple-400', hoverClass: 'hover:bg-purple-200', time: '18:00-21:00', hours: 3.0 },
};

const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

type Staff = { id: number; name: string; role: string; display_order: number; work_rule: 'normal'|'2week'|'4week'|'none'; };
type Shift = 'M' | 'A' | 'N';

const GROUP_CLINIC = ['護理師', '櫃台', '診所助理'];
const GROUP_PHARMACY = ['藥師', '藥局助理'];

export default function StaffRosterView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [rosterMap, setRosterMap] = useState<Record<string, Shift[]>>({});
  const [complianceErrors, setComplianceErrors] = useState<Record<number, string[]>>({});

  useEffect(() => { fetchStaff(); fetchRoster(); }, [currentDate]);

  const fetchStaff = async () => {
    // 🔧 排序優化：先依照 role 排序，再依照 display_order 排序
    const { data } = await supabase.from('staff').select('*').order('role').order('display_order');
    if (data) {
      const validStaff = data.filter((s: any) => s.role !== '醫師' && s.role !== '主管');
      // @ts-ignore
      setStaffList(validStaff);
    }
  };

  const fetchRoster = async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonthDate = new Date(year, month, 1); 
    const endStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

    const { data } = await supabase.from('roster').select('*').gte('date', startStr).lt('date', endStr);
    const map: Record<string, Shift[]> = {};
    data?.forEach((r: any) => { 
      if (Array.isArray(r.shifts)) {
        const validShifts = r.shifts.filter((s:any) => typeof s === 'string' && ['M','A','N'].includes(s));
        map[`${r.staff_id}_${r.date}`] = validShifts;
      }
    });
    setRosterMap(map);
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysCount = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysCount }, (_, i) => {
      const d = new Date(year, month, i + 1);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      return { dateObj: d, dateStr: dateStr, dayOfWeek: d.getDay() };
    });
  };

  useEffect(() => { validateCompliance(); }, [rosterMap, staffList]);

  const validateCompliance = () => {
    const errors: Record<number, string[]> = {};
    const days = getDaysInMonth();
    staffList.forEach(staff => {
      const staffErrors: string[] = [];
      const rule = staff.work_rule || 'normal';
      if (rule === 'none') return;
      let consecutiveDays = 0;
      let maxConsecutive = (rule === '4week') ? 12 : 6; 
      days.forEach(day => {
        const key = `${staff.id}_${day.dateStr}`;
        const shifts = rosterMap[key] || [];
        if (shifts.length > 0) consecutiveDays++; else consecutiveDays = 0; 
        if (consecutiveDays > maxConsecutive) {
          if (!staffErrors.includes(`連上 > ${maxConsecutive} 天`)) staffErrors.push(`連上 > ${maxConsecutive} 天`);
        }
      });
      if (staffErrors.length > 0) errors[staff.id] = staffErrors;
    });
    setComplianceErrors(errors);
  };

  const updateWorkRule = async (staffId: number, rule: any) => {
    await supabase.from('staff').update({ work_rule: rule }).eq('id', staffId);
    setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, work_rule: rule } : s));
  };

  const toggleShift = async (staffId: number, dateStr: string, shift: Shift) => {
    const key = `${staffId}_${dateStr}`;
    const currentShifts = rosterMap[key] || [];
    let newShifts = currentShifts.includes(shift) ? currentShifts.filter(s => s !== shift) : [...currentShifts, shift];
    setRosterMap(prev => ({ ...prev, [key]: newShifts }));
    const { data: existing } = await supabase.from('roster').select('id').eq('staff_id', staffId).eq('date', dateStr).single();
    if (existing) {
      if (newShifts.length === 0) await supabase.from('roster').delete().eq('id', existing.id);
      else await supabase.from('roster').update({ shifts: newShifts }).eq('id', existing.id);
    } else if (newShifts.length > 0) {
      await supabase.from('roster').insert([{ staff_id: staffId, date: dateStr, shifts: newShifts }]);
    }
  };

  // 📊 計算單人統計數據
  const calculateStats = (staffId: number) => {
    let totalDays = 0;
    let totalHours = 0;
    const days = getDaysInMonth();
    
    days.forEach(day => {
      const key = `${staffId}_${day.dateStr}`;
      const shifts = rosterMap[key] || [];
      if (shifts.length > 0) {
        totalDays++; // 只要當天有班，天數+1
        shifts.forEach(s => {
          // @ts-ignore
          totalHours += SHIFT_CONFIG[s].hours;
        });
      }
    });
    return { totalDays, totalHours };
  };

  const days = getDaysInMonth();
  const weekDays = ['日','一','二','三','四','五','六'];

  const renderTable = (title: string, groupRoles: string[], colorClass: string) => {
    // 🔧 二次排序：先過濾出群組，再確保同職位在一起
    const groupStaff = staffList
      .filter(s => groupRoles.includes(s.role || ''))
      .sort((a, b) => a.role.localeCompare(b.role) || a.display_order - b.display_order);

    if (groupStaff.length === 0) return null;

    return (
      <div className="mb-8">
        <h3 className={`font-bold text-lg mb-2 px-2 border-l-4 ${colorClass}`}>{title}</h3>
        <div className="bg-white shadow-sm rounded-lg overflow-hidden flex">
          {/* 左側固定欄：員工資訊 */}
          <div className="min-w-[150px] border-r bg-white sticky left-0 z-20">
            <div className="h-10 border-b bg-slate-50 p-2 text-sm text-slate-500 font-bold">員工</div>
            {groupStaff.map(staff => (
              <div key={staff.id} className="h-16 border-b p-2 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-1">
                  <div>{staff.name}<div className="text-[10px] text-slate-400">{staff.role}</div></div>
                  <select value={staff.work_rule || 'normal'} onChange={(e) => updateWorkRule(staff.id, e.target.value)} className="text-[10px] border rounded bg-slate-50 max-w-[60px]">
                    <option value="normal">正常</option>
                    <option value="2week">2週</option>
                    <option value="4week">4週</option>
                    <option value="none">免</option>
                  </select>
                </div>
                {complianceErrors[staff.id] && <div className="text-[10px] text-red-600 bg-red-50 p-0.5 rounded flex items-center gap-1"><ShieldAlert size={10}/> 違規</div>}
              </div>
            ))}
          </div>

          {/* 中間滾動欄：排班表格 */}
          <div className="flex-1 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {days.map(d => (
                    <th key={d.dateStr} className={`p-1 border text-center min-w-[40px] h-10 ${d.dayOfWeek===0||d.dayOfWeek===6?'bg-red-50 text-red-600':'bg-slate-50'}`}>
                      <div className="text-xs font-bold">{d.dateObj.getDate()}</div><div className="text-[10px]">{weekDays[d.dayOfWeek]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupStaff.map(staff => (
                  <tr key={staff.id}>
                    {days.map(d => {
                      const key = `${staff.id}_${d.dateStr}`;
                      const shifts = rosterMap[key] || [];
                      return (
                        <td key={d.dateStr} className="border p-1 text-center align-top h-16 hover:bg-slate-50 min-w-[40px]">
                          <div className="flex flex-col gap-[2px] h-full justify-center">
                            {(['M','A','N'] as Shift[]).map(s => {
                              const isActive = shifts.includes(s);
                              // @ts-ignore
                              const cfg = SHIFT_CONFIG[s];
                              return <button key={s} onClick={() => toggleShift(staff.id, d.dateStr, s)} className={`h-2.5 w-full rounded-[2px] transition ${isActive ? cfg.activeClass : `bg-slate-100 ${cfg.hoverClass}`}`}/>;
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 右側固定欄：統計數據 */}
          <div className="min-w-[100px] border-l bg-slate-50 sticky right-0 z-20">
            <div className="h-10 border-b p-2 text-xs text-slate-500 font-bold text-center flex items-center justify-center">本月統計</div>
            {groupStaff.map(staff => {
              const stats = calculateStats(staff.id);
              return (
                <div key={staff.id} className="h-16 border-b p-2 flex flex-col justify-center text-center text-xs bg-white">
                  <div className="font-bold text-slate-800">{stats.totalDays} 天</div>
                  <div className="text-slate-500 font-mono">{stats.totalHours} hr</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full p-4 animate-fade-in">
      <div className="flex justify-between mb-4 items-center">
        <div className="flex items-center gap-4 bg-slate-100 p-1 rounded-full">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-white rounded-full"><ChevronLeft size={16}/></button>
          <h2 className="text-lg font-bold min-w-[100px] text-center">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</h2>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-white rounded-full"><ChevronRight size={16}/></button>
        </div>
        <div className="flex gap-2 text-xs items-center">
          {Object.entries(SHIFT_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1"><span className={`w-3 h-3 rounded-sm ${cfg.activeClass}`}></span>{cfg.label}</div>
          ))}
        </div>
      </div>

      {renderTable("🏥 診所人員 (護理/櫃台/診助)", GROUP_CLINIC, "border-blue-500 text-blue-700")}
      {renderTable("💊 藥局人員 (藥師/藥助)", GROUP_PHARMACY, "border-green-500 text-green-700")}
      {renderTable("⚠️ 其他人員", staffList.map(s=>s.role).filter(r => !GROUP_CLINIC.includes(r) && !GROUP_PHARMACY.includes(r)), "border-gray-500 text-gray-700")}
    </div>
  );
}