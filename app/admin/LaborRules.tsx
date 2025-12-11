'use client';

import React from 'react';
import { BookOpen, AlertTriangle, Calculator, Calendar, Clock } from 'lucide-react';

export default function LaborRulesView() {
  return (
    <div className="max-w-5xl mx-auto p-4 animate-fade-in text-slate-800">
      
      {/* 標題 */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6 rounded-2xl shadow-lg mb-8">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <BookOpen className="text-yellow-400" />
          勞動基準法 考勤與薪資規範 (診所版)
        </h2>
        <p className="text-slate-300 mt-2 text-sm">
          本頁面依據專案規格書整理，僅供排班與算薪參考。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. 基礎定義 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-blue-700">
            <Clock size={20} /> 1. 基礎定義
          </h3>
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex justify-between border-b pb-2">
              <span>基礎工時</span>
              <span className="font-bold text-slate-800">每日 8H / 每週 40H</span>
            </li>
            <li className="flex justify-between border-b pb-2">
              <span>時薪計算 (Base Wage)</span>
              <span className="font-bold text-slate-800">月薪 ÷ 30 ÷ 8</span>
            </li>
            <li className="flex justify-between border-b pb-2">
              <span>休息時間</span>
              <span className="font-bold text-slate-800">連續工作 4H 需休 30分</span>
            </li>
            <li className="flex justify-between pb-2">
              <span>輪班間隔</span>
              <span className="font-bold text-red-600">至少 11 小時</span>
            </li>
          </ul>
        </div>

        {/* 2. 加班費倍率 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-green-700">
            <Calculator size={20} /> 2. 加班費倍率計算
          </h3>
          <div className="space-y-4 text-sm">
            
            <div className="bg-slate-50 p-3 rounded-lg border-l-4 border-blue-500">
              <div className="font-bold text-slate-800 mb-1">A. 平日 (Work Day)</div>
              <div className="flex justify-between"><span>前 2 小時</span> <span className="font-mono font-bold text-blue-600">× 1.34</span></div>
              <div className="flex justify-between"><span>第 3 小時起</span> <span className="font-mono font-bold text-blue-600">× 1.67</span></div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border-l-4 border-orange-500">
              <div className="font-bold text-slate-800 mb-1">B. 休息日 (Rest Day) <span className="text-xs font-normal text-orange-600">(做多少算多少)</span></div>
              <div className="flex justify-between"><span>前 2 小時</span> <span className="font-mono font-bold text-orange-600">× 1.34</span></div>
              <div className="flex justify-between"><span>第 3-8 小時</span> <span className="font-mono font-bold text-orange-600">× 1.67</span></div>
              <div className="flex justify-between"><span>第 9 小時起</span> <span className="font-mono font-bold text-orange-600">× 2.67</span></div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border-l-4 border-red-500">
              <div className="font-bold text-slate-800 mb-1">C. 國定假日 (Holiday)</div>
              <div className="flex justify-between"><span>8 小時內</span> <span className="font-mono font-bold text-red-600">+1 日薪資</span></div>
              <div className="flex justify-between"><span>超過 8 小時</span> <span className="font-mono font-bold text-red-600">比照平日加班</span></div>
            </div>

          </div>
        </div>

        {/* 3. 變形工時 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-purple-700">
            <Calendar size={20} /> 3. 變形工時排班規則
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 font-bold">
                <tr>
                  <th className="p-3 rounded-tl-lg">制度</th>
                  <th className="p-3">適用對象</th>
                  <th className="p-3">每日/總工時上限</th>
                  <th className="p-3 rounded-tr-lg">休假與連鎖限制</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-3 font-bold text-slate-800">正常工時</td>
                  <td className="p-3">一般員工</td>
                  <td className="p-3">8H / 40H (週)</td>
                  <td className="p-3"><span className="text-red-600 font-bold">不得連續工作 &gt; 6 天</span> (7休1)</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-slate-800">2週變形</td>
                  <td className="p-3">適用勞基法行業</td>
                  <td className="p-3">10H / 80H (2週)</td>
                  <td className="p-3"><span className="text-red-600 font-bold">不得連續工作 &gt; 6 天</span> (14休2)</td>
                </tr>
                <tr className="bg-purple-50">
                  <td className="p-3 font-bold text-purple-900">4週變形</td>
                  <td className="p-3 font-bold">醫療保健業 (診所)</td>
                  <td className="p-3">10H / 160H (4週)</td>
                  <td className="p-3"><span className="text-red-600 font-bold">不得連續工作 &gt; 12 天</span> (2週內至少2例假)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. 自動檢測警示 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-red-600">
            <AlertTriangle size={20} /> 4. 系統違規警示 (Validation Alerts)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="border p-3 rounded-lg bg-red-50 border-red-100">
              <div className="font-bold text-red-800 mb-1">錯誤 (Error)</div>
              <ul className="list-disc list-inside text-red-700 space-y-1">
                <li>單日總工時 &gt; 12 小時</li>
                <li>每月加班總時數 &gt; 46 小時</li>
                <li>連續工作天數違規 (6天 或 12天)</li>
              </ul>
            </div>
            <div className="border p-3 rounded-lg bg-yellow-50 border-yellow-100">
              <div className="font-bold text-yellow-800 mb-1">警告 (Warning)</div>
              <ul className="list-disc list-inside text-yellow-700 space-y-1">
                <li>輪班間隔 &lt; 11 小時</li>
                <li>連續工作 4 小時無休息紀錄</li>
                <li>國定假日出勤未加倍薪資</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
