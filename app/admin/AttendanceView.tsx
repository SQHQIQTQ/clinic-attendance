'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Download, CheckCircle, AlertCircle, RefreshCw, Edit, Trash2, X, Save, Plus } from 'lucide-react';

// --- Supabase 設定 ---
const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

type Log = { id: number; staff_name: string; clock_in_time: string; clock_out_time: string | null; work_hours: number | null; is_bypass?: boolean; };

export default function AttendanceView() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(''); 
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [tempDate, setTempDate] = useState('');
  const [tempInTime, setTempInTime] = useState('');
  const [tempOutTime, setTempOutTime] = useState('');
  const [tempName, setTempName] = useState('');

  // Client-side initialization
  useEffect(() => {
    setSelectedMonth(new Date().toISOString().slice(0, 7));
  }, []);

  const fetchLogs = async () => {
    if (!selectedMonth) return;
    const startDate = `${selectedMonth}-01T00:00:00`;
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextMonthDate = new Date(y, m, 1);
    const nextMonth = nextMonthDate.toISOString();

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
    setTempInTime(d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }));
    setTempOutTime(log.clock_out_time ? new Date(log.clock_out_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
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