'use client';

// 1. 引入必要的工具
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import liff from '@line/liff';
import { Clock, CheckCircle, LogOut, Link as LinkIcon, User, RefreshCw } from 'lucide-react';

// 2. Supabase 設定 (這裡直接填入你的 Key，確保不會讀不到)
const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

// 3. LIFF ID 設定
const LIFF_ID = '2008669814-8OqQmkaL'; 

// 定義資料類型 (解決 TypeScript 紅字)
type Staff = {
  id: number;
  name: string;
  line_user_id: string | null;
};

type Log = {
  id: number;
  clock_in_time: string;
  clock_out_time: string | null;
  work_hours: number | null;
};

export default function ClinicAttendance() {
  const [status, setStatus] = useState<string>('loading'); 
  const [staffUser, setStaffUser] = useState<Staff | null>(null);
  const [unboundStaffList, setUnboundStaffList] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [logs, setLogs] = useState<Log[]>([]);
  const [lineProfile, setLineProfile] = useState<any>(null);

  // A. 初始化
  useEffect(() => {
    const initSystem = async () => {
      try {
        // 初始化 LIFF
        await liff.init({ liffId: LIFF_ID });
        
        // 如果沒登入，就登入
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        setLineProfile(profile);
        console.log('Line User ID:', profile.userId); // Debug用

        // 檢查綁定
        checkBinding(profile.userId);

      } catch (err) {
        console.error('LIFF Error:', err);
        // 如果在電腦上測，也可以用假資料繞過 (僅供測試)
        // checkBinding('mock-line-id'); 
        setStatus('error');
      }
    };

    initSystem();
  }, []);

  // B. 檢查是否綁定過
  const checkBinding = async (lineUserId: string) => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('line_user_id', lineUserId)
      .single();

    if (data) {
      // 有綁定過
      setStaffUser(data);
      setStatus('ready');
      fetchTodayLogs(data.name);
    } else {
      // 沒綁定過，抓取名單
      const { data: unbound } = await supabase
        .from('staff')
        .select('*')
        .is('line_user_id', null);
      
      setUnboundStaffList(unbound || []);
      setStatus('bind_needed');
    }
  };

  // C. 執行綁定
  const handleBind = async () => {
    if (!selectedStaffId) return alert('請選擇姓名');
    
    const { error } = await supabase
      .from('staff')
      .update({ line_user_id: lineProfile.userId })
      .eq('id', selectedStaffId);

    if (error) {
      alert('綁定失敗: ' + error.message);
    } else {
      alert('綁定成功！');
      window.location.reload();
    }
  };

  // D. 抓取今日紀錄
  const fetchTodayLogs = async (staffName: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('staff_name', staffName)
      .gte('created_at', today + 'T00:00:00')
      .order('created_at', { ascending: false });
    
    // @ts-ignore
    setLogs(data || []);
  };

  // E. 上班打卡
  const handleClockIn = async () => {
    if (!staffUser) return;
    const { error } = await supabase
      .from('attendance_logs')
      .insert([{ staff_name: staffUser.name, clock_in_time: new Date(), status: 'working' }]);
    
    if (!error) {
      alert('上班打卡成功！');
      fetchTodayLogs(staffUser.name);
    } else {
      alert('打卡失敗：' + error.message);
    }
  };

  // F. 下班打卡
  const handleClockOut = async () => {
    const lastSession = logs.find(log => !log.clock_out_time);
    if (!lastSession) return;
    
    const now = new Date();
    const startTime = new Date(lastSession.clock_in_time);
    const hours = (now.getTime() - startTime.getTime()) / 3600000; // 毫秒轉小時
    
    const { error } = await supabase
      .from('attendance_logs')
      .update({ clock_out_time: now.toISOString(), work_hours: hours, status: 'completed' })
      .eq('id', lastSession.id);

    if (!error) {
      alert('下班成功！');
      fetchTodayLogs(staffUser!.name);
    }
  };

  // --- 畫面區 ---

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center text-xl font-bold text-gray-500">LINE 驗證中...</div>;
  if (status === 'error') return <div className="min-h-screen flex items-center justify-center text-red-500 font-bold">系統連線失敗 (請確認用 Line 開啟)</div>;

  // 1. 綁定畫面
  if (status === 'bind_needed') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
          <LinkIcon className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">歡迎使用 (V4.0)</h2>
          <p className="text-gray-500 mb-6">初次見面，請選擇您的姓名</p>
          
          <select 
            className="w-full p-4 border border-gray-300 rounded-xl mb-6 text-lg bg-white"
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
          >
            <option value="">-- 請選擇 --</option>
            {unboundStaffList.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <button onClick={handleBind} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition">
            確認綁定
          </button>
        </div>
      </div>
    );
  }

  // 2. 打卡畫面
  const isWorking = logs.length > 0 && !logs[0].clock_out_time;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white p-6 pb-8 rounded-b-[2rem] shadow-sm text-center">
        <h2 className="text-gray-400 text-sm font-bold mb-1">{new Date().toLocaleDateString()}</h2>
        <div className="text-5xl font-bold text-slate-800 mb-4 font-mono">
          {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
        <div className="inline-flex items-center bg-blue-100 text-blue-800 px-4 py-1 rounded-full text-sm font-bold">
          <User size={16} className="mr-2" />
          {staffUser?.name}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        {!isWorking ? (
          <button onClick={handleClockIn} className="w-64 h-64 bg-green-500 rounded-full shadow-2xl border-8 border-green-100 flex flex-col items-center justify-center active:scale-95 transition">
            <Clock size={56} className="text-white mb-2" />
            <span className="text-3xl font-bold text-white">上班</span>
            <span className="text-green-100 mt-1">Clock In</span>
          </button>
        ) : (
          <button onClick={handleClockOut} className="w-64 h-64 bg-red-500 rounded-full shadow-2xl border-8 border-red-100 flex flex-col items-center justify-center active:scale-95 transition">
            <LogOut size={56} className="text-white mb-2" />
            <span className="text-3xl font-bold text-white">下班</span>
            <span className="text-red-100 mt-1">Clock Out</span>
          </button>
        )}
      </div>

      <div className="bg-white p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-400 text-sm uppercase">今日紀錄</h3>
          <button onClick={() => window.location.reload()} className="p-2 bg-gray-100 rounded-full">
            <RefreshCw size={16} className="text-gray-500"/>
          </button>
        </div>
        
        <div className="space-y-3">
          {logs.map(log => (
            <div key={log.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <div className="font-bold text-slate-700 text-lg">
                  {new Date(log.clock_in_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                  {' - '}
                  {log.clock_out_time ? new Date(log.clock_out_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '...'}
                </div>
                <div className="text-xs text-gray-400">
                  工時: {log.work_hours ? parseFloat(log.work_hours.toString()).toFixed(2) : '計時中'}
                </div>
              </div>
              {log.clock_out_time ? <CheckCircle className="text-slate-300" /> : <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />}
            </div>
          ))}
          {logs.length === 0 && <div className="text-center text-gray-300 py-4">尚無紀錄</div>}
        </div>
      </div>
    </div>
  );
}