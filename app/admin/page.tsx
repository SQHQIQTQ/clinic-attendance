'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Download, Calendar, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

// --- Supabase 設定 ---
const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

type Log = {
  id: number;
  staff_name: string;
  clock_in_time: string;
  clock_out_time: string | null;
  work_hours: number | null;
};

// 用來匯出的資料結構
type DailyReport = {
  date: string;
  weekday: string;
  staff_name: string;
  total_hours: number;
  regular_hours: number; // 正常工時 (8hr內)
  ot1_hours: number;     // 加班 1.34 (2hr內)
  ot2_hours: number;     // 加班 1.67 (超過2hr)
  status: string;
};

export default function AdminPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // 1. 抓取原始打卡紀錄
  const fetchLogs = async () => {
    setLoading(true);
    const startDate = `${selectedMonth}-01T00:00:00`;
    // 簡單計算下個月1號
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

  useEffect(() => { fetchLogs(); }, [selectedMonth]);

  // 2. 核心邏輯：每日工時計算機
  const calculateDailyStats = (): DailyReport[] => {
    const dailyMap: Record<string, number> = {}; // 用來存 "2023-12-10_Amy" -> 總時數
    const statusMap: Record<string, string> = {}; // 用來檢查當天有沒有異常

    // A. 先把所有紀錄按「日期+人」歸戶加總
    logs.forEach(log => {
      // 轉換成台灣時間日期字串 (YYYY-MM-DD)
      const date = new Date(log.clock_in_time).toISOString().split('T')[0];
      const key = `${date}_${log.staff_name}`;
      
      const hours = log.work_hours ? parseFloat(log.work_hours.toString()) : 0;
      dailyMap[key] = (dailyMap[key] || 0) + hours;

      // 如果有任何一筆沒打下班卡，標記異常
      if (!log.clock_out_time) statusMap[key] = '異常(未打卡)';
    });

    // B. 計算勞基法分級
    const reports: DailyReport[] = [];
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    Object.keys(dailyMap).sort().forEach(key => {
      const [date, staff_name] = key.split('_');
      const total = dailyMap[key];
      const dayIndex = new Date(date).getDay(); // 0=週日

      let regular = 0;
      let ot1 = 0;
      let ot2 = 0;

      // --- 勞基法計算邏輯 (平日) ---
      if (total <= 8) {
        regular = total;
      } else if (total <= 10) {
        regular = 8;
        ot1 = total - 8;
      } else {
        regular = 8;
        ot1 = 2;
        ot2 = total - 10;
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

  // 3. 匯出 Excel (CSV)
  const handleExport = () => {
    if (logs.length === 0) return alert('無資料');
    const reports = calculateDailyStats();

    // CSV 表頭
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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">診所薪資管理後台</h1>
          <p className="text-slate-500 text-sm">自動計算加班分級 (1.34 / 1.67)</p>
        </div>
        
        <div className="flex gap-3 bg-white p-2 rounded-xl shadow-sm">
          <input 
            type="month" 
            className="outline-none text-slate-700 bg-transparent px-2"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <button onClick={fetchLogs} className="p-2 hover:bg-slate-100 rounded-full"><RefreshCw size={18}/></button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-bold"
          >
            <Download size={18} />
            匯出算薪報表
          </button>
        </div>
      </div>

      {/* 顯示原始紀錄 (方便查核) */}
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
        <div className="p-4 bg-slate-100 border-b font-bold text-slate-600">打卡流水帳 (原始紀錄)</div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
              <tr>
                <th className="p-4 text-sm font-semibold text-slate-500">日期</th>
                <th className="p-4 text-sm font-semibold text-slate-500">姓名</th>
                <th className="p-4 text-sm font-semibold text-slate-500">時段</th>
                <th className="p-4 text-sm font-semibold text-slate-500">單次工時</th>
                <th className="p-4 text-sm font-semibold text-slate-500">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="p-4 font-mono text-sm">{new Date(log.clock_in_time).toLocaleDateString()}</td>
                  <td className="p-4 font-bold">{log.staff_name}</td>
                  <td className="p-4 text-sm text-slate-600">
                    {new Date(log.clock_in_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - 
                    {log.clock_out_time ? new Date(log.clock_out_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--'}
                  </td>
                  <td className="p-4 font-mono">{log.work_hours ? Number(log.work_hours).toFixed(2) : '-'}</td>
                  <td className="p-4">{log.clock_out_time ? <CheckCircle size={16} className="text-green-500"/> : <AlertCircle size={16} className="text-red-500"/>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
