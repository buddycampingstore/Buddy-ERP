/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  AppData, 
  Order, 
  Variant 
} from '../types';
import { 
  TrendingUp, 
  Coins, 
  BadgePercent, 
  ShieldCheck, 
  Package, 
  ShoppingBag, 
  Bookmark, 
  ArrowDownToLine 
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
  Legend, 
  LineChart, 
  Line, 
  CartesianGrid 
} from 'recharts';

interface ReportsViewProps {
  data: AppData;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ data }) => {
  // --- 1. DYNAMIC PROFIT & LOSS CALCULATIONS ---
  // A. Total Store Revenue across all orders
  const totalRevenue = data.orders.reduce((sum, order) => {
    const subTotal = order.items.reduce((acc, item) => acc + item.final_price, 0);
    return sum + (subTotal + (order.shipping_fee || 0) - order.discount);
  }, 0);

  // B. Cost of Goods Sold (COGS) based on snapshotted WAC_at_sale (snapshot is preserved correctly)
  const totalCogs = data.orders.reduce((sum, order) => {
    return sum + order.items.reduce((acc, item) => acc + item.wac_at_sale, 0);
  }, 0);

  // C. Gross Profit
  const grossProfit = totalRevenue - totalCogs;

  // D. Batch shipping/unloading overhead expenses (Overhead in purchase batches)
  const totalOverheadExpense = data.purchaseBatches.reduce((sum, batch) => {
    return sum + batch.shipping_cost + batch.other_cost;
  }, 0);

  // D.1 Order-level actual shipping cost paid by store
  const totalOrderShippingCostsPaid = data.orders.reduce((sum, order) => {
    return sum + (order.shipping_cost || 0);
  }, 0);

  // E. Net Profit (True bottom line)
  const netProfit = grossProfit - totalOverheadExpense - totalOrderShippingCostsPaid;

  // --- 2. STOCK REMAINING VALUE ---
  const activeStockItems = data.stockItems.filter(item => item.status === 'in_stock');
  const inventoryTotalVal = activeStockItems.reduce((sum, item) => sum + item.wac_cost, 0);

  // --- 3. RECHARTS: SALES & EXPENSE MONTH-BY-MONTH ---
  // Collect month keys automatically
  const monthlyDataMap = data.orders.reduce((acc, o) => {
    const month = o.date.substring(0, 7); // e.g. "2026-06"
    const orderTotal = o.items.reduce((total, item) => total + item.final_price, 0) + (o.shipping_fee || 0) - o.discount;
    const orderCogs = o.items.reduce((total, item) => total + item.wac_at_sale, 0) + (o.shipping_cost || 0);
    const orderProfit = orderTotal - orderCogs;

    if (!acc[month]) {
      acc[month] = { sales: 0, profit: 0 };
    }
    acc[month].sales += orderTotal;
    acc[month].profit += orderProfit;

    return acc;
  }, {} as Record<string, { sales: number; profit: number }>);

  // Convert map to array sorted by month key
  const monthlyChartData = (Object.entries(monthlyDataMap) as [string, { sales: number; profit: number }][])
    .map(([month, data]) => ({
      month: month === '2026-06' ? 'มิ.ย. 69' : month,
      'ยอดขาย (บาท)': Math.round(data.sales),
      'กำไรขั้นต้น (บาท)': Math.round(data.profit)
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // --- 4. BRAND PERFORMANCE METRIC ---
  const brandSalesMap = data.orders.reduce((acc, order) => {
    order.items.forEach(item => {
      const variant = data.variants.find(v => v.id === item.variant_id);
      const model = variant ? data.models.find(m => m.id === variant.model_id) : null;
      const brand = model ? data.brands.find(b => b.id === model.brand_id) : null;
      const brandName = brand?.name || 'อิสระ';

      if (!acc[brandName]) {
        acc[brandName] = { sales: 0, qty: 0 };
      }
      acc[brandName].sales += item.final_price;
      acc[brandName].qty += 1;
    });
    return acc;
  }, {} as Record<string, { sales: number; qty: number }>);

  const brandChartData = (Object.entries(brandSalesMap) as [string, { sales: number; qty: number }][]).map(([name, data]) => ({
    name,
    'ยอดขาย': Math.round(data.sales),
    'จำนวนโควตา (ตัว)': data.qty
  }));

  const BRAND_COLORS = ['#0f765e', '#0d9488', '#14b8a6', '#475569', '#64748b'];

  return (
    <div className="space-y-6 animate-fade-in" id="reports-view-container">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between py-2 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight" id="reports-view-title">
            ระบบทำรายงานกำไรขาดทุน & คลังปัญญา
          </h1>
          <p className="text-slate-500 text-sm">วิเคราะห์ข้อมูลรายรับ รายจ่ายสะสม ต้นทุนขาย COGS ค่าขนส่งต่อรอบ และสถิติสต็อกค้าง</p>
        </div>
      </div>

      {/* Real-time Profit & Loss Statement (P&L) Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-lg border border-slate-800 space-y-6" id="p-and-l-statement">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2 text-white">
              <Coins className="w-5 h-5 text-yellow-400" />
              รายงานสรุปงบกำไรขาดทุนเบื้องต้น (Profit & Loss Statement)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">คำนวณฐานตามระบบต้นทุนราคาเฉลี่ยถ่วงน้ำหนักเคลื่อนที่ (Moving WAC)</p>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-300 font-mono py-1 px-3 border border-slate-700 rounded-full">
            แบบสะสม (Cumulative)
          </span>
        </div>

        {/* Dynamic calculation steps row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 pt-2 text-xs">
          
          {/* Node 1: Gross Sales */}
          <div className="space-y-1">
            <span className="text-slate-400 font-medium">1. ยอดขายสะสมปิดบิล (+)</span>
            <h4 className="text-lg md:text-2xl font-mono font-bold text-white">
              ฿{totalRevenue.toLocaleString('th-TH', { minimumFractionDigits: 1 })}
            </h4>
            <p className="text-[10px] text-slate-500">มูลค่ารวมหลังหักรับคืนและลดท้ายบิล</p>
          </div>

          <span className="self-center text-center font-bold text-slate-600 hidden md:inline text-xl">-</span>

          {/* Node 2: COGS */}
          <div className="space-y-1">
            <span className="text-slate-400 font-medium">2. ต้นทุนเก้าอี้ที่ขาย COGS (-)</span>
            <h4 className="text-lg md:text-2xl font-mono font-bold text-slate-400">
              ฿{totalCogs.toLocaleString('th-TH', { minimumFractionDigits: 1 })}
            </h4>
            <p className="text-[10px] text-slate-500">ต้นทุนสินค้า WAC ณ วันเสนอซื้อขาย</p>
          </div>

          <span className="self-center text-center font-bold text-slate-600 hidden md:inline text-xl">=</span>

          {/* Node 3: Gross Profit */}
          <div className="space-y-1">
            <span className="text-slate-400 font-medium">3. กำไรขั้นตุนในใจ (Gross)</span>
            <h4 className="text-lg md:text-2xl font-mono font-bold text-yellow-400">
              ฿{grossProfit.toLocaleString('th-TH', { minimumFractionDigits: 1 })}
            </h4>
            <p className="text-[10px] text-slate-500">อัตรากำไรเฉลี่ย: <strong className="text-yellow-400">{totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0}%</strong></p>
          </div>

        </div>

        {/* Expense deduction strip */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between gap-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            <div className="space-y-1">
              <span className="text-slate-400 font-medium">4. หักค่าโสหุ้ยสะสม (ค่าจัดส่งนำเข้า/ภาษีนำเข้าล็อต) (-)</span>
              <h4 className="text-sm font-semibold text-rose-400 font-mono">
                - ฿{totalOverheadExpense.toLocaleString('th-TH', { minimumFractionDigits: 1 })}
              </h4>
              <p className="text-[10px] italic text-slate-500">ค่าขนส่งและค่าผ่านพิธีการนำเข้าที่บันทึกมากับล็อตซื้อของ</p>
            </div>

            <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
              <span className="text-slate-400 font-medium">4.1 หักค่าจัดส่งพัสดุออเดอร์สะสม (-)</span>
              <h4 className="text-sm font-semibold text-rose-400 font-mono">
                - ฿{totalOrderShippingCostsPaid.toLocaleString('th-TH', { minimumFractionDigits: 1 })}
              </h4>
              <p className="text-[10px] italic text-slate-500">ต้นทุนค่าจัดส่งจริงและค่าแพ็คกล่องส่งถึงมือลูกค้า</p>
            </div>
          </div>

          <div className="text-right border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-6 min-w-[200px]">
            <span className="text-emerald-400 font-bold block mb-1">5. กำไรสุทธิรวม (Net Profit)</span>
            <h3 className={`text-xl md:text-3xl font-extrabold font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
              ฿{netProfit.toLocaleString('th-TH', { minimumFractionDigits: 1 })}
            </h3>
            <span className="text-[10px] text-slate-400">กำไรสุทธิจริงหลังหักต้นทุนและค่าขนส่งสะสม</span>
          </div>
        </div>
      </div>

      {/* Valuation and Graphic charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="reports-detailed-grid">
        
        {/* Sales trends bar chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col" id="rep-trend-chart">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> สรุปผลยอดจำหน่ายรายเดือน
          </h3>

          <div className="h-64 w-full flex-1">
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip formatter={(value) => [`฿${value.toLocaleString()}`]} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="ยอดขาย (บาท)" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="กำไรขั้นต้น (บาท)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                ยังไม่มีวิเคราะห์กำไรขายแยกเดือน
              </div>
            )}
          </div>
        </div>

        {/* Stock holding capital chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col" id="rep-cogs-brand">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-emerald-700" /> ยอดจำหน่ายสะสมแยกตามแบรนด์
          </h3>

          <div className="h-64 w-full flex-1 flex items-center justify-center">
            {brandChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={brandChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="ยอดขาย"
                  >
                    {brandChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={BRAND_COLORS[index % BRAND_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`฿${value.toLocaleString()}`, 'ยอดขายสะสม']} />
                  <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                ไม่มีขายแบรนด์สินค้าย่อยระบุ
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Valuation Warehouse Breakdown */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4" id="rep-warehouse-cogs">
        <div>
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <Package className="w-4.5 h-4.5 text-emerald-700" /> รายละเอียดมูลค่าจมและของเหลือจริงในโกดัง
          </h3>
          <p className="text-xs text-slate-400">ประมาณการมูลค่าคลังสินค้าสะสมจริงแยกตามตัวเลือกย่อยเพื่อดูสภาพคล่อง</p>
        </div>

        <div className="overflow-x-auto">
          {/* Desktop Table View (Hidden on mobile, visible on md and up) */}
          <table className="w-full text-left text-xs text-slate-600 border-collapse hidden md:table">
            <thead>
              <tr className="bg-slate-50 text-slate-400 border-b border-slate-100 font-semibold">
                <th className="py-2.5 px-4 font-semibold">รหัส SKU</th>
                <th className="py-2.5 px-4">ข้อมูลสินค้า (แบรนด์ / รุ่น / สี)</th>
                <th className="py-2.5 px-4 text-right">จำนวนค้างในคลังจริง</th>
                <th className="py-2.5 px-4 text-right">ต้นทุนเฉลี่ย WAC ยืนพื้น</th>
                <th className="py-2.5 px-4 text-right font-semibold text-emerald-800 border-r border-slate-100">ประมาณมูลค่าจมคลังสินค้ารวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.variants.length > 0 ? (
                data.variants.map(v => {
                  const model = data.models.find(m => m.id === v.model_id);
                  const brand = model ? data.brands.find(b => b.id === model.brand_id) : null;
                  const c_val = v.qty_in_stock * v.current_wac;

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/20 text-xs">
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-400">{v.id}</td>
                      <td className="py-3 px-4">
                        <span className="inline-block text-[9px] font-bold bg-slate-100 uppercase border px-1.5 mr-1 py-0.2 rounded text-slate-500">{brand?.name || 'อิสระ'}</span>
                        <strong className="text-slate-800">{model?.name}</strong> - <span>{v.color}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <strong className="text-slate-800">{v.qty_in_stock}</strong> ตัว
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">
                        ฿{v.current_wac.toLocaleString('th-TH', { minimumFractionDigits: 1 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800 bg-emerald-50/10">
                        ฿{c_val.toLocaleString('th-TH', { minimumFractionDigits: 1 })}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-6">ไม่มีข้อมูลสินค้าในระบบคลังพัสดุ</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Mobile Cards View (Visible on mobile only, hidden on md and up) */}
          <div className="md:hidden space-y-3.5">
            {data.variants.length > 0 ? (
              data.variants.map(v => {
                const model = data.models.find(m => m.id === v.model_id);
                const brand = model ? data.brands.find(b => b.id === model.brand_id) : null;
                const c_val = v.qty_in_stock * v.current_wac;

                return (
                  <div key={v.id} className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-100/80 space-y-3">
                    {/* Header line: Brand and Model details */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="text-[9px] font-extrabold bg-slate-200/80 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {brand?.name || 'อิสระ'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            SKU: {v.id}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-xs truncate">
                          {model?.name} <span className="font-normal text-slate-500">- {v.color}</span>
                        </h4>
                      </div>
                    </div>

                    {/* Cost and Stock parameters grid */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-slate-100/50">
                      <div>
                        <span className="text-slate-400 block text-[10px]">จำนวนค้างคลัง</span>
                        <span className="text-slate-700 font-bold">
                          <strong className="text-sm font-extrabold text-slate-800">{v.qty_in_stock}</strong> ตัว
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] text-right">ต้นทุนเฉลี่ย WAC</span>
                        <span className="text-slate-700 font-mono font-semibold block text-right">
                          ฿{v.current_wac.toLocaleString('th-TH', { minimumFractionDigits: 1 })}
                        </span>
                      </div>
                    </div>

                    {/* Total Valued Capital block */}
                    <div className="bg-emerald-50/50 border border-emerald-100/50 p-2 rounded-lg flex justify-between items-center text-[11px] mt-1">
                      <span className="font-semibold text-emerald-800/80">มูลค่าคลังสะสมจริง:</span>
                      <strong className="font-mono font-bold text-emerald-800 text-xs">
                        ฿{c_val.toLocaleString('th-TH', { minimumFractionDigits: 1 })}
                      </strong>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                ไม่มีข้อมูลสินค้าในระบบคลังพัสดุ
              </div>
            )}
          </div>
        </div>

        {/* Sum warehouse valuation total */}
        <div className="bg-slate-50 p-4 border border-slate-150/50 rounded-xl flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-600">มูลค่าสะสมสินทรัพย์รวมคลังสินค้าปัจจุบัน:</span>
          <strong className="text-lg text-emerald-800 font-extrabold font-mono">
            ฿{inventoryTotalVal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </strong>
        </div>
      </div>
    </div>
  );
};
