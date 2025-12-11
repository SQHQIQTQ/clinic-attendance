'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Download, CheckCircle, AlertCircle, RefreshCw, Edit, Trash2, X, Save, Plus, Lock, Calendar, Stethoscope } from 'lucide-react';
import StaffRosterView from './StaffRoster';

// --- 設定區 ---
const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

const BOSS_PASSCODE = "1007";    
const MANAGER_PASSCODE = "0000"; 

// --- 型別定義 ---
type Log = { id: number; staff_name: string; clock_in_time: string; clock_out_time: string | null; work_hours: number | null; is_bypass?: boolean; };
type Staff = { id: number; name: string; role: string; display_order: number; };
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
          診所管理中樞 V6.3
          {authLevel === 'manager' && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">排班模式</span>}
        </h1>
        
        <div className="flex bg-white p-1 rounded-xl border shadow-sm overflow-x-auto">
          {authLevel === 'boss' && (
            <>
              <button onClick={() => setActiveTab('attendance')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'attendance' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                <CheckCircle size={16}/> 考勤紀錄
              </button>
              <button onClick={() => setActiveTab('staff_roster')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'staff_roster' ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Calendar size={16}/> 員工排班
              </button>
              <button onClick={() => setActiveTab('doctor_roster')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'doctor_roster' ? 'bg-teal-100 text-teal-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Stethoscope size={16}/> 醫師排班
              </button>
            </>
          )}
          
          {authLevel === 'manager' && (
            <button onClick={() => setActiveTab('staff_roster')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap bg-purple-100 text-purple-700`}>
              <Calendar size={16}/> 員工排班
            </button>
          )}
        </div>
      </div>

      {activeTab === 'attendance' && authLevel === 'boss' && <AttendanceView />}
      
      {activeTab === 'staff_roster' && <StaffRosterView />}
      
      {activeTab === 'doctor_roster' && authLevel === 'boss' && <DoctorRosterView />}
    </div>
  );
}

// 考勤元件
function AttendanceView() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [tempDate, setTempDate] = useState('');
  const [tempInTime, setTempInTime] = useState('');
  const [tempOutTime, setTempOutTime] = useState('');
  const [tempName, setTempName] = useState('');

  const fetchLogs = async () => {
    const startDate = `${selectedMonth}-01T00:00:00`;
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextMonth = new Date(y, m, 1).toISOString();
    const { data } = await supabase.from('attendance_logs').select('*').gte('clock_in_time', startDate).lt('clock_in_time', nextMonth).order('clock_in_time', { ascending: false });
    // @ts-ignore
    setLogs(data || []);
  };

  useEffect(() => { fetchLogs(); }, [selectedMonth]);

  const handleDelete = async (id: number) => {
    if (confirm('確定刪除？')) { await supabase.from('attendance_logs').delete().eq('id', id); fetchLogs(); }
  };

  const openEdit = (log: Log) => {
    setEditingLog(log);
    setTempName(log.staff_name);
    const d = new Date(log.clock_in_time);
    setTempDate(d.toISOString().split('T')[0]);
    setTempInTime(d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    setTempOutTime(log.clock_out_time ? new Date(log.clock_out_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');
  };

  const handleSave = async () => {
    if (!tempDate || !tempInTime || !tempName) return alert('請填寫完整');
    const inTime = new Date(`${tempDate}T${tempInTime}:00`);
    let outTime: Date | null = null;
    let hours = 0;
    if (tempOutTime) {
      outTime = new Date(`${tempDate}T${tempOutTime}:00`);
      if (outTime < inTime) outTime.setDate(outTime.getDate() + 1);
      hours = (outTime.getTime() - inTime.getTime()) / 3600000;
    }
    const payload = {
      staff_name: tempName, clock_in_time: inTime.toISOString(), clock_out_time: outTime?.toISOString() || null,
      work_hours: outTime ? hours : null, status: outTime ? 'completed' : 'working', is_bypass: true
    };
    if (isCreating) await supabase.from('attendance_logs').insert([payload]);
    else if (editingLog) await supabase.from('attendance_logs').update(payload).eq('id', editingLog.id);
    setEditingLog(null); setIsCreating(false); fetchLogs();
  };

  const handleExport = () => {
    let csv = '\uFEFF日期,姓名,時段,工時,狀態\n';
    logs.forEach(l => {
      const d = new Date(l.clock_in_time).toLocaleDateString();
      const t = `${new Date(l.clock_in_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${l.clock_out_time ? new Date(l.clock_out_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--'}`;
      csv += `${d},${l.staff_name},${t},${l.work_hours?.toFixed(2) || '-'},${l.clock_out_time ? '完成' : '未完成'}\n`;
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `考勤_${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex gap-2 mb-4 w-fit">
        <input type="month" className="px-2 font-bold bg-slate-50 border rounded outline-none text-slate-700" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
        <button onClick={fetchLogs} className="p-2 hover:bg-slate-100 rounded-full"><RefreshCw size={18}/></button>
        <button onClick={() => { setIsCreating(true); setEditingLog(null); setTempName(''); setTempDate(new Date().toISOString().split('T')[0]); }} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm font-bold"><Plus size={16} /> 補登</button>
        <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm font-bold"><Download size={16} /> 匯出</button>
      </div>
      <div className="overflow-x-auto max-h-[600px]">
        <table className="w-full text-left">
          <thead className="bg-slate-100 text-slate-600 text-sm sticky top-0 z-10"><tr><th className="p-4">日期</th><th className="p-4">姓名</th><th className="p-4">時段</th><th className="p-4">狀態</th><th className="p-4 text-right">操作</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50 transition">
                <td className="p-4 text-sm font-mono text-slate-600">{new Date(log.clock_in_time).toLocaleDateString()}</td>
                <td className="p-4 font-bold text-slate-800">{log.staff_name}{log.is_bypass && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1 rounded border border-red-200">補</span>}</td>
                <td className="p-4 text-sm font-mono text-slate-600">{new Date(log.clock_in_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {log.clock_out_time ? new Date(log.clock_out_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--'}</td>
                <td className="p-4">{log.clock_out_time ? <CheckCircle size={18} className="text-green-500"/> : <AlertCircle size={18} className="text-red-500 animate-pulse"/>}</td>
                <td className="p-4 text-right flex justify-end gap-2"><button onClick={() => openEdit(log)} className="p-2 hover:bg-blue-50 text-blue-500 rounded"><Edit size={16}/></button><button onClick={() => handleDelete(log.id)} className="p-2 hover:bg-red-50 text-red-500 rounded"><Trash2 size={16}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(editingLog || isCreating) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">{isCreating ? '補登' : '修改'}</h2>
            <div className="space-y-4">
              {isCreating && <div><label className="text-sm font-bold">姓名</label><input type="text" value={tempName} onChange={e => setTempName(e.target.value)} className="w-full border p-2 rounded"/></div>}
              {!isCreating && <div className="font-bold text-lg text-blue-600">{editingLog?.staff_name}</div>}
              <div><label className="text-sm font-bold">日期</label><input type="date" value={tempDate} onChange={e => setTempDate(e.target.value)} className="w-full border p-2 rounded"/></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-sm font-bold">上班</label><input type="time" value={tempInTime} onChange={e => setTempInTime(e.target.value)} className="w-full border p-2 rounded"/></div>
                <div><label className="text-sm font-bold">下班</label><input type="time" value={tempOutTime} onChange={e => setTempOutTime(e.target.value)} className="w-full border p-2 rounded"/></div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => { setEditingLog(null); setIsCreating(false); }} className="flex-1 py-3 text-slate-500 bg-slate-100 rounded-xl">取消</button>
              <button onClick={handleSave} className="flex-1 py-3 bg-blue-600 text-white rounded-xl">儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 醫師排班 (強力修復版)
function DoctorRosterView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [doctors, setDoctors] = useState<Staff[]>([]);
  const [rosterMap, setRosterMap] = useState<Record<string, DoctorShift[]>>({});
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
    const nextMonth = new Date(year, month, 1);
    const endStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

    const { data } = await supabase.from('roster').select('*').gte('date', startStr).lt('date', endStr);
    const map: Record<string, DoctorShift[]> = {};
    
    data?.forEach((r: any) => {
      // 🔧 強力過濾：只接受格式正確的物件陣列 (有 start 和 end 屬性)
      // 如果遇到以前的 "M", "A" 字串，filter 會自動過濾掉，不會崩潰
      if (Array.isArray(r.shifts)) {
        const validShifts = r.shifts.filter((s: any) => typeof s === 'object' && s.start && s.end);
        map[`${r.staff_id}_${r.date}`] = validShifts;
      }
    });
    setRosterMap(map);
  };

  const addShift = async () => {
    if(!editingSlot) return;
    const key = `${editingSlot.staffId}_${editingSlot.date}`;
    const current = rosterMap[key] || [];
    const newShifts = [...current, { start: tempStart, end: tempEnd }]; 
    newShifts.sort((a, b) => a.start.localeCompare(b.start));
    setRosterMap(prev => ({ ...prev, [key]: newShifts }));

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
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
    return { dateObj: d, dateStr: dateStr, dayOfWeek: d.getDay() };
  });
  const weekDays = ['日','一','二','三','四','五','六'];

  return (
    <div className="max-w-full overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-4 animate-fade-in">
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
