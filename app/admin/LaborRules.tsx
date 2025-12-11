'use client';

import React from 'react';
import { BookOpen, AlertTriangle, Calculator, Calendar, Clock, Plane, Scale } from 'lucide-react';

export default function LaborRulesView() {
  return (
    <div className="max-w-6xl mx-auto p-4 animate-fade-in text-slate-800">
      
      {/* 標題 */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6 rounded-2xl shadow-lg mb-8">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <BookOpen className="text-yellow-400" />
          勞動基準法 考勤與薪資規範 (診所版)
        </h2>
        <p className="text-slate-300 mt-2 text-sm">
          本頁面依據台灣《勞動基準法》編纂，僅供排班與算薪參考。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. 基礎定義 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-blue-700">
            <Clock size={20} /> 1. 基礎工時定義
          </h3>
          <ul className="space-y-4 text-sm text-slate-600">
            <li className="flex justify-between border-b pb-2">
              <div>
                <div className="font-bold text-slate-800">正常工時</div>
                <div className="text-xs text-slate-400">勞基法第 30 條第 1 項</div>
              </div>
              <span className="font-bold text-slate-800">每日 8H / 每週 40H</span>
            </li>
            <li className="flex justify-between border-b pb-2">
              <div>
                <div className="font-bold text-slate-800">休息時間</div>
                <div className="text-xs text-slate-400">勞基法第 35 條</div>
              </div>
              <span className="font-bold text-slate-800">連續工作 4H 需休 30分</span>
            </li>
            <li className="flex justify-between border-b pb-2">
              <div>
                <div className="font-bold text-slate-800">輪班間隔</div>
                <div className="text-xs text-slate-400">勞基法第 34 條第 2 項</div>
              </div>
              <span className="font-bold text-red-600">更換班次時，至少休息 11 小時</span>
            </li>
            <li className="flex justify-between pb-2">
              <div>
                <div className="font-bold text-slate-800">工資計算基礎 (平日每小時)</div>
                <div className="text-xs text-slate-400">勞基法第 24 條 (推算)</div>
              </div>
              <span className="font-bold text-slate-800">月薪總額 ÷ 30 ÷ 8</span>
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
              <div className="flex justify-between items-center mb-1">
                <div className="font-bold text-slate-800">A. 平日延長工時</div>
                <div className="text-[10px] text-slate-400">勞基法第 24 條第 1 項</div>
              </div>
              <div className="flex justify-between"><span>前 2 小時</span> <span className="font-mono font-bold text-blue-600">× 1.34 (4/3)</span></div>
              <div className="flex justify-between"><span>第 3 小時起</span> <span className="font-mono font-bold text-blue-600">× 1.67 (5/3)</span></div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border-l-4 border-orange-500">
              <div className="flex justify-between items-center mb-1">
                <div className="font-bold text-slate-800">B. 休息日出勤 <span className="text-xs font-normal text-orange-600">(做多少算多少)</span></div>
                <div className="text-[10px] text-slate-400">勞基法第 24 條第 2 項</div>
              </div>
              <div className="flex justify-between"><span>前 2 小時</span> <span className="font-mono font-bold text-orange-600">× 1.34</span></div>
              <div className="flex justify-between"><span>第 3-8 小時</span> <span className="font-mono font-bold text-orange-600">× 1.67</span></div>
              <div className="flex justify-between"><span>第 9 小時起</span> <span className="font-mono font-bold text-orange-600">× 2.67</span></div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border-l-4 border-red-500">
              <div className="flex justify-between items-center mb-1">
                <div className="font-bold text-slate-800">C. 國定假日/例假出勤</div>
                <div className="text-[10px] text-slate-400">勞基法第 39 條</div>
              </div>
              <div className="flex justify-between"><span>8 小時內</span> <span className="font-mono font-bold text-red-600">加發 1 日工資</span></div>
              <div className="flex justify-between"><span>超過 8 小時</span> <span className="font-mono font-bold text-red-600">比照平日加班 (1.34/1.67)</span></div>
            </div>

          </div>
        </div>

        {/* 3. 變形工時 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-purple-700">
            <Calendar size={20} /> 3. 變形工時排班規則 <span className="text-sm font-normal text-gray-400 ml-2">(勞基法第 30 條之 1)</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 font-bold">
                <tr>
                  <th className="p-3 rounded-tl-lg">制度</th>
                  <th className="p-3">適用對象</th>
                  <th className="p-3">每日/總工時上限</th>
                  <th className="p-3 rounded-tr-lg">休假與連鎖限制 (例假+休息日)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-3 font-bold text-slate-800">正常工時</td>
                  <td className="p-3">一般員工</td>
                  <td className="p-3">8H / 40H (週)</td>
                  <td className="p-3"><span className="text-red-600 font-bold">不得連續工作 &gt; 6 天</span> (每7日至少1例1休)</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-slate-800">2週變形</td>
                  <td className="p-3">適用勞基法行業</td>
                  <td className="p-3">10H / 80H (2週)</td>
                  <td className="p-3"><span className="text-red-600 font-bold">不得連續工作 &gt; 6 天</span> (每2週至少2例2休)</td>
                </tr>
                <tr className="bg-purple-50">
                  <td className="p-3 font-bold text-purple-900">4週變形</td>
                  <td className="p-3 font-bold">醫療保健業 (診所)</td>
                  <td className="p-3">10H / 160H (4週)</td>
                  <td className="p-3"><span className="text-red-600 font-bold">不得連續工作 &gt; 12 天</span> (每2週至少2例假)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. 特別休假 (New!) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-teal-700">
            <Plane size={20} /> 4. 特別休假規定 (Annual Leave) <span className="text-sm font-normal text-gray-400 ml-2">(勞基法第 38 條)</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 左邊：天數對照表 */}
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-teal-50 text-teal-900 font-bold">
                  <tr>
                    <th className="p-3">工作年資 (繼續工作滿)</th>
                    <th className="p-3 text-right">特休天數</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  <tr><td className="p-3">6個月 以上 ～ 未滿 1年</td><td className="p-3 text-right font-bold">3 日</td></tr>
                  <tr><td className="p-3">1年 以上 ～ 未滿 2年</td><td className="p-3 text-right font-bold">7 日</td></tr>
                  <tr><td className="p-3">2年 以上 ～ 未滿 3年</td><td className="p-3 text-right font-bold">10 日</td></tr>
                  <tr><td className="p-3">3年 以上 ～ 未滿 5年</td><td className="p-3 text-right font-bold">14 日</td></tr>
                  <tr><td className="p-3">5年 以上 ～ 未滿 10年</td><td className="p-3 text-right font-bold">15 日</td></tr>
                  <tr><td className="p-3">10年 以上</td><td className="p-3 text-right font-bold">每1年加1日 (上限30日)</td></tr>
                </tbody>
              </table>
            </div>

            {/* 右邊：相關規定 */}
            <div className="space-y-4 text-sm text-slate-700">
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Scale size={16}/> 未休折算工資 (第 38 條第 4 項)
                </div>
                <p>
                  年度終結或契約終止而未休之日數，雇主應發給工資。
                  <br/><br/>
                  <span className="text-xs text-slate-500">
                    * 經勞雇雙方協商遞延至次一年度實施者，於次一年度終結或契約終止仍未休之日數，雇主應發給工資。
                  </span>
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Scale size={16}/> 年資計算 (第 84-2 條)
                </div>
                <p>
                  勞工工作年資自受僱之日起算。
                  <br/>
                  留職停薪期間，得不併入工作年資計算 (除非勞資雙方另有約定)。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 5. 系統違規警示 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-red-600">
            <AlertTriangle size={20} /> 5. 系統排班自動檢測邏輯
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="border p-3 rounded-lg bg-red-50 border-red-100">
              <div className="font-bold text-red-800 mb-1">錯誤 (Error) - 禁止排班</div>
              <ul className="list-disc list-inside text-red-700 space-y-1">
                <li>單日總工時 &gt; 12 小時 (勞基法第 32 條)</li>
                <li>每月加班總時數 &gt; 46 小時 (勞基法第 32 條)</li>
                <li>連續工作天數違規 (第 36 條: 7休1 / 14休2 / 4週變形)</li>
              </ul>
            </div>
            <div className="border p-3 rounded-lg bg-yellow-50 border-yellow-100">
              <div className="font-bold text-yellow-800 mb-1">警告 (Warning) - 需注意</div>
              <ul className="list-disc list-inside text-yellow-700 space-y-1">
                <li>輪班間隔 &lt; 11 小時 (勞基法第 34 條)</li>
                <li>連續工作 4 小時無休息紀錄 (勞基法第 35 條)</li>
                <li>國定假日出勤未加倍薪資 (勞基法第 39 條)</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
