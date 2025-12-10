'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import liff from '@line/liff';
import { Clock, CheckCircle, AlertCircle, LogOut, Link as LinkIcon, User } from 'lucide-react';

// --- 1. Supabase 設定 (請確認這裡的 Key 是對的) ---
// 如果你的 Key 在環境變數裡，請保持 process.env...
// 如果沒有，請暫時將你的 Supabase URL 和 Anon Key 貼在引號裡 (注意資安，僅供測試)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';

const supabase = createClient(supabaseUrl, supabaseKey);

// --- 2. LIFF ID ---
const LIFF_ID = '2008669814-8OqQmkaL'; 

export default function ClinicAttendance() {
  const [lineProfile, setLineProfile] = useState(null);
  const [staffUser, setStaffUser] = useState(null); // 綁定後的員工資料
  const [unboundStaffList, setUnboundStaffList] = useState([]); // 給未綁定的人選
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [status, setStatus] = useState('loading'); // loading, bind_needed, ready, error
  const [logs, setLogs] = useState([]); // 本日打卡紀錄

  // A. 初始化：連接 Line LIFF
  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
          liff.login(); // 沒登入就強制跳轉 Line 登入畫面
          return;
        }
        const profile = await liff.getProfile();
        setLineProfile(profile);
        checkBinding(profile.userId); // 檢查這個 Line ID 是否已經是員工
      } catch (err) {
        console.error('LIFF Init Failed', err);
        setStatus('error');
      }
    };
    initLiff();
  }, []);

  // B. 檢查綁定狀態
  const checkBinding = async (lineUserId) => {
    // 1. 去 Supabase 查有沒有這個 Line ID
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('line_user_id', lineUserId)
      .single();

    if (data) {
      // 找到了！是老員工
      setStaffUser(data);
      setStatus('ready');
      fetchTodayLogs(data.name);
    } else {
      // 沒找到，需要綁定
      fetchUnboundStaff(); // 抓取還沒綁定的名單給他選
      setStatus('bind_needed');
    }
  };

  // C. 抓取未綁定的員工名單
  const fetchUnboundStaff = async () => {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .is('line_user_id', null); // 只抓還沒綁 Line 的
    setUnboundStaffList(data || []);
  };

  // D. 執行綁定動作
  const handleBind = async () => {
    if (!selectedStaffId) return alert('請選擇您的姓名');
    
    // 更新資料庫：把 Line ID 寫入該員工欄位
    const { error } = await supabase
      .from('staff')
      .update({ line_user_id: lineProfile.userId })
      .eq('id', selectedStaffId);

    if (error) {
      alert('綁定失敗：' + error.message);
    } else {
      alert('綁定成功！歡迎加入。');
      window.location.reload(); // 重新整理頁面進入打卡模式
    }
  };

  // E. 抓取今日打卡紀錄
  const fetchTodayLogs = async (staffName) => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('staff_name', staffName)
      .gte('created_at', today + 'T00:00:00') // 簡單抓今天的
      .order('created_at', { ascending: false });
    setLogs(data || []);
  };

  // F. 打卡邏輯
  const handleClockIn = async () => {
    const { error } = await supabase
      .from('attendance_logs')
      .insert([{ staff_name: staffUser.name, clock_in_time: new Date(), status: 'working' }]);
    
    if (!error) {
      alert('上班打卡成功！加油！');
      fetchTodayLogs(staffUser.name);
    }
  };

  const handleClockOut = async () => {
    // 找最後一筆還沒下班的
    const lastSession = logs.find(log => !log.clock_out_time);
    if (!lastSession) return alert('系統找不到您的上班紀錄，請聯繫管理員。');

    const now = new Date();
    // 簡單計算工時 (小時)
    const hours = (now - new Date(lastSession.clock_in_time)) / 1000 / 60 / 60;

    const { error } = await supabase
      .from('attendance_logs')
      .update({ clock_out_time: now, work_hours: hours.toFixed(2), status: 'completed' })
      .eq('id', lastSession.id);

    if (!error) {
      alert('下班打卡成功！辛苦了！');
      fetchTodayLogs(staffUser.name);
    }
  };

  // --- 畫面渲染 ---

  if (status === 'loading') return <div className="p-10 text-center">載入中... (Line 驗證)</div>;
  if (status === 'error') return <div className="p-10 text-center text-red-500">系統錯誤，請確認網路或 LIFF 設定</div>;

  // 畫面 1: 綁定頁面 (第一次使用)
  if (status === 'bind_needed') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm text-center">
          <LinkIcon className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">歡迎使用打卡系統</h1>
          <p className="text-slate-500 mb-6">初次見面，請問您是哪一位？</p>
          
          <div className="text-left mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">選擇您的姓名</label>
            <select 
              className="w-full p-3 border border-slate-300 rounded-lg bg-white text-lg"
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
            >
              <option value="">-- 請選擇 --</option>
              {unboundStaffList.map(staff => (
                <option key={staff.id} value={staff.id}>{staff.name}</option>
              ))}
            </select>
          </div>
          
          <button 
            onClick={handleBind}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-md hover:bg-blue-700 transition"
          >
            確認綁定
          </button>
          <p className="text-xs text-slate-400 mt-4">綁定後，下次打開就會自動登入喔！</p>
        </div>
      </div>
    );
  }

  // 畫面 2: 打卡主頁面 (已綁定)
  const isWorking = logs.length > 0 && !logs[0].clock_out_time;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* 頂部資訊卡 */}
      <div className="bg-white p-6 pb-10 rounded-b-[3rem] shadow-sm text-center">
        <h2 className="text-slate-500 text-sm mb-1">{new Date().toLocaleDateString()}</h2>
        <div className="text-5xl font-mono font-bold text-slate-800 mb-4">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="inline-flex items-center bg-blue-50 px-4 py-2 rounded-full">
          <User className="w-4 h-4 text-blue-600 mr-2" />
          <span className="text-blue-900 font-bold">{staffUser?.name}</span>
        </div>
      </div>

      {/* 中間：打卡按鈕 */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 -mt-8">
        {!isWorking ? (
          <button 
            onClick={handleClockIn}
            className="w-64 h-64 bg-green-500 rounded-full shadow-xl border-8 border-green-100 flex flex-col items-center justify-center active:scale-95 transition transform"
          >
            <Clock className="w-16 h-16 text-white mb-2" />
            <span className="text-3xl font-bold text-white">上班打卡</span>
            <span className="text-green-100 text-sm mt-1">CLOCK IN</span>
          </button>
        ) : (
          <button 
            onClick={handleClockOut}
            className="w-64 h-64 bg-red-500 rounded-full shadow-xl border-8 border-red-100 flex flex-col items-center justify-center active:scale-95 transition transform"
          >
            <LogOut className="w-16 h-16 text-white mb-2" />
            <span className="text-3xl font-bold text-white">下班打卡</span>
            <span className="text-red-100 text-sm mt-1">CLOCK OUT</span>
          </button>
        )}
      </div>

      {/* 底部：今日紀錄 */}
      <div className="p-6">
        <h3 className="text-slate-500 text-sm font-bold mb-3 uppercase tracking-wider">今日紀錄</h3>
        <div className="space-y-3">
          {logs.map(log => (
            <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center border-l-4 border-blue-500">
              <div>
                <div className="text-lg font-bold text-slate-800">
                  {new Date(log.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   {' - '} 
                  {log.clock_out_time ? new Date(log.clock_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '工作中...'}
                </div>
                <div className="text-xs text-slate-400">
                  {log.work_hours ? `工時: ${parseFloat(log.work_hours).toFixed(1)} hr` : '計時中'}
                </div>
              </div>
              {log.clock_out_time ? <CheckCircle className="text-slate-300 w-5 h-5" /> : <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />}
            </div>
          ))}
          {logs.length === 0 && <div className="text-center text-slate-400 py-4">今天還沒打卡喔</div>}
        </div>
      </div>
    </div>
  );
}