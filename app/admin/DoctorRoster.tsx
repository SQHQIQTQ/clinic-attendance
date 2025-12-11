'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft, ChevronRight, X, Plus } from 'lucide-react';

// --- Supabase 設定 ---
const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

type Staff = { id: number; name: string; role: string; display_order: number; };
type DoctorShift = { start: string; end: string }; 

export default function DoctorRosterView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [doctors, setDoctors] = useState<Staff[]>([]);
  const [rosterMap, setRosterMap] = useState<Record<string, DoctorShift[]>>({});
  
  // 編輯時段 Modal 狀態
  const [editingSlot, setEditingSlot] = useState<{staffId: number, date: string} | null>(null);
  const [tempStart, setTempStart] = useState('09:00');
  const [tempEnd, setTempEnd] = useState('12:00');
  const [isClient, setIsClient] = useState(false); // 防止 Hydration Error

  // 1. 防止伺服器/客戶端渲染不一致
  useEffect(() => { setIsClient(true); }, []);

  // 2. 初始化：先抓醫師，醫師抓到了再抓班表
  useEffect(() => { 
    fetchDoctors(); 
  }, []);

  useEffect(() => {
    if (doctors.length > 0) {
      fetchRoster();
    }
  }, [currentDate, doctors]);

  const fetchDoctors = async () => {
    // 這裡只抓角色是「醫師」的人
    const { data } = await supabase.from('staff').select('*').eq('role', '醫師').order('display_order');
    // @ts-ignore
    if(data) setDoctors(data);
  };

  const fetchRoster = async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    // 建立日期範圍 (YYYY-MM-DD)
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonthDate = new Date(year, month, 1);
    const endStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

    const { data } = await supabase.from('roster').select('*').gte('date', startStr).lt('date', endStr);
    
    const map: Record<string, DoctorShift[]> = {};
    
    data?.forEach((r: any) => {
      // 確保這筆資料是屬於「醫師」名單內的
      if(doctors.find(d => d.id === r.staff_id)) {
        // 🔧 強力防呆：如果 shifts 不是陣列，或者是舊的字串格式，自動忽略
        if (Array.isArray(r.shifts)) {
          const validShifts = r.shifts.filter((s: any) => 
            // 必須是物件 且 有 start 和 end 屬性
            typeof s === 'object' && s !== null && 'start' in s && 'end' in s
          );
          map[`${r.staff_id}_${r.date}`] = validShifts;
        } else {
          map[`${r.staff_id}_${r.date}`] = [];
        }
      }
    });
    setRosterMap(map);
  };

  const addShift = async () => {
    if(!editingSlot) return;
    const key = `${editingSlot.staffId}_${editingSlot.date}`;
    const current = rosterMap[key] || [];
    const newShifts = [...current, { start: tempStart, end: tempEnd }]; 
    
    // 簡單排序：照開始時間排
    newShifts.sort((a, b) => a.start.localeCompare(b.start));

    // 樂觀更新
    setRosterMap(prev => ({ ...prev, [key]: newShifts }));

    // 寫入資料庫
    const { data: existing } = await supabase.from('roster').select('id').eq('staff_id', editingSlot.staffId).eq('date', editingSlot.date).single();
    if(existing) await supabase.from('roster').update({ shifts: newShifts }).eq('id', existing.id);
    else await supabase.from('roster').insert([{ staff_id: editingSlot.staffId, date: editingSlot.date, shifts: newShifts }]);
    
    setEditingSlot(null);
  };

  const removeShift = async (staffId: number, date: string, index: number) => {
    const key = `${staffId}_${date}`;
    const newShifts = [...(rosterMap[key] || [])];
    newShifts.splice(index, 1); // 移除指定索引
    
    setRosterMap(prev => ({ ...prev, [key]: newShifts }));

    const { data: existing } = await supabase.from('roster').select('id').eq('staff_id', staffId).eq('date', date).single();
    if(existing) {
      if(newShifts.length === 0) await supabase.from('roster').delete().eq('id', existing.id);
      else await supabase.from('roster').update({ shifts: newShifts }).eq('id', existing.id);
    }
  };

  // 產生當月日期 (安全版)
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

  // 如果還在 Client 載入中，回傳空以免報錯
  if (!isClient) return null;

  const days = getDaysInMonth();
  const weekDays = ['日','一','二','三','四','五','六'];

  return (
    <div className="max-w-full overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-4 animate-fade-in">
      {/* 月份切換 */}
      <div className="flex justify-between mb-4 sticky left-0 min-w-[800px]">
        <div className="flex items-center gap-4 bg-slate-100 p-1 rounded-full">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-white rounded-full"><ChevronLeft size={16}/></button>
          <h2 className="text-lg font-bold min-w-[100px] text-center">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</h2>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-white rounded-full"><ChevronRight size={16}/></button>
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-2 border bg-teal-50 sticky left-0 z-20 min-w-[100px] text-left text-sm text-teal-800 shadow-sm">醫師</th>
            {days.map(d => (
              <th key={d.dateStr} className={`p-1 border text-center min-w-[100px] ${d.dayOfWeek===0||d.dayOfWeek===6?'bg-red-50 text-red-600':'bg-slate-50'}`}>
                <div className="text-xs font-bold">{d.dateObj.getDate()} ({weekDays[d.dayOfWeek]})</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {doctors.map(dr => (
            <tr key={dr.id}>
              <td className="p-4 border font-bold text-slate-700 sticky left-0 bg-white z-10 shadow-sm align-top">{dr.name}</td>
              {days.map(d => {
                const key = `${dr.id}_${d.dateStr}`;
                const shifts = rosterMap[key] || [];
                return (
                  <td key={d.dateStr} className="border p-1 align-top h-24 hover:bg-slate-50 min-w-[120px]">
                    <div className="flex flex-col gap-1">
                      {shifts.map((s, idx) => (
                        <div key={idx} className="bg-teal-100 text-teal-900 text-[11px] px-2 py-1 rounded shadow-sm flex justify-between items-center group border border-teal-200">
                          <span className="font-mono">{s.start}-{s.end}</span>
                          <button onClick={() => removeShift(dr.id, d.dateStr, idx)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"><X size={12}/></button>
                        </div>
                      ))}
                      <button 
                        onClick={() => { setEditingSlot({ staffId: dr.id, date: d.dateStr }); setTempStart('09:00'); setTempEnd('12:00'); }}
                        className="text-[10px] text-slate-400 border border-dashed rounded hover:bg-slate-200 py-1 w-full flex items-center justify-center gap-1"
                      >
                        <Plus size={10}/> 班次
                      </button>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {doctors.length === 0 && (
        <div className="text-center p-8 text-slate-400">
          尚無醫師資料，請確認資料庫 staff 表格的 role 欄位已填寫為「醫師」。
        </div>
      )}

      {/* 編輯 Modal */}
      {editingSlot && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-xl w-72 animate-fade-in">
            <h3 className="font-bold mb-4 text-slate-800">新增醫師班次</h3>
            <div className="flex flex-col gap-3 mb-6">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">開始時間</label>
                <input type="time" value={tempStart} onChange={e=>setTempStart(e.target.value)} className="border w-full p-2 rounded bg-slate-50 outline-none focus:border-teal-500"/>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">結束時間</label>
                <input type="time" value={tempEnd} onChange={e=>setTempEnd(e.target.value)} className="border w-full p-2 rounded bg-slate-50 outline-none focus:border-teal-500"/>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingSlot(null)} className="flex-1 bg-slate-100 py-2 rounded text-sm font-bold text-slate-600 hover:bg-slate-200">取消</button>
              <button onClick={addShift} className="flex-1 bg-teal-600 text-white py-2 rounded text-sm font-bold hover:bg-teal-700">確認新增</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
