/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  AppData, 
  Variant, 
  PurchaseBatch 
} from '../types';
import { 
  Plus, 
  Trash2, 
  Calendar, 
  DollarSign, 
  Truck, 
  ShieldAlert, 
  Check, 
  Clock, 
  ChevronRight, 
  ChevronDown, 
  Info,
  Image as ImageIcon
} from 'lucide-react';

interface PurchaseViewProps {
  data: AppData;
  addPurchaseBatch: (
    date: string,
    shipping_cost: number,
    other_cost: number,
    items: { variant_id: string; qty: number; unit_price: number }[],
    note?: string
  ) => Promise<string | null>;
}

interface NewBatchItem {
  variant_id: string;
  qty: number;
  unit_price: number;
}

export const PurchaseView: React.FC<PurchaseViewProps> = ({ data, addPurchaseBatch }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  // --- IMAGE LIGHTBOX STATE ---
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');

  // --- FORM STATE ---
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [otherCost, setOtherCost] = useState<number>(0);
  const [note, setNote] = useState('');
  const [items, setItems] = useState<NewBatchItem[]>([
    { variant_id: data.variants[0]?.id || '', qty: 0, unit_price: 1500 }
  ]);

  const optionalNumberInputValue = (value: number) => value === 0 ? '' : value;

  // --- HANDLERS ---
  const handleAddItemRow = () => {
    setItems([
      ...items,
      { variant_id: data.variants[0]?.id || '', qty: 0, unit_price: 1500 }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItemRow = (index: number, field: keyof NewBatchItem, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          [field]: value
        };
      }
      return item;
    }));
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some(item => !item.variant_id || item.qty <= 0 || item.unit_price < 0)) {
      alert('กรุณากรอกข้อมูลรายการสินค้าให้ถูกต้อง (จำนวนต้องมากกว่า 0 และราคาต้นทุนห้ามติดลบ)');
      return;
    }

    try {
      const batchId = await addPurchaseBatch(date, shippingCost, otherCost, items, note);
      if (batchId) {
        alert('บันทึกการรับเข้าเสร็จสิ้น ระบบคำนวณต้นทุนเฉลี่ยเคลื่อนที่ (WAC) และสต็อกพร้อมขายเรียบร้อย!');
        setIsAdding(false);
        // Reset form
        const today = new Date().toISOString().split('T')[0];
        setDate(today);
        setShippingCost(0);
        setOtherCost(0);
        setNote('');
        setItems([{ variant_id: data.variants[0]?.id || '', qty: 0, unit_price: 1500 }]);
      }
    } catch (err: any) {
      alert(`บันทึกรับเข้าไม่สำเร็จ: ${err.message || err}`);
    }
  };

  // --- CALCULATIONS FOR PREVIEW ---
  const totalQty_ใหม่ = items.reduce((sum, i) => sum + i.qty, 0);
  const totalItemCost_ใหม่ = items.reduce((sum, i) => sum + (i.qty * i.unit_price), 0);
  const totalOverhead_ใหม่ = shippingCost + otherCost;
  const actualOverheadPerUnit = totalQty_ใหม่ > 0 ? (totalOverhead_ใหม่ / totalQty_ใหม่) : 0;

  return (
    <div className="space-y-6" id="purchase-view-container">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between py-2 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight" id="purchase-view-title">
            บันทึกรับสินค้าและคำนวณ WAC อัตโนมัติ
          </h1>
          <p className="text-slate-500 text-sm">บันทึกสินค้าเข้าคลัง ดึงค่าขนส่งและค่าโสหุ้ยมารวมเพื่อเฉลี่ยต้นทุนจริง</p>
        </div>
        <div className="mt-2 md:mt-0">
          {!isAdding ? (
            <button
              onClick={() => {
                if (data.variants.length === 0) {
                  alert('กรุณาเพิ่มรายละเอียดสินค้าสี/รุ่นอย่างน้อย 1 รายการในหน้า "สินค้า" ก่อนบันทึกรับเข้า');
                  return;
                }
                setIsAdding(true);
              }}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              id="start-purchase-btn"
            >
              <Plus className="w-4.5 h-4.5" /> บันทึกรับสินค้าล็อตใหม่
            </button>
          ) : (
            <button
              onClick={() => setIsAdding(false)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
            >
              กลับไปดูประวัติรับเข้า
            </button>
          )}
        </div>
      </div>

      {isAdding ? (
        // ================== STATE: ADD BATCH FORM ==================
        <form onSubmit={handleSaveBatch} className="space-y-6 animate-fade-in" id="purchase-form">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: Batch General details */}
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs space-y-4 lg:col-span-1">
              <h3 className="font-bold text-slate-700 text-sm pb-2 border-b border-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-700" /> ข้อมูลทั่วไปของล็อตสินค้า
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">วันที่รับเข้าสินค้า</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs p-3 bg-slate-50 outline-hidden border border-slate-200 rounded-xl focus:border-emerald-700 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">ค่าจัดส่ง / ค่าระวางขนส่ง (บาท)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={shippingCost}
                  onChange={(e) => setShippingCost(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-full text-xs p-3 bg-slate-50 outline-hidden border border-slate-200 rounded-xl focus:border-emerald-700 focus:bg-white text-slate-800 font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">ค่าดำเนินการอื่นๆ / ภาษีต่อล็อต (บาท)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={otherCost}
                  onChange={(e) => setOtherCost(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-full text-xs p-3 bg-slate-50 outline-hidden border border-slate-200 rounded-xl focus:border-emerald-700 focus:bg-white text-slate-800 font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">หมายเหตุการซื้อ</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น สั่งโดยตรง ดำเนินการผ่านชิปปิ้งเจ้าประจำ"
                  rows={3}
                  className="w-full text-xs p-3 bg-slate-50 outline-hidden border border-slate-200 rounded-xl focus:border-emerald-700 focus:bg-white text-slate-800"
                ></textarea>
              </div>

              {/* Live Overhead Indicator */}
              <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>จำนวนสิ่งของรับเข้าทั้งหมด:</span>
                  <span className="font-bold text-slate-700 font-mono">{totalQty_ใหม่} ตัว</span>
                </div>
                <div className="flex justify-between">
                  <span>ค่าโสหุ้ยร่วมตกตัวละ:</span>
                  <span className="font-bold text-emerald-700 font-mono">฿{actualOverheadPerUnit.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Right column: Items selection & live profit preview */}
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs lg:col-span-2 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                    <Truck className="w-4.5 h-4.5 text-emerald-700" />
                    รายการเก้าอี้และต้นทุนโรงงาน
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-emerald-700 hover:text-emerald-800 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มแถวเก้าอี้
                  </button>
                </div>

                {/* Items rows */}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {items.map((item, idx) => {
                    const selectedVariant = data.variants.find(v => v.id === item.variant_id);
                    // Determine cost + overhead
                    const cost_ใหม่_ตัว = item.unit_price + actualOverheadPerUnit;
                    const preWac = selectedVariant?.current_wac || 0;
                    
                    // Forecast new WAC
                    const qty_เดิม_ตัว = data.stockItems.filter(s => s.variant_id === item.variant_id && s.status === 'in_stock').length;
                    const estNewWac = (qty_เดิม_ตัว + item.qty > 0)
                      ? (qty_เดิม_ตัว * preWac + item.qty * cost_ใหม่_ตัว) / (qty_เดิม_ตัว + item.qty)
                      : cost_ใหม่_ตัว;

                    // Resolve hierarchy
                    const currentModel = selectedVariant ? data.models.find(m => m.id === selectedVariant.model_id) : null;
                    const currentBrand = currentModel ? data.brands.find(b => b.id === currentModel.brand_id) : null;

                    const activeBrandId = currentBrand?.id || '';
                    const activeModelId = currentModel?.id || '';
                    const activeVariantId = item.variant_id || '';

                    // Filter cascading levels
                    const modelsForBrand = data.models.filter(m => m.brand_id === activeBrandId);
                    const variantsForModel = data.variants.filter(v => v.model_id === activeModelId);

                    // Re-routing changers
                    const handleBrandChange = (bId: string) => {
                      const brandModels = data.models.filter(m => m.brand_id === bId);
                      const matchedModel = brandModels[0];
                      const modelVariants = matchedModel ? data.variants.filter(v => v.model_id === matchedModel.id) : [];
                      const nextVariantId = modelVariants[0]?.id || '';
                      handleUpdateItemRow(idx, 'variant_id', nextVariantId);
                    };

                    const handleModelChange = (mId: string) => {
                      const modelVariants = data.variants.filter(v => v.model_id === mId);
                      const nextVariantId = modelVariants[0]?.id || '';
                      handleUpdateItemRow(idx, 'variant_id', nextVariantId);
                    };

                    const handleColorChange = (vId: string) => {
                      handleUpdateItemRow(idx, 'variant_id', vId);
                    };

                    return (
                      <div key={idx} className="bg-slate-50/50 p-3 md:p-3.5 border border-slate-100 rounded-xl space-y-3 relative group">
                        <div className="flex flex-col md:flex-row md:items-end gap-3.5">
                          {/* Image Thumbnail Selection Preview */}
                          <div className="shrink-0 flex items-center justify-center" id={`purchase-row-image-container-${idx}`}>
                            {currentModel?.image ? (
                              <img 
                                src={currentModel.image} 
                                className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover border border-slate-200 cursor-zoom-in hover:scale-105 active:scale-95 transition-all duration-150 shadow-xs" 
                                referrerPolicy="no-referrer"
                                title="คลิกเพื่อขยายดูรูปภาพ"
                                onClick={() => {
                                  setPreviewImage(currentModel.image || null);
                                  setPreviewTitle(`${currentBrand?.name || 'เก้าอี้'} ${currentModel.name}`);
                                }}
                              />
                            ) : (
                              <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400">
                                <ImageIcon className="w-5 h-5 mb-0.5 text-slate-300" />
                                <span className="text-[9px] font-sans font-bold">ไม่มีรูป</span>
                              </div>
                            )}
                          </div>

                          <div className="grow w-full grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            {/* Sequential Choose variation cascading options */}
                            <div className="md:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs md:text-[10px] font-semibold text-slate-400 mb-1 uppercase truncate">ยี่ห้อ (Brand)</label>
                                <select
                                  value={activeBrandId}
                                  onChange={(e) => handleBrandChange(e.target.value)}
                                  className="w-full text-xs p-2.5 bg-white outline-hidden border border-slate-200 rounded-lg text-slate-800 focus:border-emerald-700"
                                  required
                                >
                                  <option value="" disabled>-- เลือกยี่ห้อ --</option>
                                  {data.brands.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                  ))}
                                </select>
                              </div>
                              
                              <div>
                                <label className="block text-xs md:text-[10px] font-semibold text-slate-400 mb-1 uppercase truncate">รุ่น (Model)</label>
                                <select
                                  value={activeModelId}
                                  onChange={(e) => handleModelChange(e.target.value)}
                                  className="w-full text-xs p-2.5 bg-white outline-hidden border border-slate-200 rounded-lg text-slate-800 disabled:opacity-50 focus:border-emerald-700"
                                  required
                                  disabled={!activeBrandId}
                                >
                                  <option value="" disabled>-- เลือกรุ่น --</option>
                                  {modelsForBrand.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs md:text-[10px] font-semibold text-slate-400 mb-1 uppercase truncate">สี (Color)</label>
                                <select
                                  value={activeVariantId}
                                  onChange={(e) => handleColorChange(e.target.value)}
                                  className="w-full text-xs p-2.5 bg-white outline-hidden border border-slate-200 rounded-lg text-slate-800 disabled:opacity-50 focus:border-emerald-700"
                                  required
                                  disabled={!activeModelId}
                                >
                                  <option value="" disabled>-- เลือกสี --</option>
                                  {variantsForModel.map(v => (
                                    <option key={v.id} value={v.id}>{v.color}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Order Quantity */}
                            <div className="md:col-span-2">
                              <label className="block text-xs md:text-[10px] font-semibold text-slate-400 mb-1 uppercase truncate">จำนวนสั่งซื้อ (ตัว)</label>
                              <input
                                type="number"
                                min="1"
                                value={optionalNumberInputValue(item.qty)}
                                onChange={(e) => handleUpdateItemRow(idx, 'qty', Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full text-xs p-2.5 md:p-2 bg-white outline-hidden border border-slate-200 rounded-lg text-slate-800 font-mono text-left md:text-center focus:border-emerald-700"
                                required
                              />
                            </div>

                            {/* Factory price */}
                            <div className="md:col-span-2">
                              <label className="block text-xs md:text-[10px] font-semibold text-slate-400 mb-1 uppercase truncate">ราคาทุนโรงงาน/ตัว</label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={optionalNumberInputValue(item.unit_price)}
                                onChange={(e) => handleUpdateItemRow(idx, 'unit_price', Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full text-xs p-2.5 md:p-2 bg-white outline-hidden border border-slate-200 rounded-lg text-slate-800 font-mono text-right focus:border-emerald-700"
                                required
                              />
                            </div>

                            {/* Delete row */}
                            <div className="flex justify-end pt-1 md:pt-0 md:col-span-1 md:justify-center md:items-end">
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                disabled={items.length === 1}
                                className="w-full md:w-auto p-2.5 md:p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-50 border border-slate-200 md:border-none rounded-lg transition-colors cursor-pointer disabled:opacity-30 flex items-center justify-center gap-1.5 text-xs font-semibold"
                                title="ลบแถวสินค้า"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="md:hidden text-rose-500">ลบสินค้าชิ้นนี้</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Cost & WAC preview strip */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-slate-200 pt-2 text-[11px] text-slate-500">
                          <div>
                            ต้นทุนบวกค่าส่งเสร็จสรรพ: <strong className="text-slate-800 font-mono">฿{cost_ใหม่_ตัว.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                          </div>
                          <div>
                            สต็อกเดิมที่มี: <span className="font-semibold text-slate-600">{qty_เดิม_ตัว} ตัว</span>
                            <span className="text-slate-300 mx-1.5">|</span>
                            WAC เดิม: <span className="font-semibold font-mono text-slate-600">฿{preWac.toLocaleString()}</span>
                            <span className="text-slate-300 mx-1.5">➔</span>
                            คาดเดา WAC ใหม่: <strong className="text-emerald-700 font-mono text-xs">฿{estNewWac.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer pricing lock */}
              <div className="pt-6 border-t border-slate-100 mt-6 space-y-4">
                <div className="flex justify-between items-center bg-emerald-50/45 p-4 rounded-xl border border-emerald-100/70">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500">รวมราคาเก้าอี้เปล่าโรงงาน</h4>
                    <span className="font-bold font-mono text-slate-800 text-sm">฿{totalItemCost_ใหม่.toLocaleString()}</span>
                  </div>
                  <div className="text-center font-bold text-slate-300 text-lg">+</div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500">ค่าระวางขนส่ง & ทางการอื่น</h4>
                    <span className="font-bold font-mono text-slate-800 text-sm">฿{totalOverhead_ใหม่.toLocaleString()}</span>
                  </div>
                  <div className="text-center font-bold text-slate-300 text-lg">=</div>
                  <div className="text-right">
                    <h4 className="text-xs text-emerald-800 font-bold subpixel-antialiased">มูลค่าสุทธิรวมทั้งสิ้น (Capital)</h4>
                    <span className="font-extrabold font-mono text-emerald-800 text-base md:text-xl">
                      ฿{(totalItemCost_ใหม่ + totalOverhead_ใหม่).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-5 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl"
                  >
                    ยกเลิกกลับ
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-4.5 h-4.5" /> ยืนยันบันทึกรับเข้าคลัง & อัปเดต WAC
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      ) : (
        // ================== STATE: BATCH HISTORY ==================
        <div className="space-y-4 animate-fade-in" id="purchase-history">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">ประวัติเอกสารรับสินค้า (Purchase Batches)</h3>
              <p className="text-xs text-slate-400">ประวัติการนำเข้ารับสต็อกและการตั้งบันทึกบัญชีของทางร้าน</p>
            </div>
          </div>

          <div className="space-y-3">
            {data.purchaseBatches.length > 0 ? (
              data.purchaseBatches.map(batch => {
                const totalBatchQty = batch.items.reduce((sum, i) => sum + i.qty, 0);
                const itemsSum = batch.items.reduce((sum, i) => sum + (i.qty * i.unit_price), 0);
                const completeCost = itemsSum + batch.shipping_cost + batch.other_cost;
                const isExpanded = expandedBatchId === batch.id;

                return (
                  <div 
                    key={batch.id} 
                    className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden transition-all duration-200"
                  >
                    {/* Header bar click expands details */}
                    <div 
                      onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                      className="p-4 flex items-center justify-between hover:bg-slate-50/50 cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 text-slate-600 rounded-lg font-mono font-bold">
                          PB
                        </div>
                        <div>
                          <div className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                            <span>เลขชุดล็อต: {batch.id.slice(0, 5)}</span>
                            {batch.note && (
                              <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-normal font-sans">
                                {batch.note}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center gap-3">
                            <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> นำเข้าเมื่อ: {batch.date}</span>
                            <span>•</span>
                            <span>นำเข้าเก้าอี้รวม: <strong className="text-slate-600">{totalBatchQty} ตัว</strong></span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400">เงินลงทุนฐาน</p>
                          <p className="font-bold text-slate-800 text-sm">฿{completeCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
                        </div>
                        {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>

                    {/* Expand item rows details */}
                    {isExpanded && (
                      <div className="bg-slate-50/80 p-3.5 md:p-5 border-t border-slate-100 text-xs space-y-4">
                        {/* Costs Summary Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                          <div className="p-2.5 bg-white border border-slate-100/80 rounded-xl shadow-2xs">
                            <span className="block text-[10px] text-slate-400 font-bold mb-0.5">มูลค่าเก้าอี้รวม</span>
                            <span className="font-extrabold font-mono text-slate-800 text-[11px] sm:text-xs">฿{itemsSum.toLocaleString()}</span>
                          </div>
                          <div className="p-2.5 bg-white border border-slate-100/80 rounded-xl shadow-2xs">
                            <span className="block text-[10px] text-slate-400 font-bold mb-0.5">ค่าขนส่งนำเข้า</span>
                            <span className="font-extrabold font-mono text-slate-800 text-[11px] sm:text-xs">฿{batch.shipping_cost.toLocaleString()}</span>
                          </div>
                          <div className="p-2.5 bg-white border border-slate-100/80 rounded-xl shadow-2xs">
                            <span className="block text-[10px] text-slate-400 font-bold mb-0.5">ค่าภาษี/จิปาถะ</span>
                            <span className="font-extrabold font-mono text-slate-800 text-[11px] sm:text-xs">฿{batch.other_cost.toLocaleString()}</span>
                          </div>
                          <div className="p-2.5 bg-emerald-50/60 border border-emerald-100/35 rounded-xl">
                            <span className="block text-[10px] text-emerald-800 font-bold mb-0.5">โสหุ้ยเฉลี่ยสะสม</span>
                            <strong className="text-emerald-800 font-mono text-[11px] sm:text-xs">
                              ฿{((batch.shipping_cost + batch.other_cost) / totalBatchQty).toLocaleString('th-TH', { maximumFractionDigits: 1 })}/ตัว
                            </strong>
                          </div>
                        </div>

                        {/* List items received */}
                        <div className="space-y-2">
                          <h4 className="font-extrabold text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-3 bg-emerald-600 rounded-sm" />
                            รายการเก้าอี้ในล็อตนี้
                          </h4>

                          {/* Desktop View Table */}
                          <div className="hidden md:block bg-white border border-slate-100 rounded-xl overflow-hidden shadow-2xs">
                            <table className="w-full text-left text-xs text-slate-600 border-collapse">
                              <thead>
                                <tr className="bg-slate-50/50 text-slate-400 border-b border-slate-100 font-semibold text-[10px]">
                                  <th className="py-2 px-3">ชื่อสินค้าย่อย (สี)</th>
                                  <th className="py-2 px-3 text-center">จำนวนนำเข้า</th>
                                  <th className="py-2 px-3 text-right">ราคาโรงงาน/ตัว</th>
                                  <th className="py-2 px-3 text-right font-bold text-emerald-800">ต้นทุนสะสมรวมค่าส่ง</th>
                                </tr>
                              </thead>
                              <tbody>
                                {batch.items.map((item, idx) => {
                                  const variant = data.variants.find(v => v.id === item.variant_id);
                                  const model = variant ? data.models.find(m => m.id === variant.model_id) : null;
                                  const brand = model ? data.brands.find(b => b.id === model.brand_id) : null;

                                  const overheadCalculated = (batch.shipping_cost + batch.other_cost) / totalBatchQty;
                                  const cost_loaded = item.unit_price + overheadCalculated;

                                  return (
                                    <tr key={idx} className="border-b last:border-none border-slate-100 hover:bg-slate-50/20">
                                      <td className="py-2.5 px-3 flex items-center gap-2.5">
                                        {model?.image ? (
                                          <img 
                                            src={model.image} 
                                            className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0 cursor-zoom-in hover:scale-110 active:scale-95 transition-transform" 
                                            referrerPolicy="no-referrer"
                                            title="คลิกเพื่อขยายดูรูปภาพ"
                                            onClick={() => {
                                              setPreviewImage(model.image || null);
                                              setPreviewTitle(`${brand?.name || 'เก้าอี้'} ${model.name}`);
                                            }}
                                          />
                                        ) : (
                                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                            <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
                                          </div>
                                        )}
                                        <div className="min-w-0">
                                          <span className="text-slate-400 text-[10px] font-mono mr-1.5 uppercase bg-slate-100 px-1 rounded">{brand?.name || 'อิสระ'}</span>
                                          <strong>{model?.name || 'ไม่ทราบรุ่น'}</strong> - <span>{variant?.color || 'ไม่ทราบสี'}</span>
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-800">
                                        {item.qty} ตัว
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                                        ฿{item.unit_price.toLocaleString()}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 bg-slate-50/10">
                                        ฿{cost_loaded.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Mobile View Card List */}
                          <div className="block md:hidden space-y-2">
                            {batch.items.map((item, idx) => {
                              const variant = data.variants.find(v => v.id === item.variant_id);
                              const model = variant ? data.models.find(m => m.id === variant.model_id) : null;
                              const brand = model ? data.brands.find(b => b.id === model.brand_id) : null;

                              const overheadCalculated = (batch.shipping_cost + batch.other_cost) / totalBatchQty;
                              const cost_loaded = item.unit_price + overheadCalculated;

                              return (
                                <div 
                                  key={idx} 
                                  className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-3 shadow-2xs"
                                  id={`batch-item-mobile-${idx}`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {model?.image ? (
                                      <img 
                                        src={model.image} 
                                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 cursor-zoom-in active:scale-95"
                                        referrerPolicy="no-referrer"
                                        title="คลิกเพื่อขยายดูรูปภาพ"
                                        onClick={() => {
                                          setPreviewImage(model.image || null);
                                          setPreviewTitle(`${brand?.name || 'เก้าอี้'} ${model.name}`);
                                        }}
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                                        <ImageIcon className="w-4 h-4 text-slate-300" />
                                      </div>
                                    )}
                                    <div className="min-w-0 space-y-0.5">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[9px] font-mono font-semibold uppercase bg-slate-100 text-slate-600 px-1 rounded">{brand?.name || 'อิสระ'}</span>
                                        <strong className="text-slate-800 text-[11px] truncate">{model?.name || 'ไม่ทราบรุ่น'}</strong>
                                      </div>
                                      <div className="text-[10px] text-slate-500">
                                        สี: <span className="font-semibold text-slate-700">{variant?.color || 'ไม่ทราบสี'}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0 space-y-0.5">
                                    <div className="text-[10px] text-slate-400">
                                      จำนวน <span className="font-bold text-slate-800 font-mono text-[11px]">{item.qty}</span> ตัว
                                    </div>
                                    <div className="text-[9px] text-slate-400">
                                      ราคา: <span className="font-mono text-slate-600">฿{item.unit_price.toLocaleString()}</span>
                                    </div>
                                    <div className="text-[9px] font-bold text-emerald-800">
                                      ต้นทุนสุทธิ: <span className="font-mono">฿{cost_loaded.toLocaleString('th-TH', { maximumFractionDigits: 1 })}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="bg-white p-12 text-center text-slate-400 border border-slate-150 rounded-2xl">
                ไม่เคยมีประวัติการรับเข้าสินค้าใดๆ
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- IMAGE LIGHTBOX MODAL --- */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-4 z-50 animate-fade-in"
          id="image-lightbox-modal"
          onClick={() => setPreviewImage(null)}
        >
          {/* Top panel: Title & Close Button */}
          <div className="w-full max-w-2xl flex justify-between items-center text-white mb-3 px-1 animate-slide-up">
            <span className="text-xs font-bold bg-emerald-700 text-white px-2.5 py-1 rounded-full uppercase tracking-tight shadow-sm">
              {previewTitle || 'ขยายรูปภาพ'}
            </span>
            <button
              onClick={() => setPreviewImage(null)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center font-bold text-sm transition-all shadow-md cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              ✕
            </button>
          </div>

          {/* Interactive Zoomable Image container */}
          <div 
            className="relative w-full max-w-2xl max-h-[75vh] flex items-center justify-center bg-slate-900/50 rounded-2xl overflow-hidden border border-white/10 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={previewImage} 
              alt={previewTitle}
              className="max-w-full max-h-[75vh] object-contain rounded-2xl select-none"
              referrerPolicy="no-referrer"
            />
          </div>

          <p className="text-[11px] text-white/50 mt-4 animate-slide-up select-none">
            คลิกพื้นที่สีดำรอบนอกเพื่อกลับเข้าสู่หน้าหลัก
          </p>
        </div>
      )}
    </div>
  );
};
