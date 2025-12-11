'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Download, Calendar, Search, AlertCircle, CheckCircle } from 'lucide-react';

// --- Supabase 設定 (沿用之前的 Key) ---
const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

type Log = {
  id: number;
  staff_name: string;
  clock_in_time: string;
  clock_out_time: string | null;
  work_hours: number | null;
  status: string;
};

export default function AdminPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // 預設當前月份 (YYYY-MM)

  // 1. 抓取資料
  const fetchLogs = async () => {
    setLoading(true);
    // 計算月份的頭尾
    const startDate = `${selectedMonth}-01T00:00:00`;
    // 簡單處理：下個月的1號就是這個月的結束
    const year = parseInt(selectedMonth.split('-')[0]);
    const month = parseInt(selectedMonth.split('-')[1]);
    const nextMonthDate = new Date(year, month, 1).toISOString();

    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .gte('clock_in_time', startDate)
      .lt('clock_in_time', nextMonthDate)
      .order('clock_in_time', { ascending: false });

    if (error) {
      alert('讀取失敗: ' + error.message);
    } else {
      // @ts-ignore
      setLogs(data || []);
    }
    setLoading(false);
  };

  // 當月份改變時，重新抓取
  useEffect(() => {
    fetchLogs();
  }, [selectedMonth]);

  // 2. 匯出 Excel (CSV)
  const handleExport = () => {
    if (logs.length === 0) return alert('沒有資料可以匯出');

    // CSV 表頭
    let csvContent = '\uFEFF'; // BOM (防止 Excel 中文亂碼)
    csvContent += '日期,姓名,上班時間,下班時間,工時,狀態\n';

    logs.forEach(log => {
      const date = new Date(log.clock_in_time).toLocaleDateString();
      const inTime = new Date(log.clock_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const outTime = log.clock_out_time ? new Date(log.clock_out_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--';
      const hours = log.work_hours ? parseFloat(log.work_hours.toString()).toFixed(2) : '0.00';
      const status = log.clock_out_time ? '完成' : '工作中/異常';

      csvContent += `${date},${log.staff_name},${inTime},${outTime},${hours},${status}\n`;
    });

    // 觸發下載
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `薪資考勤_${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* 標題區 */}
      <div className="max-w-5xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">診所薪資管理後台</h1>
          <p className="text-slate-500 text-sm">管理員專用</p>
        </div>
        
        <div className="flex gap-3 bg-white p-2 rounded-xl shadow-sm">
          <div className="flex items-center px-3 border-r">
            <Calendar size={18} className="text-slate-400 mr-2" />
            <input 
              type="month" 
              className="outline-none text-slate-700 bg-transparent"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            <Download size={18} />
            匯出 Excel
          </button>
        </div>
      </div>

      {/* 表格區 */}
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-4 text-sm font-semibold text-slate-500">日期</th>
                <th className="p-4 text-sm font-semibold text-slate-500">員工姓名</th>
                <th className="p-4 text-sm font-semibold text-slate-500">上班</th>
                <th className="p-4 text-sm font-semibold text-slate-500">下班</th>
                <th className="p-4 text-sm font-semibold text-slate-500">工時 (hr)</th>
                <th className="p-4 text-sm font-semibold text-slate-500">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">載入中...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">本月尚無紀錄</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 text-slate-600 font-mono text-sm">
                      {new Date(log.clock_in_time).toLocaleDateString()}
                    </td>
                    <td className="p-4 font-bold text-slate-800">
                      {log.staff_name}
                    </td>
                    <td className="p-4 text-slate-600">
                      {new Date(log.clock_in_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                    </td>
                    <td className="p-4 text-slate-600">
                      {log.clock_out_time ? (
                        new Date(log.clock_out_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
                      ) : (
                        <span className="text-red-400 text-xs">未打卡</span>
                      )}
                    </td>
                    <td className="p-4 font-mono font-bold text-blue-600">
                      {log.work_hours ? parseFloat(log.work_hours.toString()).toFixed(2) : '-'}
                    </td>
                    <td className="p-4">
                      {log.clock_out_time ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                          <CheckCircle size={12} className="mr-1" /> 完成
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 animate-pulse">
                          <AlertCircle size={12} className="mr-1" /> 進行中
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
