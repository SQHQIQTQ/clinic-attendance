'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import liff from '@line/liff';
import { Clock, CheckCircle, LogOut, Link as LinkIcon, User, RefreshCw } from 'lucide-react';

// --- 設定區 ---
const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const LIFF_ID = '2008669814-8OqQmkaL'; 

const supabase = createClient(supabaseUrl, supabaseKey);

type Staff = { id: number; name: string; line_user_id: string | null; };
type Log = { id: number; clock_in_time: string; clock_out_time: string | null; work_hours: number | null; };

export default function CheckinPage() {
  const [status, setStatus] = useState<string>('loading'); 
  const [staffUser, setStaffUser] = useState<Staff | null>(null);
  const [unboundStaffList, setUnboundStaffList] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    const initSystem = async () => {
      try {
        console.log('Starting LIFF init...'); // Debug
        await liff.init({ liffId: LIFF_ID });
        console.log('LIFF init success'); // Debug
        
        if (!liff.isLoggedIn()) {
          console.log('Not logged in, redirecting...');
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        console.log('User:', profile.userId);
        checkBinding(profile.userId);

      } catch (err: any) {
        console.error('LIFF Error Full:', err);
        setStatus('error');
      }
    };
    initSystem();
  }, []);

  const checkBinding = async (lineUserId: string) => {
    const { data } = await supabase.from('staff').select('*').eq('line_user_id', lineUserId).single();
    if (data) {
      setStaffUser(data);
      setStatus('ready');
      fetchTodayLogs(data.name);
    } else {
      const { data: unbound } = await supabase.from('staff').select('*').is('line_user_id', null);
      setUnboundStaffList(unbound || []);
      setStatus('bind_needed');
    }
  };

  const handleBind = async () => {
    if (!selectedStaffId) return alert('請選擇姓名');
    const profile = await liff.getProfile();
    const { error } = await supabase.from('staff').update({ line_user_id: profile.userId }).eq('id', selectedStaffId);
    if (error) alert('綁定失敗: ' + error.message);
    else { alert('綁定成功！'); window.location.reload(); }
  };

  const fetchTodayLogs = async (staffName: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('attendance_logs').select('*').eq('staff_name', staffName).gte('created_at', today + 'T00:00:00').order('created_at', { ascending: false });
    // @ts-ignore
    setLogs(data || []);
  };

  const handleClockIn = async () => {
    if (!staffUser) return;
    const { error } = await supabase.from('attendance_logs').insert([{ staff_name: staffUser.name, clock_in_time: new Date(), status: 'working' }]);
    if (!error) { alert('上班打卡成功！'); fetchTodayLogs(staffUser.name); }
  };

  const handleClockOut = async () => {
    const lastSession = logs.find(log => !log.clock_out_time);
    if (!lastSession) return;
    const now = new Date();
    const hours = (now.getTime() - new Date(lastSession.clock_in_time).getTime()) / 3600000;
    const { error } = await supabase.from('attendance_logs').update({ clock_out_time: now.toISOString(), work_hours: hours, status: 'completed' }).eq('id', lastSession.id);
    if (!error) { alert('下班成功！'); fetchTodayLogs(staffUser!.name); }
  };

  // --- 畫面渲染 ---
  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center text-xl font-bold text-gray-500">LINE 驗證中 (V6.0)...</div>;
  if (status === 'error') return (
    <div className="min-h-screen flex flex-col items-center justify-center text-red-500 font-bold p-6 text-center">
      <h3 className="text-xl mb-2">系統連線失敗 (V6.0)</h3>
      <p className="text-sm text-gray-600 mb-4">請確認您是使用 LINE 開啟此連結</p>
      <div className="text-xs bg-gray-100 p-2 rounded text-left w-full break-all">
        請檢查 Line Developers Console 的 Endpoint URL 是否設定正確
      </div>
    </div>
  );

  // 1. 綁定畫面
  if (status === 'bind_needed') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
          <LinkIcon className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-gray-800">歡迎使用 (V6.0)</h2>
          <p className="text-gray-500 mb-6">初次見面，請選擇您的姓名</p>
          <select className="w-full p-4 border border-gray-300 rounded-xl mb-6 text-lg bg-white text-black" value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)}>
            <option value="">-- 請選擇您的姓名 --</option>
            {unboundStaffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={handleBind} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg">確認綁定</button>
        </div>
      </div>
    );
  }

  // 2. 打卡畫面
  const isWorking = logs.length > 0 && !logs[0].clock_out_time;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <div className="bg-white p-6 pb-8 rounded-b-[2rem] shadow-sm text-center">
        <h2 className="text-gray-400 text-sm font-bold mb-1">{new Date().toLocaleDateString()}</h2>
        <div className="text-5xl font-bold text-slate-800 mb-4 font-mono">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        <div className="inline-flex items-center bg-blue-100 text-blue-800 px-4 py-1 rounded-full text-sm font-bold"><User size={16} className="mr-2" />{staffUser?.name}</div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        {!isWorking ? (
          <button onClick={handleClockIn} className="w-64 h-64 bg-green-500 rounded-full shadow-2xl border-8 border-green-100 flex flex-col items-center justify-center active:scale-95 transition">
            <Clock size={56} className="text-white mb-2" /><span className="text-3xl font-bold text-white">上班</span>
          </button>
        ) : (
          <button onClick={handleClockOut} className="w-64 h-64 bg-red-500 rounded-full shadow-2xl border-8 border-red-100 flex flex-col items-center justify-center active:scale-95 transition">
            <LogOut size={56} className="text-white mb-2" /><span className="text-3xl font-bold text-white">下班</span>
          </button>
        )}
      </div>
      <div className="bg-white p-6">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-400 text-sm uppercase">今日紀錄</h3><button onClick={() => window.location.reload()} className="p-2 bg-gray-100 rounded-full"><RefreshCw size={16} className="text-gray-500"/></button></div>
        <div className="space-y-3">
          {logs.map(log => (
            <div key={log.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div><div className="font-bold text-slate-700 text-lg">{new Date(log.clock_in_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {log.clock_out_time ? new Date(log.clock_out_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '...'}</div></div>
              {log.clock_out_time ? <CheckCircle className="text-slate-300" /> : <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
