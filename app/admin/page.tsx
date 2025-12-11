'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Download, CheckCircle, AlertCircle, RefreshCw, Edit, Trash2, X, Save, Plus, Lock, Key } from 'lucide-react';

// --- 設定區 ---
const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

// 🛑 設定你的後台密碼
const ADMIN_PASSCODE = "1007"; 

type Log = {
  id: number;
  staff_name: string;
  clock_in_time: string;
  clock_out_time: string | null;
  work_hours: number | null;
  gps_lat?: number;
  gps_lng?: number;
  is_bypass?: boolean;
};

type DailyReport = {
  date: string;
  weekday: string;
  staff_name: string;
  total_hours: number;
  regular_hours: number;
  ot1_hours: number;
  ot2_hours: number;
  status: string;
};

export default function AdminPage() {
  // --- 權限狀態 ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputPasscode, setInputPasscode] = useState('');
  
  // --- 資料狀態 ---
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  // --- 編輯狀態 ---
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [tempDate, setTempDate] = useState('');
  const [tempInTime, setTempInTime] = useState('');
  const [tempOutTime, setTempOutTime] = useState('');
  const [tempName, setTempName] = useState('');

  // 1. 驗證密碼
  const handleLogin = () => {
    if (inputPasscode === ADMIN_PASSCODE) {
      setIsAuthenticated(true);
      // 登入成功後才去抓資料
      setTimeout(() => fetchLogs(), 100); 
    } else {
      alert('密碼錯誤');
      setInputPasscode('');
    }
  };

  // 2. 抓取資料
  const fetchLogs = async () => {
    setLoading(true);
    const startDate = `${selectedMonth}-01T00:00:00`;
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextMonth = new Date(y, m, 1).toISOString();

    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .gte('clock_in_time', startDate)
      .lt('clock_in_time', nextMonth)
      .order('clock_in_time', { ascending: false });

    if (error) alert('讀取失敗: ' + error.message);
    // @ts-ignore
    else setLogs(data || []);
    setLoading(false);
  };

  // 只有在登入狀態且月份改變時才重抓
  useEffect(() => { 
    if(isAuthenticated) fetchLogs(); 
  }, [selectedMonth]);

  // 3. 匯出邏輯 (勞基法)
  const calculateDailyStats = (): DailyReport[] => {
    const dailyMap: Record<string, number> = {}; 
    const statusMap: Record<string, string> = {}; 

    logs.forEach(log => {
      const date = new Date(log.clock_in_time).toISOString().split('T')[0];
      const key = `${date}_${log.staff_name}`;
      const hours = log.work_hours ? parseFloat(log.work_hours.toString()) : 0;
      dailyMap[key] = (dailyMap[key] || 0) + hours;
      if (!log.clock_out_time) statusMap[key] = '異常(未打卡)';
    });

    const reports: DailyReport[] = [];
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    Object.keys(dailyMap).sort().forEach(key => {
      const [date, staff_name] = key.split('_');
      const total = dailyMap[key];
      const dayIndex = new Date(date).getDay();

      let regular = 0, ot1 = 0, ot2 = 0;
      if (total <= 8) {
        regular = total;
      } else if (total <= 10) {
        regular = 8; ot1 = total - 8;
      } else {
        regular = 8; ot1 = 2; ot2 = total - 10;
      }

      reports.push({
        date,
        weekday: weekDays[dayIndex],
        staff_name,
        total_hours: total,
        regular_hours: regular,
        ot1_hours: ot1,
        ot2_hours: ot2,
        status: statusMap[key] || '正常'
      });
    });
    return reports;
  };

  const handleExport = () => {
    if (logs.length === 0) return alert('無資料');
    const reports = calculateDailyStats();
    let csvContent = '\uFEFF'; 
    csvContent += '日期,星期,員工姓名,本日總工時,正常工時(1.0),加班前2(1.34),加班後2(1.67),狀態\n';
    reports.forEach(r => {
      csvContent += `${r.date},${r.weekday},${r.staff_name},${r.total_hours.toFixed(2)},${r.regular_hours.toFixed(2)},${r.ot1_hours.toFixed(2)},${r.ot2_hours.toFixed(2)},${r.status}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `薪資考勤表_${selectedMonth}.csv`;
    link.click();
  };

  // --- CRUD 功能區 ---

  // 開啟編輯視窗 (修復 Bug 的關鍵在這裡)
  const openEdit = (log: Log) => {
    setEditingLog(log);
    // 🔧 Bug修復：打開編輯時，把名字也填進暫存變數
    setTempName(log.staff_name);
    
    const dateObj = new Date(log.clock_in_time);
    setTempDate(dateObj.toISOString().split('T')[0]); 
    setTempInTime(dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })); 
    
    if (log.clock_out_time) {
      setTempOutTime(new Date(log.clock_out_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    } else {
      setTempOutTime('');
    }
  };

  // 執行刪除
  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除這筆紀錄嗎？此動作無法復原。')) return;
    const { error } = await supabase.from('attendance_logs').delete().eq('id', id);
    if (error) alert('刪除失敗:' + error.message);
    else fetchLogs();
  };

  // 執行儲存
  const handleSave = async () => {
    // 因為 openEdit 有填入 tempName，這裡就不會擋住了
    if (!tempDate || !tempInTime || !tempName) return alert('請填寫完整資訊 (姓名/日期/時間)');

    const inDateTime = new Date(`${tempDate}T${tempInTime}:00`);
    let outDateTime: Date | null = null;
    let workHours = 0;

    if (tempOutTime) {
      outDateTime = new Date(`${tempDate}T${tempOutTime}:00`);
      if (outDateTime < inDateTime) {
        outDateTime.setDate(outDateTime.getDate() + 1);
      }
      workHours = (outDateTime.getTime() - inDateTime.getTime()) / 3600000;
    }

    if (isCreating) {
      const { error } = await supabase.from('attendance_logs').insert([{
        staff_name: tempName,
        clock_in_time: inDateTime.toISOString(),
        clock_out_time: outDateTime ? outDateTime.toISOString() : null,
        work_hours: outDateTime ? workHours : null,
        status: outDateTime ? 'completed' : 'working',
        is_bypass: true 
      }]);
      if (error) alert('新增失敗:' + error.message);
    } else if (editingLog) {
      const { error } = await supabase.from('attendance_logs').update({
        clock_in_time: inDateTime.toISOString(),
        clock_out_time: outDateTime ? outDateTime.toISOString() : null,
        work_hours: outDateTime ? workHours : null,
        status: outDateTime ? 'completed' : 'working'
      }).eq('id', editingLog.id);
      if (error) alert('更新失敗:' + error.message);
    }

    setEditingLog(null);
    setIsCreating(false);
    fetchLogs();
  };

  const openCreate = () => {
    setIsCreating(true);
    setEditingLog(null);
    const now = new Date();
    setTempDate(now.toISOString().split('T')[0]);
    setTempInTime('08:00');
    setTempOutTime('17:00');
    setTempName('');
  };

  // --- 畫面渲染：未登入 vs 已登入 ---

  // 🔒 未登入畫面 (鎖定)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
          <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">管理員登入</h2>
          <p className="text-slate-500 text-sm mb-6">請輸入後台通行碼</p>
          
          <input 
            type="password" 
            placeholder="Passcode"
            className="w-full p-3 border rounded-xl text-center text-lg tracking-widest mb-4 outline-none focus:ring-2 focus:ring-blue-500"
            value={inputPasscode}
            onChange={(e) => setInputPasscode(e.target.value)}
          />
          <button 
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition"
          >
            解鎖
          </button>
        </div>
      </div>
    );
  }

  // 🔓 已登入畫面 (正常後台)
  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-800">
      <div className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">診所考勤管理後台</h1>
          <p className="text-slate-500 text-sm">檢視、修改、補登員工打卡紀錄</p>
        </div>
        
        <div className="flex gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
          <input 
            type="month" 
            className="outline-none text-slate-700 bg-transparent px-2 font-bold"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <button onClick={fetchLogs} className="p-2 hover:bg-slate-100 rounded-full"><RefreshCw size={18}/></button>
          
          <div className="w-[1px] bg-slate-200 mx-1"></div>

          <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition font-bold text-sm">
            <Plus size={16} /> 補登
          </button>

          <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition font-bold text-sm">
            <Download size={16} /> 匯出報表
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left">
            <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-sm font-semibold text-slate-600">日期</th>
                <th className="p-4 text-sm font-semibold text-slate-600">姓名</th>
                <th className="p-4 text-sm font-semibold text-slate-600">時段</th>
                <th className="p-4 text-sm font-semibold text-slate-600">工時</th>
                <th className="p-4 text-sm font-semibold text-slate-600">狀態</th>
                <th className="p-4 text-sm font-semibold text-slate-600 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-mono text-sm text-slate-600">{new Date(log.clock_in_time).toLocaleDateString()}</td>
                  <td className="p-4 font-bold text-slate-800">
                    {log.staff_name}
                    {log.is_bypass && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1 rounded border border-red-200">補/異常</span>}
                  </td>
                  <td className="p-4 text-sm font-mono text-slate-600">
                    {new Date(log.clock_in_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - 
                    {log.clock_out_time ? new Date(log.clock_out_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}
                  </td>
                  <td className="p-4 font-mono font-bold text-blue-600">{log.work_hours ? Number(log.work_hours).toFixed(2) : '-'}</td>
                  <td className="p-4">
                    {log.clock_out_time ? <CheckCircle size={18} className="text-green-500"/> : <AlertCircle size={18} className="text-red-500 animate-pulse"/>}
                  </td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <button onClick={() => openEdit(log)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit size={16}/></button>
                    <button onClick={() => handleDelete(log.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(editingLog || isCreating) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-slate-800">{isCreating ? '補登紀錄' : '修改紀錄'}</h2>
              <button onClick={() => { setEditingLog(null); setIsCreating(false); }} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
            </div>

            <div className="space-y-4">
              {isCreating && (
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1">員工姓名 (請手動輸入)</label>
                  <input type="text" value={tempName} onChange={e => setTempName(e.target.value)} className="w-full border p-2 rounded-lg bg-slate-50"/>
                </div>
              )}
              {!isCreating && (
                <div className="font-bold text-lg text-blue-600 mb-2">{editingLog?.staff_name}</div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">日期</label>
                <input type="date" value={tempDate} onChange={e => setTempDate(e.target.value)} className="w-full border p-2 rounded-lg font-mono"/>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1">上班時間</label>
                  <input type="time" value={tempInTime} onChange={e => setTempInTime(e.target.value)} className="w-full border p-2 rounded-lg font-mono"/>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1">下班時間</label>
                  <input type="time" value={tempOutTime} onChange={e => setTempOutTime(e.target.value)} className="w-full border p-2 rounded-lg font-mono"/>
                </div>
              </div>
              <p className="text-xs text-slate-400">* 若下班時間早於上班時間，系統將自動視為跨日(隔天)</p>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => { setEditingLog(null); setIsCreating(false); }} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition">取消</button>
              <button onClick={handleSave} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2">
                <Save size={18}/> 儲存變更
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
