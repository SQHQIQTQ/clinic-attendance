'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import liff from '@line/liff';
import { Clock, CheckCircle, LogOut, Link as LinkIcon, User } from 'lucide-react';

// --- Supabase 設定 ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

const LIFF_ID = '2008669814-8OqQmkaL'; 

export default function ClinicAttendance() {
  const [status, setStatus] = useState('loading'); // loading, bind_needed, ready, error
  const [staffUser, setStaffUser] = useState(null);
  const [unboundStaffList, setUnboundStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [logs, setLogs] = useState([]);
  const [lineProfile, setLineProfile] = useState(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: LIFF_ID });
        // 1. 檢查是否在 Line 內或已登入
        if (!liff.isLoggedIn()) {
          liff.login(); 
          return;
        }
        const profile = await liff.getProfile();
        setLineProfile(profile);
        
        // 2. 檢查資料庫綁定
        checkBinding(profile.userId);
      } catch (err) {
        console.error('LIFF Error:', err);
        // 如果 LIFF 失敗 (例如在電腦瀏覽器開發)，顯示錯誤
        setStatus('error');
      }
    };
    initLiff();
  }, []);

  const checkBinding = async (lineUserId) => {
    // 查詢這個 Line ID 是否已存在
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('line_user_id', lineUserId)
      .single();

    if (data) {
      setStaffUser(data);
      setStatus('ready');
      fetchTodayLogs(data.name);
    } else {
      // 未綁定：抓取還沒綁定的人員名單
      const { data: unbound } = await supabase
        .from('staff')
        .select('*')
        .is('line_user_id', null);
      setUnboundStaffList(unbound || []);
      setStatus('bind_needed');
    }
  };

  const handleBind = async () => {
    if (!selectedStaffId) return alert('請選擇姓名');
    
    const { error } = await supabase
      .from('staff')
      .update({ line_user_id: lineProfile.userId })
      .eq('id', selectedStaffId);

    if (error) {
      alert('綁定失敗:' + error.message);
    } else {
      alert('綁定成功！');
      window.location.reload();
    }
  };

  const fetchTodayLogs = async (staffName) => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('staff_name', staffName)
      .gte('created_at', today + 'T00:00:00')
      .order('created_at', { ascending: false });
    setLogs(data || []);
  };

  const handleClockIn = async () => {
    if (!staffUser) return;
    const { error } = await supabase
      .from('attendance_logs')
      .insert([{ staff_name: staffUser.name, clock_in_time: new Date(), status: 'working' }]);
    if (!error) {
      alert('打卡成功！');
      fetchTodayLogs(staffUser.name);
    }
  };

  const handleClockOut = async () => {
    const lastSession = logs.find(log => !log.clock_out_time);
    if (!lastSession) return;
    const now = new Date();
    const hours = (now - new Date(lastSession.clock_in_time)) / 36e5; // 毫秒轉小時
    
    const { error } = await supabase
      .from('attendance_logs')
      .update({ clock_out_time: now, work_hours: hours.toFixed(2), status: 'completed' })
      .eq('id', lastSession.id);

    if (!error) {
      alert('下班成功！');
      fetchTodayLogs(staffUser.name);
    }
  };

  // --- 畫面渲染 ---
  if (status === 'loading') return <div className="flex h-screen items-center justify-center text-xl">LINE 登入中...</div>;
  if (status === 'error') return <div className="flex h-screen items-center justify-center text-red-500">LIFF 初始化失敗 (請確認 LIFF ID)</div>;

  // 綁定畫面
  if (status === 'bind_needed') {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-100 p-6">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm text-center">
          <LinkIcon className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-4">歡迎初次使用</h2>
          <p className="mb-6 text-gray-500">請選擇您的姓名進行綁定</p>
          <select 
            className="w-full p-3 border rounded-lg mb-6 bg-white text-black"
            value={selectedStaffId}
            onChange={e => setSelectedStaffId(e.target.value)}
          >
            <option value="">-- 請選擇 --</option>
            {unboundStaffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={handleBind} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">確認綁定</button>
        </div>
      </div>
    );
  }

  // 打卡畫面 (已綁定)
  const isWorking = logs.length > 0 && !logs[0].clock_out_time;
  
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white p-6 rounded-b-3xl shadow-sm text-center">
        <div className="text-4xl font-bold text-gray-800 mb-2">
          {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
        <div className="flex items-center justify-center gap-2 text-blue-600 font-bold bg-blue-50 py-1 px-3 rounded-full inline-block mx-auto">
          <User size={16} /> {staffUser.name}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        {!isWorking ? (
          <button onClick={handleClockIn} className="w-56 h-56 bg-green-500 rounded-full text-white shadow-xl flex flex-col items-center justify-center active:scale-95 transition">
            <Clock size={48} className="mb-2" />
            <span className="text-2xl font-bold">上班打卡</span>
          </button>
        ) : (
          <button onClick={handleClockOut} className="w-56 h-56 bg-red-500 rounded-full text-white shadow-xl flex flex-col items-center justify-center active:scale-95 transition">
            <LogOut size={48} className="mb-2" />
            <span className="text-2xl font-bold">下班打卡</span>
          </button>
        )}
      </div>

      <div className="p-6 bg-white">
        <h3 className="font-bold text-gray-400 mb-2 text-sm">今日紀錄</h3>
        {logs.map(log => (
          <div key={log.id} className="flex justify-between py-3 border-b">
            <div>
              <span className="font-bold text-gray-800">
                {new Date(log.clock_in_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
              </span>
              {log.clock_out_time && (
                <span className="text-gray-500"> - {new Date(log.clock_out_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
              )}
            </div>
            {log.clock_out_time ? <CheckCircle className="text-green-500" size={20} /> : <span className="text-green-600 text-xs font-bold bg-green-100 px-2 py-1 rounded">進行中</span>}
          </div>
        ))}
      </div>
    </div>
  );
}