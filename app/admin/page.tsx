'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Download, CheckCircle, AlertCircle, RefreshCw, Edit, Trash2, X, Save, Plus, Lock, Calendar, ChevronLeft, ChevronRight, Filter, Stethoscope, Clock, ShieldAlert } from 'lucide-react';

// --- 設定區 ---
const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

const BOSS_PASSCODE = "1007";    
const MANAGER_PASSCODE = "0000"; 

// --- 型別定義 ---
type Log = { id: number; staff_name: string; clock_in_time: string; clock_out_time: string | null; work_hours: number | null; is_bypass?: boolean; };
type Staff = { id: number; name: string; role: string; display_order: number; work_rule: 'normal'|'2week'|'4week'|'none'; };
type Shift = 'M' | 'A' | 'N';
type DoctorShift = { start: string; end: string }; 

export default function AdminPage() {
  const [authLevel, setAuthLevel] = useState<'none' | 'boss' | 'manager'>('none');
  const [inputPasscode, setInputPasscode] = useState('');
  const [activeTab, setActiveTab] = useState<'attendance' | 'staff_roster' | 'doctor_roster'>('attendance');

  const handleLogin = () => {
    if (inputPasscode === BOSS_PASSCODE) {
      setAuthLevel('boss');
      setActiveTab('attendance'); 
    } else if (inputPasscode === MANAGER_PASSCODE) {
      setAuthLevel('manager');
      setActiveTab('staff_roster'); 
    } else {
      alert('密碼錯誤');
      setInputPasscode('');
    }
  };

  if (authLevel === 'none') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
          <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><Lock className="w-8 h-8 text-slate-500" /></div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">後台登入</h2>
          <input type="password" placeholder="Passcode" className="w-full p-3 border rounded-xl text-center text-lg tracking-widest mb-4 outline-none" value={inputPasscode} onChange={(e) => setInputPasscode(e.target.value)} />
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">解鎖</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 text-slate-800">
      <div className="max-w-[1600px] mx-auto mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          診所管理中樞 V6.0
          {authLevel === 'manager' && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">排班模式</span>}
        </h1>
        
        <div className="flex bg-white p-1 rounded-xl border shadow-sm overflow-x-auto">
          {authLevel === 'boss' && (
            <button onClick={() => setActiveTab('attendance')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'attendance' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
              <CheckCircle size={16}/> 考勤紀錄
            </button>
          )}
          <button onClick={() => setActiveTab('staff_roster')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'staff_roster' ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Calendar size={16}/> 員工排班
          </button>
          <button onClick={() => setActiveTab('doctor_roster')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'doctor_roster' ? 'bg-teal-100 text-teal-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Stethoscope size={16}/> 醫師排班
          </button>
        </div>
      </div>

      {activeTab === 'attendance' && authLevel === 'boss' && <AttendanceView />}
      {activeTab === 'staff_roster' && <StaffRosterView />}
      {activeTab === 'doctor_roster' && <DoctorRosterView />}
    </div>
  );
}

// --- 考勤元件 (維持不變) ---
function AttendanceView() {
  // (為了節省篇幅，這裡省略考勤代碼，請直接使用 V5.1 的 AttendanceView 內容)
  // 實作時請把 V5.1 的 AttendanceView 整段貼回來這裡
  return <div className="p-10 text-center bg-white rounded-xl">請將 V5.1 的考勤代碼貼回此處，功能完全相同</div>;
}

// ==================================================================================
// 🔥 核心功能：員工排班 (含勞基法檢核)
// ==================================================================================
function StaffRosterView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [rosterMap, setRosterMap] = useState<Record<string, Shift[]>>({});
  const [complianceErrors, setComplianceErrors] = useState<Record<number, string[]>>({}); // 違規訊息

  useEffect(() => { fetchStaff(); fetchRoster(); }, [currentDate]);

  const fetchStaff = async () => {
    const { data } = await supabase.from('staff').select('*').order('display_order');
    if (data) {
      // 排除醫師和主管，只顯示一般員工
      const validStaff = data.filter((s: any) => s.role !== '醫師' && s.role !== '主管');
      // @ts-ignore
      setStaffList(validStaff);
    }
  };

  const fetchRoster = async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const { data } = await supabase.from('roster').select('*').gte('date', startStr).lt('date', endStr);
    
    const map: Record<string, Shift[]> = {};
    data?.forEach((r: any) => { map[`${r.staff_id}_${r.date}`] = r.shifts; });
    setRosterMap(map);
  };

  // --- 勞基法檢核引擎 ---
  useEffect(() => {
    validateCompliance();
  }, [rosterMap, staffList]);

  const validateCompliance = () => {
    const errors: Record<number, string[]> = {};
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

    staffList.forEach(staff => {
      const staffErrors: string[] = [];
      const rule = staff.work_rule || 'normal';
      if (rule === 'none') return; // 不適用

      let consecutiveDays = 0;
      let maxConsecutive = (rule === '4week') ? 12 : 6; // 4週變形可連12，其他連6
      
      // 檢查整個月的每一天
      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const key = `${staff.id}_${dateStr}`;
        const shifts = rosterMap[key] || [];

        if (shifts.length > 0) {
          consecutiveDays++;
        } else {
          consecutiveDays = 0; // 有休假，重置
        }

        if (consecutiveDays > maxConsecutive) {
          staffErrors.push(`連續工作超過 ${maxConsecutive} 天 (${dateStr})`);
          break; // 找到一個就夠了
        }
      }
      if (staffErrors.length > 0) errors[staff.id] = staffErrors;
    });
    setComplianceErrors(errors);
  };

  // 切換工時規則
  const updateWorkRule = async (staffId: number, rule: any) => {
    await supabase.from('staff').update({ work_rule: rule }).eq('id', staffId);
    setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, work_rule: rule } : s));
  };

  // 切換班別
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

  const days = Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }, (_, i) => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
    return { dateObj: d, dateStr: d.toISOString().split('T')[0], dayOfWeek: d.getDay() };
  });
  const weekDays = ['日','一','二','三','四','五','六'];

  return (
    <div className="max-w-full overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-4 animate-fade-in">
      <div className="flex justify-between mb-4 sticky left-0">
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
            <th className="p-2 border bg-slate-50 sticky left-0 z-20 min-w-[150px] text-left text-sm text-slate-500">員工 / 工時制</th>
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
              <td className="p-2 border font-bold text-slate-700 sticky left-0 bg-white z-10 shadow-sm align-top">
                <div className="flex justify-between items-center">
                  <div>
                    {staff.name}
                    <div className="text-[10px] text-slate-400">{staff.role}</div>
                  </div>
                  {/* 工時規則選擇器 */}
                  <select 
                    value={staff.work_rule || 'normal'}
                    onChange={(e) => updateWorkRule(staff.id, e.target.value)}
                    className="text-[10px] border rounded bg-slate-50 max-w-[70px]"
                  >
                    <option value="normal">正常</option>
                    <option value="2week">2週</option>
                    <option value="4week">4週</option>
                  </select>
                </div>
                {/* 違規警告 */}
                {complianceErrors[staff.id] && (
                  <div className="mt-2 text-[10px] text-red-600 bg-red-50 p-1 rounded border border-red-100 flex items-start gap-1">
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

// ==================================================================================
// 🔥 核心功能：醫師排班 (30分鐘單位、重疊、多時段)
// ==================================================================================
function DoctorRosterView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [doctors, setDoctors] = useState<Staff[]>([]);
  const [rosterMap, setRosterMap] = useState<Record<string, DoctorShift[]>>({});
  
  // 編輯時段 Modal
  const [editingSlot, setEditingSlot] = useState<{staffId: number, date: string} | null>(null);
  const [tempStart, setTempStart] = useState('09:00');
  const [tempEnd, setTempEnd] = useState('12:00');

  useEffect(() => { fetchDoctors(); fetchRoster(); }, [currentDate]);

  const fetchDoctors = async () => {
    const { data } = await supabase.from('staff').select('*').eq('role', '醫師').order('display_order');
    // @ts-ignore
    if(data) setDoctors(data);
  };

  const fetchRoster = async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const { data } = await supabase.from('roster').select('*').gte('date', startStr).lt('date', endStr);
    
    const map: Record<string, DoctorShift[]> = {};
    data?.forEach((r: any) => {
      // 確保是醫師的資料 (格式是 Array Object)
      if(doctors.find(d => d.id === r.staff_id)) {
        map[`${r.staff_id}_${r.date}`] = Array.isArray(r.shifts) ? r.shifts : [];
      }
    });
    setRosterMap(map);
  };

  const addShift = async () => {
    if(!editingSlot) return;
    const key = `${editingSlot.staffId}_${editingSlot.date}`;
    const current = rosterMap[key] || [];
    const newShifts = [...current, { start: tempStart, end: tempEnd }]; // 允許重疊
    
    // 排序時段
    newShifts.sort((a, b) => a.start.localeCompare(b.start));

    setRosterMap(prev => ({ ...prev, [key]: newShifts }));

    // DB Update
    const { data: existing } = await supabase.from('roster').select('id').eq('staff_id', editingSlot.staffId).eq('date', editingSlot.date).single();
    if(existing) await supabase.from('roster').update({ shifts: newShifts }).eq('id', existing.id);
    else await supabase.from('roster').insert([{ staff_id: editingSlot.staffId, date: editingSlot.date, shifts: newShifts }]);
    
    setEditingSlot(null);
  };

  const removeShift = async (staffId: number, date: string, index: number) => {
    const key = `${staffId}_${date}`;
    const newShifts = [...(rosterMap[key] || [])];
    newShifts.splice(index, 1);
    setRosterMap(prev => ({ ...prev, [key]: newShifts }));

    const { data: existing } = await supabase.from('roster').select('id').eq('staff_id', staffId).eq('date', date).single();
    if(existing) {
      if(newShifts.length === 0) await supabase.from('roster').delete().eq('id', existing.id);
      else await supabase.from('roster').update({ shifts: newShifts }).eq('id', existing.id);
    }
  };

  const days = Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }, (_, i) => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
    return { dateObj: d, dateStr: d.toISOString().split('T')[0], dayOfWeek: d.getDay() };
  });
  const weekDays = ['日','一','二','三','四','五','六'];

  return (
    <div className="max-w-full overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-4 animate-fade-in">
      {/* 這裡也可以加上月份切換 */}
      
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-2 border bg-teal-50 sticky left-0 z-20 min-w-[100px] text-left text-sm text-teal-800">醫師</th>
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
              <td className="p-4 border font-bold text-slate-700 sticky left-0 bg-white z-10 shadow-sm">{dr.name}</td>
              {days.map(d => {
                const key = `${dr.id}_${d.dateStr}`;
                const shifts = rosterMap[key] || [];
                return (
                  <td key={d.dateStr} className="border p-2 align-top h-24 hover:bg-slate-50 min-w-[120px]">
                    <div className="flex flex-col gap-1">
                      {shifts.map((s, idx) => (
                        <div key={idx} className="bg-teal-100 text-teal-800 text-[10px] px-1 rounded flex justify-between items-center group">
                          <span>{s.start}-{s.end}</span>
                          <button onClick={() => removeShift(dr.id, d.dateStr, idx)} className="text-red-400 hover:text-red-600 hidden group-hover:block"><X size={10}/></button>
                        </div>
                      ))}
                      <button 
                        onClick={() => { setEditingSlot({ staffId: dr.id, date: d.dateStr }); setTempStart('09:00'); setTempEnd('12:00'); }}
                        className="text-[10px] text-slate-400 border border-dashed rounded hover:bg-slate-200 py-1 w-full"
                      >
                        + 班次
                      </button>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 醫師排班 Modal */}
      {editingSlot && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-64">
            <h3 className="font-bold mb-4">新增班次</h3>
            <div className="flex flex-col gap-3 mb-4">
              <div><label className="text-xs font-bold">開始</label><input type="time" value={tempStart} onChange={e=>setTempStart(e.target.value)} className="border w-full p-1 rounded"/></div>
              <div><label className="text-xs font-bold">結束</label><input type="time" value={tempEnd} onChange={e=>setTempEnd(e.target.value)} className="border w-full p-1 rounded"/></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingSlot(null)} className="flex-1 bg-gray-100 py-2 rounded text-xs">取消</button>
              <button onClick={addShift} className="flex-1 bg-teal-600 text-white py-2 rounded text-xs">新增</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
