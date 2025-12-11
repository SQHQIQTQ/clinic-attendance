'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Calculator, Plus, Trash2, DollarSign, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

// --- 設定區 ---
const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- 型別定義 ---
type BonusItem = { name: string; amount: number };

type StaffSettings = {
  id: number;
  name: string;
  salary_mode: 'monthly' | 'hourly'; // 月薪 vs 時薪
  base_salary: number; // 月薪金額 或 時薪金額
  bonuses: BonusItem[]; // 額外加給清單
};

type SalaryReport = {
  staff_name: string;
  salary_mode: string;
  total_work_hours: number;     // 總工時
  regular_hours: number;        // 正常工時 (1.0)
  ot1_hours: number;            // 加班工時 (1.34)
  ot2_hours: number;            // 加班工時 (1.67)
  
  base_pay: number;             // 本薪 (月薪制=底薪, 時薪制=時數x時薪)
  ot_pay: number;               // 加班費總額
  bonus_pay: number;            // 加給總額
  total_pay: number;            // 實發總額
  
  details: { label: string; amount: number }[]; // 詳細明細
};

export default function SalaryPage() {
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [staffList, setStaffList] = useState<StaffSettings[]>([]);
  const [reports, setReports] = useState<SalaryReport[]>([]);
  const [expandedRow, setExpandedRow] = useState<number | null>(null); // 控制哪一行展開看明細

  // 1. 初始化
  useEffect(() => { fetchStaffSettings(); }, []);
  
  // 2. 當月份或設定變更時，重算
  useEffect(() => { 
    if (staffList.length > 0) calculateSalary(); 
  }, [selectedMonth, staffList]);

  const fetchStaffSettings = async () => {
    const { data } = await supabase.from('staff').select('*').order('id');
    if (data) {
      // 確保 bonuses 是陣列
      const formatted = data.map((s: any) => ({
        ...s,
        salary_mode: s.salary_mode || 'hourly',
        base_salary: s.base_salary || 183,
        bonuses: Array.isArray(s.bonuses) ? s.bonuses : []
      }));
      setStaffList(formatted);
    }
  };

  // --- 設定功能區 ---

  const updateStaff = async (id: number, field: string, value: any) => {
    const newList = staffList.map(s => s.id === id ? { ...s, [field]: value } : s);
    setStaffList(newList);
    await supabase.from('staff').update({ [field]: value }).eq('id', id);
  };

  const addBonus = (staffId: number) => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;
    const newBonuses = [...staff.bonuses, { name: '新加給', amount: 0 }];
    updateStaff(staffId, 'bonuses', newBonuses);
  };

  const updateBonus = (staffId: number, index: number, field: 'name' | 'amount', value: any) => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;
    const newBonuses = [...staff.bonuses];
    newBonuses[index] = { ...newBonuses[index], [field]: value };
    updateStaff(staffId, 'bonuses', newBonuses);
  };

  const removeBonus = (staffId: number, index: number) => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;
    const newBonuses = staff.bonuses.filter((_, i) => i !== index);
    updateStaff(staffId, 'bonuses', newBonuses);
  };

  // --- 核心計算引擎 ---

  const calculateSalary = async () => {
    setLoading(true);
    const startDate = `${selectedMonth}-01T00:00:00`;
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextMonth = new Date(y, m, 1).toISOString();

    // 撈取打卡紀錄
    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('*')
      .gte('clock_in_time', startDate)
      .lt('clock_in_time', nextMonth);

    if (!logs) { setLoading(false); return; }

    // 每日歸戶
    const dailyStats: Record<string, number> = {}; 
    logs.forEach((log: any) => {
      const date = log.clock_in_time.split('T')[0];
      const key = `${log.staff_name}_${date}`;
      const hours = log.work_hours ? parseFloat(log.work_hours) : 0;
      dailyStats[key] = (dailyStats[key] || 0) + hours;
    });

    const reportMap: Record<string, SalaryReport> = {};

    Object.keys(dailyStats).forEach(key => {
      const [name, date] = key.split('_');
      const dayTotalHours = dailyStats[key];
      
      const staff = staffList.find(s => s.name === name);
      // 預設值 (如果找不到員工設定)
      const mode = staff?.salary_mode || 'hourly';
      const baseRate = staff?.base_salary || 183;
      
      // 初始化報表
      if (!reportMap[name]) {
        // 計算加給總額
        const totalBonus = staff?.bonuses.reduce((sum, b) => sum + Number(b.amount), 0) || 0;
        
        reportMap[name] = {
          staff_name: name,
          salary_mode: mode,
          total_work_hours: 0,
          regular_hours: 0,
          ot1_hours: 0,
          ot2_hours: 0,
          base_pay: mode === 'monthly' ? baseRate : 0, // 月薪制先給底薪
          ot_pay: 0,
          bonus_pay: totalBonus,
          total_pay: 0,
          details: staff?.bonuses.map(b => ({ label: b.name, amount: Number(b.amount) })) || []
        };
      }

      // --- 勞基法工時分級 ---
      let regH = 0, ot1H = 0, ot2H = 0;
      if (dayTotalHours <= 8) {
        regH = dayTotalHours;
      } else if (dayTotalHours <= 10) {
        regH = 8;
        ot1H = dayTotalHours - 8;
      } else {
        regH = 8;
        ot1H = 2;
        ot2H = dayTotalHours - 10;
      }

      // --- 算錢邏輯 ---
      const rpt = reportMap[name];
      rpt.total_work_hours += dayTotalHours;
      rpt.regular_hours += regH;
      rpt.ot1_hours += ot1H;
      rpt.ot2_hours += ot2H;

      // 計算時薪基準 (月薪制除以240, 時薪制直接用)
      const hourlyRate = mode === 'monthly' ? Math.round(baseRate / 240) : baseRate;

      // 1. 正常工時薪資
      if (mode === 'hourly') {
        rpt.base_pay += (regH * hourlyRate);
      }
      // (月薪制的正常工時已經包在月薪裡了，不用加)

      // 2. 加班費 (1.34 / 1.67)
      const ot1Money = ot1H * hourlyRate * 1.34;
      const ot2Money = ot2H * hourlyRate * 1.67;
      rpt.ot_pay += (ot1Money + ot2Money);
    });

    // 最後加總
    const finalReports = Object.values(reportMap).map(r => {
      r.total_pay = Math.round(r.base_pay + r.ot_pay + r.bonus_pay);
      return r;
    });

    setReports(finalReports);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-800">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
            <DollarSign className="text-green-600"/> 薪資結算中心
          </h1>
          <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
            <Calendar size={18} className="text-slate-500"/>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-bold text-slate-700 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 左側：員工薪資設定 (佔 4 等份) */}
          <div className="lg:col-span-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-700">
              <Calculator size={20} className="text-blue-500"/> 
              薪資結構設定
            </h2>
            <div className="space-y-6">
              {staffList.map(staff => (
                <div key={staff.id} className="p-4 border rounded-xl bg-slate-50 flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold text-lg text-slate-800">{staff.name}</span>
                    <select 
                      value={staff.salary_mode}
                      onChange={(e) => updateStaff(staff.id, 'salary_mode', e.target.value)}
                      className="text-xs p-1 rounded bg-white border"
                    >
                      <option value="monthly">月薪制</option>
                      <option value="hourly">時薪制</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-500 w-20">
                      {staff.salary_mode === 'monthly' ? '基本月薪' : '基本時薪'}
                    </label>
                    <input 
                      type="number" 
                      value={staff.base_salary}
                      onChange={(e) => updateStaff(staff.id, 'base_salary', parseFloat(e.target.value))}
                      className="border p-2 rounded w-full font-mono font-bold text-slate-700 bg-white"
                    />
                  </div>

                  {/* 動態加給區 */}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold">額外加給 (津貼/獎金)</label>
                    {staff.bonuses.map((bonus, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input 
                          type="text" 
                          value={bonus.name}
                          onChange={(e) => updateBonus(staff.id, idx, 'name', e.target.value)}
                          className="border p-1 rounded w-1/2 text-sm"
                          placeholder="項目"
                        />
                        <input 
                          type="number" 
                          value={bonus.amount}
                          onChange={(e) => updateBonus(staff.id, idx, 'amount', parseFloat(e.target.value))}
                          className="border p-1 rounded w-1/3 text-sm"
                          placeholder="金額"
                        />
                        <button onClick={() => removeBonus(staff.id, idx)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => addBonus(staff.id)}
                      className="w-full py-2 border border-dashed border-slate-300 text-slate-400 text-sm rounded hover:bg-slate-100 flex items-center justify-center gap-1"
                    >
                      <Plus size={14}/> 新增項目
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 右側：薪資報表 (佔 8 等份) */}
          <div className="lg:col-span-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h2 className="font-bold text-lg mb-6 text-slate-700">本月薪資試算</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-600 text-sm">
                  <tr>
                    <th className="p-3 rounded-l-lg">員工</th>
                    <th className="p-3">工時統計 (時數)</th>
                    <th className="p-3">本薪</th>
                    <th className="p-3">加班費</th>
                    <th className="p-3">加給</th>
                    <th className="p-3 rounded-r-lg text-right">實發總額</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {reports.map((rpt, idx) => (
                    <React.Fragment key={idx}>
                      <tr className="hover:bg-slate-50 transition">
                        <td className="p-4 font-bold text-slate-800 text-lg">
                          {rpt.staff_name}
                          <span className="block text-xs text-slate-400 font-normal">
                            {rpt.salary_mode === 'monthly' ? '月薪制' : '時薪制'}
                          </span>
                        </td>
                        <td className="p-4 space-y-1">
                          <div className="flex justify-between w-32"><span className="text-slate-500">正常:</span> <span className="font-mono">{rpt.regular_hours.toFixed(1)}</span></div>
                          {rpt.ot1_hours > 0 && <div className="flex justify-between w-32 text-orange-600"><span className="text-xs">加班(1.34):</span> <span className="font-mono">{rpt.ot1_hours.toFixed(1)}</span></div>}
                          {rpt.ot2_hours > 0 && <div className="flex justify-between w-32 text-red-600"><span className="text-xs">加班(1.67):</span> <span className="font-mono">{rpt.ot2_hours.toFixed(1)}</span></div>}
                          <div className="border-t mt-1 pt-1 flex justify-between w-32 font-bold"><span className="text-xs">總計:</span> {rpt.total_work_hours.toFixed(1)}</div>
                        </td>
                        <td className="p-4 font-mono text-slate-700">${rpt.base_pay.toLocaleString()}</td>
                        <td className="p-4 font-mono text-orange-600">
                          {rpt.ot_pay > 0 ? `+ $${Math.round(rpt.ot_pay).toLocaleString()}` : '-'}
                        </td>
                        <td className="p-4 font-mono text-blue-600">
                          {rpt.bonus_pay > 0 ? `+ $${rpt.bonus_pay.toLocaleString()}` : '-'}
                        </td>
                        <td className="p-4 text-right">
                          <span className="font-bold text-xl text-green-700 bg-green-50 px-3 py-1 rounded-lg border border-green-200">
                            ${rpt.total_pay.toLocaleString()}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}>
                            {expandedRow === idx ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                          </button>
                        </td>
                      </tr>
                      {/* 展開的明細列 */}
                      {expandedRow === idx && (
                        <tr className="bg-slate-50">
                          <td colSpan={7} className="p-4">
                            <div className="flex gap-4 text-xs text-slate-500">
                              <div className="bg-white p-3 rounded border">
                                <strong>加班費公式 (時薪基準 ${rpt.salary_mode === 'monthly' ? Math.round(rpt.base_pay/240) : rpt.base_pay}):</strong><br/>
                                ( {rpt.ot1_hours.toFixed(1)} x 1.34 ) + ( {rpt.ot2_hours.toFixed(1)} x 1.67 ) = ${Math.round(rpt.ot_pay).toLocaleString()}
                              </div>
                              {rpt.details.length > 0 && (
                                <div className="bg-white p-3 rounded border">
                                  <strong>加給明細:</strong>
                                  <ul className="list-disc pl-4 mt-1">
                                    {rpt.details.map((d, i) => (
                                      <li key={i}>{d.label}: ${d.amount}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              {reports.length === 0 && <div className="p-10 text-center text-slate-400">請先設定員工薪資並確認本月有打卡紀錄</div>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
