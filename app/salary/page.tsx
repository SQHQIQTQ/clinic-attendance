'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Calculator, Save, DollarSign, Calendar } from 'lucide-react';

// --- Supabase 設定 ---
const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

type StaffSalary = {
  id: number;
  name: string;
  hourly_wage: number;
  salary_type: 'standard' | 'flat'; // standard=勞基法, flat=固定時薪
};

type SalaryReport = {
  staff_name: string;
  total_hours: number;
  regular_pay: number; // 正常工時薪資
  ot_pay: number;      // 加班費
  total_pay: number;   // 總薪資
  detail: string;      // 計算公式說明
};

export default function SalaryPage() {
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [staffList, setStaffList] = useState<StaffSalary[]>([]);
  const [reports, setReports] = useState<SalaryReport[]>([]);

  // 1. 初始化：抓取員工名單與設定
  useEffect(() => {
    fetchStaffSettings();
  }, []);

  // 2. 當月份或員工設定改變時，重新計算薪資
  useEffect(() => {
    if (staffList.length > 0) {
      calculateSalary();
    }
  }, [selectedMonth, staffList]);

  const fetchStaffSettings = async () => {
    const { data } = await supabase.from('staff').select('id, name, hourly_wage, salary_type').order('id');
    // @ts-ignore
    if (data) setStaffList(data);
  };

  // 3. 更新員工時薪設定
  const updateStaffSetting = async (id: number, field: string, value: any) => {
    // 先更新畫面 (讓UI反應快)
    setStaffList(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    
    // 再寫入資料庫
    await supabase.from('staff').update({ [field]: value }).eq('id', id);
  };

  // 4. 核心：薪資計算引擎
  const calculateSalary = async () => {
    setLoading(true);
    const startDate = `${selectedMonth}-01T00:00:00`;
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextMonth = new Date(y, m, 1).toISOString();

    // A. 抓打卡紀錄
    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('*')
      .gte('clock_in_time', startDate)
      .lt('clock_in_time', nextMonth);

    if (!logs) { setLoading(false); return; }

    // B. 每日歸戶 (同一個人同一天要加總)
    const dailyStats: Record<string, number> = {}; 
    logs.forEach((log: any) => {
      const date = log.clock_in_time.split('T')[0];
      const key = `${log.staff_name}_${date}`;
      const hours = log.work_hours ? parseFloat(log.work_hours) : 0;
      dailyStats[key] = (dailyStats[key] || 0) + hours;
    });

    // C. 依據員工設定算錢
    const reportMap: Record<string, SalaryReport> = {};

    Object.keys(dailyStats).forEach(key => {
      const [name, date] = key.split('_');
      const hours = dailyStats[key];
      
      // 找到這位員工的設定
      const staff = staffList.find(s => s.name === name);
      const wage = staff?.hourly_wage || 183;
      const type = staff?.salary_type || 'standard';

      // 初始化報表項目
      if (!reportMap[name]) {
        reportMap[name] = { staff_name: name, total_hours: 0, regular_pay: 0, ot_pay: 0, total_pay: 0, detail: '' };
      }

      // --- 算法開始 ---
      let dailyPay = 0;
      let regular = 0;
      let ot = 0;

      if (type === 'flat') {
        // 簡單模式：時薪 x 時數 (不管加班)
        dailyPay = hours * wage;
        regular = dailyPay;
      } else {
        // 勞基法模式：前8正常，9-10(x1.34)，11+(x1.67)
        if (hours <= 8) {
          dailyPay = hours * wage;
          regular = dailyPay;
        } else if (hours <= 10) {
          const otHours = hours - 8;
          regular = 8 * wage;
          ot = otHours * wage * 1.34;
          dailyPay = regular + ot;
        } else {
          const ot1 = 2; // 第9,10小時
          const ot2 = hours - 10; // 第11+小時
          regular = 8 * wage;
          ot = (ot1 * wage * 1.34) + (ot2 * wage * 1.67);
          dailyPay = regular + ot;
        }
      }

      // 累加到總報表
      reportMap[name].total_hours += hours;
      reportMap[name].regular_pay += regular;
      reportMap[name].ot_pay += ot;
      reportMap[name].total_pay += dailyPay;
    });

    setReports(Object.values(reportMap));
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-slate-800">
      <div className="max-w-6xl mx-auto">
        
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <DollarSign className="text-green-600"/> 薪資計算中心
        </h1>

        {/* 區塊 1: 員工薪資設定 */}
        <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-200">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Calculator size={20} className="text-blue-500"/> 
            員工時薪設定
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staffList.map(staff => (
              <div key={staff.id} className="p-4 border rounded-lg bg-slate-50 flex flex-col gap-3">
                <div className="font-bold text-lg">{staff.name}</div>
                
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500 w-16">時薪 $</label>
                  <input 
                    type="number" 
                    value={staff.hourly_wage}
                    onChange={(e) => updateStaffSetting(staff.id, 'hourly_wage', parseFloat(e.target.value))}
                    className="border p-1 rounded w-full font-mono font-bold text-slate-700"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500 w-16">模式</label>
                  <select 
                    value={staff.salary_type}
                    onChange={(e) => updateStaffSetting(staff.id, 'salary_type', e.target.value)}
                    className="border p-1 rounded w-full text-sm bg-white"
                  >
                    <option value="standard">勞基法 (有加班費)</option>
                    <option value="flat">固定制 (無加成)</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 區塊 2: 薪資試算報表 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Calendar size={20} className="text-orange-500"/>
              薪資試算表
            </h2>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border p-2 rounded-lg bg-gray-50 font-bold text-slate-700"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="p-4 text-sm text-gray-500">員工姓名</th>
                  <th className="p-4 text-sm text-gray-500">總工時</th>
                  <th className="p-4 text-sm text-gray-500">基本薪資</th>
                  <th className="p-4 text-sm text-gray-500">加班費 (1.34/1.67)</th>
                  <th className="p-4 text-sm text-gray-500 font-bold text-black">應發總額</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.map((rpt, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-4 font-bold text-slate-700">{rpt.staff_name}</td>
                    <td className="p-4 font-mono">{rpt.total_hours.toFixed(1)} hr</td>
                    <td className="p-4 font-mono text-gray-600">${Math.round(rpt.regular_pay).toLocaleString()}</td>
                    <td className="p-4 font-mono text-orange-600">
                      {rpt.ot_pay > 0 ? `+ $${Math.round(rpt.ot_pay).toLocaleString()}` : '-'}
                    </td>
                    <td className="p-4 font-mono font-bold text-green-700 text-lg">
                      ${Math.round(rpt.total_pay).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-400">本月尚無資料</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
