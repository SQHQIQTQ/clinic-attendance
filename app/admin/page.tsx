'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Download, CheckCircle, AlertCircle, RefreshCw, Edit, Trash2, X, Save, Plus, Lock, Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

// --- 設定區 ---
const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

// 🛑 雙密碼設定
const BOSS_PASSCODE = "1007";    
const MANAGER_PASSCODE = "0000"; 

// --- 型別定義 ---
type Log = { id: number; staff_name: string; clock_in_time: string; clock_out_time: string | null; work_hours: number | null; is_bypass?: boolean; };
type Staff = { id: number; name: string; role: string; display_order: number; };

export default function AdminPage() {
  const [authLevel, setAuthLevel] = useState<'none' | 'boss' | 'manager'>('none');
  const [inputPasscode, setInputPasscode] = useState('');
  const [activeTab, setActiveTab] = useState<'attendance' | 'roster'>('attendance');

  const handleLogin = () => {
    if (inputPasscode === BOSS_PASSCODE) {
      setAuthLevel('boss');
      setActiveTab('attendance'); 
    } else if (inputPasscode === MANAGER_PASSCODE) {
      setAuthLevel('manager');
      setActiveTab('roster'); 
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
          <p className="text-slate-400 text-xs mb-4">請輸入管理員或排班人員密碼</p>
          <input type="password" placeholder="Passcode" className="w-full p-3 border rounded-xl text-center text-lg tracking-widest mb-4 outline-none focus:ring-2 focus:ring-blue-500" value={inputPasscode} onChange={(e) => setInputPasscode(e.target.value)} />
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">解鎖</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-800">
      <div className="max-w-[1400px] mx-auto mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            診所管理中樞
            {authLevel === 'manager' && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">排班模式</span>}
          </h1>
        </div>
        
        <div className="flex bg-white p-1 rounded-xl border shadow-sm">
          {authLevel === 'boss' && (
            <button 
              onClick={() => setActiveTab('attendance')}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'attendance' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <CheckCircle size={16}/> 考勤紀錄
            </button>
          )}
          <button 
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'roster' ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Calendar size={16}/> 排班設定
          </button>
        </div>
      </div>

      {activeTab === 'attendance' && authLevel === 'boss' ? <AttendanceView /> : <RosterView />}
    </div>
  );
}

// --- 考勤元件 (省略部分重複代碼，保持與 V4.0 相同邏輯，僅修復排班部分) ---
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
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex gap-2 bg-white p-2 rounded-xl shadow-sm mb-4 w-fit border border-slate-200">
        <input type="month" className="px-2 font-bold bg-transparent outline-none text-slate-700" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
        <button onClick={fetchLogs} className="p-2 hover:bg-slate-100 rounded-full"><RefreshCw size={18}/></button>
        <div className="w-[1px] bg-slate-200 mx-1"></div>
        <button onClick={() => { setIsCreating(true); setEditingLog(null); setTempName(''); setTempDate(new Date().toISOString().split('T')[0]); }} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm font-bold"><Plus size={16} /> 補登</button>
        <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm font-bold"><Download size={16} /> 匯出</button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
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

// --- 排班元件 (修正員工名單讀取) ---
function RosterView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [rosterMap, setRosterMap] = useState<Record<string, string[]>>({});
  const [selectedRole, setSelectedRole] = useState<string>('all'); 
  const [availableRoles, setAvailableRoles] = useState<string[]>([]); 

  useEffect(() => {
    fetchStaff();
    fetchRoster();
  }, [currentDate]);

  const fetchStaff = async () => {
    // 🔧 這裡加了 display_order 的排序，確保顯示順序正常
    const { data } = await supabase.from('staff').select('id, name, role, display_order').order('display_order', { ascending: true });
    // @ts-ignore
    if (data) {
      setStaffList(data);
      // 🔧 自動收集所有職位，過濾掉空的
      // @ts-ignore
      const roles = Array.from(new Set(data.map(s => s.role || '未分類'))).filter(r => r);
      // @ts-ignore
      setAvailableRoles(roles);
    }
  };

  const fetchRoster = async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const { data } = await supabase.from('roster').select('*').gte('date', startStr).lt('date', endStr);
    
    const map: Record<string, string[]> = {};
    data?.forEach((r: any) => {
      map[`${r.staff_id}_${r.date}`] = Array.isArray(r.shifts) ? r.shifts : [];
    });
    setRosterMap(map);
  };

  const toggleShift = async (staffId: number, dateStr: string, shift: 'M'|'A'|'N') => {
    const key = `${staffId}_${dateStr}`;
    const currentShifts = rosterMap[key] || [];
    let newShifts = [];
    if (currentShifts.includes(shift)) newShifts = currentShifts.filter(s => s !== shift);
    else newShifts = [...currentShifts, shift];
    
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

  // 根據職位篩選，如果 role 是 null，就歸類在 "未分類"
  const filteredStaff = selectedRole === 'all' 
    ? staffList 
    : staffList.filter(s => (s.role || '未分類') === selectedRole);

  return (
    <div className="max-w-full overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-4 sticky left-0 flex-wrap gap-4">
        {/* 月份切換 */}
        <div className="flex items-center gap-4 bg-slate-100 p-1 rounded-full">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-white rounded-full transition shadow-sm"><ChevronLeft size={16}/></button>
          <h2 className="text-lg font-bold min-w-[100px] text-center">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</h2>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-white rounded-full transition shadow-sm"><ChevronRight size={16}/></button>
        </div>

        {/* 職位篩選器 */}
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400"/>
          <select 
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="p-2 border rounded-lg bg-slate-50 text-sm font-bold text-slate-700 outline-none hover:border-blue-400 transition"
          >
            <option value="all">顯示全部人員</option>
            {availableRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 text-xs">
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-100 border border-orange-400 rounded"></div>早</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-100 border border-blue-400 rounded"></div>午</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-100 border border-purple-400 rounded"></div>晚</div>
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-2 border bg-slate-50 sticky left-0 z-20 min-w-[120px] text-left text-sm text-slate-500">
              員工 ({filteredStaff.length})
            </th>
            {days.map(d => (
              <th key={d.dateStr} className={`p-1 border text-center min-w-[40px] ${d.dayOfWeek === 0 || d.dayOfWeek === 6 ? 'bg-red-50 text-red-600' : 'bg-slate-50'}`}>
                <div className="text-xs font-bold">{d.dateObj.getDate()}</div>
                <div className="text-[10px] opacity-70">{weekDays[d.dayOfWeek]}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredStaff.map(staff => (
            <tr key={staff.id}>
              <td className="p-2 border font-bold text-slate-700 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                {staff.name}
                <div className="text-[10px] font-normal text-slate-400">{staff.role || '未分類'}</div>
              </td>
              {days.map(d => {
                const key = `${staff.id}_${d.dateStr}`;
                const shifts = rosterMap[key] || [];
                return (
                  <td key={d.dateStr} className="border p-1 text-center align-top h-14 hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col gap-[2px] h-full justify-center">
                      <button onClick={() => toggleShift(staff.id, d.dateStr, 'M')} className={`h-2.5 w-full rounded-[2px] transition ${shifts.includes('M') ? 'bg-orange-400 shadow-sm' : 'bg-slate-100 hover:bg-orange-200'}`}/>
                      <button onClick={() => toggleShift(staff.id, d.dateStr, 'A')} className={`h-2.5 w-full rounded-[2px] transition ${shifts.includes('A') ? 'bg-blue-400 shadow-sm' : 'bg-slate-100 hover:bg-blue-200'}`}/>
                      <button onClick={() => toggleShift(staff.id, d.dateStr, 'N')} className={`h-2.5 w-full rounded-[2px] transition ${shifts.includes('N') ? 'bg-purple-400 shadow-sm' : 'bg-slate-100 hover:bg-purple-200'}`}/>
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
