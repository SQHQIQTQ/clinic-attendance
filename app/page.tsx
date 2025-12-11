'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import liff from '@line/liff';
import { Clock, CheckCircle, LogOut, Link as LinkIcon, User, RefreshCw, MapPin, AlertTriangle } from 'lucide-react';

// --- 設定區 ---
const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const LIFF_ID = '2008669814-8OqQmkaL'; 

// 🛑【請修改這裡】診所的座標 (Google Map 右鍵取得)
const CLINIC_LAT = 25.00587314548561; 
const CLINIC_LNG = 121.47738450872981; 
const ALLOWED_RADIUS = 150; // 允許半徑 (公尺)，建議 100-150

const supabase = createClient(supabaseUrl, supabaseKey);

type Staff = { id: number; name: string; line_user_id: string | null; role: string; }; // 增加 role
type Log = { id: number; clock_in_time: string; clock_out_time: string | null; work_hours: number | null; };

export default function ClinicAttendance() {
  const [status, setStatus] = useState<string>('loading'); 
  const [staffUser, setStaffUser] = useState<Staff | null>(null);
  const [unboundStaffList, setUnboundStaffList] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [logs, setLogs] = useState<Log[]>([]);
  
  // GPS 狀態
  const [gpsStatus, setGpsStatus] = useState<string>(''); // 'locating', 'ok', 'out_of_range', 'error'
  const [currentDist, setCurrentDist] = useState<number>(0);
  const [bypassMode, setBypassMode] = useState(false); // 是否開啟救援模式

  useEffect(() => {
    const initSystem = async () => {
      try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const profile = await liff.getProfile();
        checkBinding(profile.userId);
      } catch (err) {
        console.error('LIFF Error:', err);
        setStatus('error');
      }
    };
    initSystem();
  }, []);

  const checkBinding = async (lineUserId: string) => {
    // 記得要把 role 也抓出來
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

  // --- GPS 計算核心 ---
  const getDistanceFromLatLonInM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  
    var dLon = deg2rad(lon2-lon1); 
    var a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c * 1000; // Distance in meters
    return d;
  }
  const deg2rad = (deg: number) => deg * (Math.PI/180);

  // 執行打卡動作 (包含 GPS 檢查)
  const executeClockAction = async (action: 'in' | 'out') => {
    if (!staffUser) return;

    // 1. VIP 豁免檢查
    const isVip = staffUser.role === 'doctor' || staffUser.role === 'manager';
    
    // 如果是 VIP，直接通過
    if (isVip) {
      await submitToDatabase(action, null, null, false);
      return;
    }

    // 如果開啟了救援模式 (手動報備)，也直接通過，但標記 bypass
    if (bypassMode) {
      await submitToDatabase(action, null, null, true);
      return;
    }

    // 2. 一般員工：檢查 GPS
    setGpsStatus('locating');
    if (!navigator.geolocation) {
      alert('您的手機不支援或未開啟 GPS');
      setGpsStatus('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const dist = getDistanceFromLatLonInM(lat, lng, CLINIC_LAT, CLINIC_LNG);
        
        setCurrentDist(Math.round(dist));

        if (dist <= ALLOWED_RADIUS) {
          // 距離內，允許打卡
          await submitToDatabase(action, lat, lng, false);
          setGpsStatus('ok');
        } else {
          // 距離太遠
          setGpsStatus('out_of_range');
          alert(`距離診所太遠 (${Math.round(dist)}公尺)。請在診所內打卡，或使用救援模式。`);
        }
      },
      (error) => {
        console.error(error);
        setGpsStatus('error');
        alert('無法取得位置。請確認 Line/瀏覽器 有開啟定位權限。');
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  // 寫入資料庫
  const submitToDatabase = async (action: 'in' | 'out', lat: number | null, lng: number | null, isBypass: boolean) => {
    if (action === 'in') {
      const { error } = await supabase.from('attendance_logs').insert([{ 
        staff_name: staffUser!.name, 
        clock_in_time: new Date(), 
        status: 'working',
        gps_lat: lat,
        gps_lng: lng,
        is_bypass: isBypass
      }]);
      if (!error) { alert(isBypass ? '救援打卡成功 (已記錄異常)' : '上班打卡成功！'); fetchTodayLogs(staffUser!.name); }
      else alert('失敗:' + error.message);
    } else {
      const lastSession = logs.find(log => !log.clock_out_time);
      if (!lastSession) return;
      const now = new Date();
      const hours = (now.getTime() - new Date(lastSession.clock_in_time).getTime()) / 3600000;
      
      const { error } = await supabase.from('attendance_logs').update({ 
        clock_out_time: now.toISOString(), 
        work_hours: hours, 
        status: 'completed',
        gps_lat: lat,
        gps_lng: lng,
        is_bypass: isBypass
      }).eq('id', lastSession.id);

      if (!error) { alert(isBypass ? '救援下班成功 (已記錄異常)' : '下班成功！'); fetchTodayLogs(staffUser!.name); }
    }
    // 重置狀態
    setGpsStatus('');
    setBypassMode(false);
  };

  // --- 畫面 ---
  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">LINE 驗證中...</div>;
  if (status === 'error') return <div className="min-h-screen flex items-center justify-center text-red-500 font-bold text-center p-4">系統連線失敗 (V7.0 GPS)<br/><span className="text-xs text-gray-400">請確認使用 LINE 開啟</span></div>;
  if (status === 'bind_needed') return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
        <LinkIcon className="w-16 h-16 text-blue-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-gray-800">歡迎使用 (V7.0 GPS)</h2>
        <p className="text-gray-500 mb-6">初次見面，請選擇您的姓名</p>
        <select className="w-full p-4 border rounded-xl mb-6 text-lg bg-white" value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)}>
          <option value="">-- 請選擇您的姓名 --</option>
          {unboundStaffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={handleBind} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg">確認綁定</button>
      </div>
    </div>
  );

  const isWorking = logs.length > 0 && !logs[0].clock_out_time;
  const isVip = staffUser?.role === 'doctor' || staffUser?.role === 'manager';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <div className="bg-white p-6 pb-8 rounded-b-[2rem] shadow-sm text-center">
        <h2 className="text-gray-400 text-sm font-bold mb-1">{new Date().toLocaleDateString()}</h2>
        <div className="text-5xl font-bold text-slate-800 mb-4 font-mono">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        <div className="inline-flex items-center bg-blue-100 text-blue-800 px-4 py-1 rounded-full text-sm font-bold">
          <User size={16} className="mr-2" />
          {staffUser?.name} 
          {isVip && <span className="ml-2 text-xs bg-yellow-300 text-yellow-900 px-1 rounded">VIP</span>}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {gpsStatus === 'locating' && <div className="mb-4 text-blue-600 animate-pulse font-bold">🛰️ 定位中...</div>}
        {gpsStatus === 'out_of_range' && <div className="mb-4 text-red-500 font-bold text-center">❌ 距離太遠 ({currentDist}m)<br/>請靠近診所</div>}
        {gpsStatus === 'error' && <div className="mb-4 text-red-500 font-bold">❌ 無法取得 GPS</div>}

        {!isWorking ? (
          <button onClick={() => executeClockAction('in')} className="w-64 h-64 bg-green-500 rounded-full shadow-2xl border-8 border-green-100 flex flex-col items-center justify-center active:scale-95 transition">
            <Clock size={56} className="text-white mb-2" /><span className="text-3xl font-bold text-white">上班</span>
          </button>
        ) : (
          <button onClick={() => executeClockAction('out')} className="w-64 h-64 bg-red-500 rounded-full shadow-2xl border-8 border-red-100 flex flex-col items-center justify-center active:scale-95 transition">
            <LogOut size={56} className="text-white mb-2" /><span className="text-3xl font-bold text-white">下班</span>
          </button>
        )}

        {/* 救援模式切換：只有當非 VIP 且沒在打卡時顯示，或是定位失敗時 */}
        {!isVip && (
          <div className="mt-8">
            {!bypassMode ? (
              <button 
                onClick={() => {
                  if(confirm('確定要使用「救援模式」嗎？\n請務必先向主管報備。\n這筆紀錄會被標記為異常。')) setBypassMode(true);
                }} 
                className="text-xs text-slate-400 underline hover:text-red-500"
              >
                GPS 定位不到？使用救援打卡
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-center animate-pulse">
                <div className="flex items-center justify-center text-red-600 font-bold mb-1"><AlertTriangle size={16} className="mr-1"/> 救援模式已開啟</div>
                <div className="text-xs text-red-400">請直接點擊上方打卡按鈕<br/>(系統將記錄異常狀態)</div>
                <button onClick={() => setBypassMode(false)} className="text-xs text-slate-400 underline mt-2">取消</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white p-6">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-400 text-sm uppercase">今日紀錄</h3><button onClick={() => window.location.reload()} className="p-2 bg-gray-100 rounded-full"><RefreshCw size={16} className="text-gray-500"/></button></div>
        <div className="space-y-3">
          {logs.map(log => (
            <div key={log.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div><div className="font-bold text-slate-700 text-lg">{new Date(log.clock_in_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {log.clock_out_time ? new Date(log.clock_out_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '...'}</div></div>
              {/* @ts-ignore */}
              {log.is_bypass && <span className="text-xs bg-red-100 text-red-600 px-1 rounded ml-2">異常</span>}
              {log.clock_out_time ? <CheckCircle className="text-slate-300" /> : <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
