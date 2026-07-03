/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  AppData
} from '../types';
import {
  filterOrdersByYearMonth,
  filterPurchaseBatchesByYearMonth,
  getActiveStockValue,
  getLocalYearMonth,
  getOrderProfit,
  getOrderRevenue,
  getTotalPurchaseCost
} from '../lib/finance';
import { 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  DollarSign, 
  Users, 
  Clock, 
  Truck, 
  TrendingDown 
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';

interface DashboardViewProps {
  data: AppData;
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ data, onNavigate }) => {
  // 1. Inventory Summary
  const totalStockUnits = data.stockItems.filter(item => item.status === 'in_stock').length;
  const totalInventoryCost = getActiveStockValue(data.stockItems);

  // 2. Active Orders (non-delivered, non-pending? Wait! let's say 'pending', 'confirmed', 'shipped' are active/outstanding)
  const outstandingOrders = data.orders.filter(o => o.status !== 'delivered');

  const currentYearMonth = getLocalYearMonth();

  const monthOrders = filterOrdersByYearMonth(data.orders, currentYearMonth);
  const monthSales = monthOrders.reduce((sum, order) => sum + getOrderRevenue(order), 0);

  const monthProfit = monthOrders.reduce((sum, order) => sum + getOrderProfit(order), 0);

  // 4. Monthly Purchase Cost this month
  const monthPurchase = getTotalPurchaseCost(filterPurchaseBatchesByYearMonth(data.purchaseBatches, currentYearMonth));

  // Recent Orders (last 5)
  const recentOrders = [...data.orders]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // Alert: low stock variants (less than 3 items in stock)
  const lowStockVariants = data.variants
    .map(v => {
      const model = data.models.find(m => m.id === v.model_id);
      const brand = model ? data.brands.find(b => b.id === model.brand_id) : null;
      return {
        ...v,
        name: `${brand?.name || ''} ${model?.name || ''} (${v.color})`
      };
    })
    .filter(v => v.qty_in_stock <= 3);

  // Recharts: Sales by Channel
  const channelDataMap = data.orders.reduce((acc, o) => {
    const channelName = o.channel === 'fb' ? 'Facebook' : o.channel === 'ig' ? 'Instagram' : 'อื่นๆ';
    const orderTotal = getOrderRevenue(o);
    acc[channelName] = (acc[channelName] || 0) + orderTotal;
    return acc;
  }, {} as Record<string, number>);

  const channelChartData = Object.entries(channelDataMap).map(([name, value]) => ({
    name,
    value: Math.round(value as number)
  }));

  const COLORS = ['#047857', '#10b981', '#6ee7b7'];

  // Recharts: Sales Trend
  const dailySalesMap = data.orders.reduce((acc, o) => {
    const day = o.date; // YYYY-MM-DD
    const orderTotal = getOrderRevenue(o);
    acc[day] = (acc[day] || 0) + orderTotal;
    return acc;
  }, {} as Record<string, number>);

  const salesTrendData = Object.entries(dailySalesMap)
    .map(([date, amount]) => ({
      date: date.substring(5), // MM-DD
      'ยอดขาย (บาท)': Math.round(amount as number)
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6" id="dashboard-container">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between py-2 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight" id="dashboard-title">
            แดชบอร์ดสรุปผลการทำงาน
          </h1>
          <p className="text-slate-500 text-sm">ภาพรวมข้อมูลคลังสินค้า ยอดขาย และสถานะงานประจำวัน</p>
        </div>
        <div className="mt-2 md:mt-0 text-xs bg-emerald-50 text-emerald-800 font-mono py-1 px-3 rounded-full border border-emerald-100 self-start">
          รอบบัญชีปัจจุบัน: {currentYearMonth}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="kpi-grid">
        {/* Card 1: Monthly Sales */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between" id="kpi-sales">
          <div className="flex justify-between items-start">
            <span className="text-slate-500 text-xs font-medium">ยอดขายเดือนนี้</span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-lg md:text-2xl font-bold text-slate-800">
              ฿{monthSales.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </h3>
            <p className="text-xs text-slate-400 mt-1">ออเดอร์มิถุนายนทั้งหมด</p>
          </div>
        </div>

        {/* Card 2: Monthly Profit */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between" id="kpi-profit">
          <div className="flex justify-between items-start">
            <span className="text-slate-500 text-xs font-medium">กำไรสุทธิเดือนนี้</span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-lg md:text-2xl font-bold ${monthProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              ฿{monthProfit.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </h3>
            <p className="text-xs text-slate-400 mt-1">หักต้นทุน WAC ในบิลเรียบร้อย</p>
          </div>
        </div>

        {/* Card 3: Stock Value */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between" id="kpi-inventory">
          <div className="flex justify-between items-start">
            <span className="text-slate-500 text-xs font-medium">มูลค่าคลังสินค้าปัจุจบัน</span>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-lg md:text-2xl font-bold text-slate-800">
              ฿{totalInventoryCost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              สะสม <span className="font-bold text-amber-600">{totalStockUnits}</span> ตัวในคลัง
            </p>
          </div>
        </div>

        {/* Card 4: Pending Task */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between" id="kpi-pending">
          <div className="flex justify-between items-start">
            <span className="text-slate-500 text-xs font-medium">ออเดอร์รอดำเนินการ</span>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-lg md:text-2xl font-bold text-purple-600">
              {outstandingOrders.length} บิล
            </h3>
            <p className="text-xs text-slate-400 mt-1">ต้องแพ็คจัดส่งหรือรอรับ</p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="charts-grid">
        {/* Trend chart card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs lg:col-span-2 flex flex-col" id="chart-trend-card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-700" />
            แนวโน้มยอดขายรายวัน
          </h3>
          <div className="h-64 w-full flex-1">
            {salesTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip formatter={(value) => [`฿${value.toLocaleString()}`, 'ยอดขาย']} />
                  <Bar dataKey="ยอดขาย (บาท)" fill="#047857" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                ยังไม่มีข้อมูลสั่งซื้อในระบบ
              </div>
            )}
          </div>
        </div>

        {/* Channel break down */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col" id="chart-channel-card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-pink-500" />
            สัดส่วนตามช่องทางขาย
          </h3>
          <div className="h-48 w-full flex-1 flex items-center justify-center">
            {channelChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {channelChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`฿${value.toLocaleString()}`, 'ยอดขาย']} />
                  <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 text-sm">ไม่มีข้อมูลช่องทางขาย</div>
            )}
          </div>
        </div>
      </div>

      {/* Grid for Table Activity & Low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="dashboard-activity-grid">
        {/* Recent Orders Table */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs" id="recent-orders-card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-700" />
              ออเดอร์ล่าสุด
            </h3>
            <button 
              onClick={() => onNavigate('orders')}
              className="text-xs text-emerald-700 hover:underline hover:text-emerald-800 font-medium"
            >
              ดูทั้งหมด
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-medium bg-slate-50/50">
                  <th className="py-2 px-3 rounded-l-lg">รหัสบิล</th>
                  <th className="py-2 px-3">วันที่ / ช่องทาง</th>
                  <th className="py-2 px-3 text-right">ยอดรวม</th>
                  <th className="py-2 px-3 text-center rounded-r-lg">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.length > 0 ? (
                  recentOrders.map(order => {
                    const totalVal = getOrderRevenue(order);
                    
                    // State coloring
                    const statusClassMap = {
                      'pending': 'bg-slate-100 text-slate-600',
                      'confirmed': 'bg-amber-50 text-amber-600 border border-amber-100',
                      'shipped': 'bg-blue-50 text-blue-600 border border-blue-100',
                      'delivered': 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    };

                    const statusTextMap = {
                      'pending': 'รอยืนยัน',
                      'confirmed': 'แพ็คแล้ว/พร้อมส่ง',
                      'shipped': 'ส่งแล้ว',
                      'delivered': 'สำเร็จ'
                    };

                    return (
                      <tr key={order.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-mono text-[10px] font-semibold text-slate-500">
                          {order.id.replace('ord-', '#')}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-700">{order.date}</div>
                          <div className="text-[10px] text-slate-400">ผ่าน {order.channel === 'fb' ? 'Facebook' : order.channel === 'ig' ? 'Instagram' : 'อื่นๆ'}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-800">
                          ฿{totalVal.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${statusClassMap[order.status]}`}>
                            {statusTextMap[order.status]}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400">ยังไม่มีรายการเสนอขาย</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs" id="low-stock-card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-500" />
            แจ้งเตือนสต็อกเหลือน้อย (≤ 3 ตัว)
          </h3>
          {lowStockVariants.length > 0 ? (
            <div className="space-y-3">
              {lowStockVariants.map(variant => (
                <div 
                  key={variant.id} 
                  className="flex items-center justify-between p-3 bg-rose-50/40 border border-rose-100/50 rounded-xl"
                >
                  <div className="text-xs">
                    <p className="font-medium text-slate-800">{variant.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">ID: {variant.id}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-rose-600 font-semibold text-sm">
                      {variant.qty_in_stock} ตัว
                    </span>
                    <button 
                      onClick={() => onNavigate('purchase')}
                      className="block text-[10px] text-emerald-700 hover:text-emerald-800 underline font-medium mt-0.5"
                    >
                      สั่งซื้อรับเข้าเพิ่ม
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-100">
              <Package className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs">แฮปปี้คุณมีสต็อกเก้าอี้เพียงพอทุกโมเดล!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
