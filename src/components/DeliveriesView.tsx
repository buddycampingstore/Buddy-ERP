/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  AppDatabase, 
  Delivery, 
  DeliveryStatus, 
  Order 
} from '../types';
import { 
  Truck, 
  MapPin, 
  CheckCircle, 
  Clock, 
  Calendar, 
  Search, 
  Edit2, 
  AlertCircle,
  Hash
} from 'lucide-react';

interface DeliveriesViewProps {
  db: AppDatabase;
  updateDelivery: (orderId: string, updates: Partial<Delivery>) => void;
}

export const DeliveriesView: React.FC<DeliveriesViewProps> = ({ db, updateDelivery }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Track inline editing fields
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [trackingNo, setTrackingNo] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('pending');

  const startEditDelivery = (del: Delivery) => {
    setEditingOrderId(del.order_id);
    setTrackingNo(del.tracking || '');
    setPickupDate(del.pickup_datetime || '');
    setDeliveryStatus(del.status);
  };

  const handleSaveDeliveryInfo = (orderId: string) => {
    updateDelivery(orderId, {
      tracking: trackingNo,
      pickup_datetime: pickupDate,
      status: deliveryStatus
    });
    setEditingOrderId(null);
    alert('อัปเดตข้อมูลการจัดส่งและติดตามพัสดุเรียบร้อย!');
  };

  const filteredDeliveries = db.deliveries.filter(del => {
    const order = db.orders.find(o => o.id === del.order_id);
    
    // Status Filter
    if (statusFilter !== 'all' && del.status !== statusFilter) {
      return false;
    }

    // Search Query (tracking or order ID)
    if (searchQuery.trim()) {
      const searchLow = searchQuery.toLowerCase();
      const matchId = del.order_id.toLowerCase().includes(searchLow);
      const matchTrack = del.tracking.toLowerCase().includes(searchLow);
      return matchId || matchTrack;
    }

    return true;
  });

  const stateIconMap = {
    'pending': <Clock className="w-4 h-4 text-amber-500" />,
    'dispatched': <Truck className="w-4 h-4 text-slate-600" />,
    'delivered': <CheckCircle className="w-4 h-4 text-emerald-500" />
  };

  const statusTextMap = {
    'pending': 'เตรียมการจัดส่ง / รอนัดรับ',
    'dispatched': 'ส่งพัสดุแล้ว / มีผลส่งกลับ',
    'delivered': 'จัดส่งสำเร็จ / รับของเรียบร้อย'
  };

  const statusBgMap = {
    'pending': 'bg-amber-50 text-amber-600 border-amber-100',
    'dispatched': 'bg-slate-50 text-slate-600 border-slate-100',
    'delivered': 'bg-emerald-50 text-emerald-600 border-emerald-100'
  };

  return (
    <div className="space-y-6" id="deliveries-view-container">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between py-2 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight" id="deliveries-view-title">
            ระบบจัดส่งสินค้าเและติดตามพัสดุ
          </h1>
          <p className="text-slate-500 text-sm">บันทึกเลขแทร็กกิ้งนัดหมายรับเก้าอี้กาง อัปสถานะไปรษณีย์ส่งตรงถึงเต็นท์</p>
        </div>
      </div>

      {/* Filter and Search board */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        {/* Search */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl flex-1 max-w-sm text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อผู้รับ, เลขพัสดุ หรือรหัสบิลซื้อขาย..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent outline-hidden w-full text-slate-700 text-xs"
          />
        </div>

        {/* Status Filters Toggle */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-[11px] self-start" id="del-status-group">
          {[
            { id: 'all', label: 'ทั้งหมด' },
            { id: 'pending', label: 'รอดำเนินการ' },
            { id: 'dispatched', label: 'จัดส่งแล้ว' },
            { id: 'delivered', label: 'รับถึงมือแล้ว' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`py-1 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Deliveries Directory Grid */}
      <div className="space-y-4" id="deliveries-list">
        {filteredDeliveries.length > 0 ? (
          filteredDeliveries.map(del => {
            const order = db.orders.find(o => o.id === del.order_id);
            const isEditing = editingOrderId === del.order_id;
            const isPickupType = order?.delivery_type === 'pickup';

            return (
              <div 
                key={del.id} 
                className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row justify-between lg:items-center gap-4 transition-all"
              >
                {/* Left section: Dispatch address, items details */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-400 text-xs text-slate-500">
                      พัสดุบิล: {del.order_id.replace('ord-', '#')}
                    </span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${statusBgMap[del.status]}`}>
                      {statusTextMap[del.status]}
                    </span>
                    {isPickupType ? (
                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" /> นัดมารับหน้าร้าน
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                        <Truck className="w-3 h-3" /> บริการส่งถึงพิกัดปักสมอ
                      </span>
                    )}
                  </div>

                  {/* Shipping Date info */}
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800 text-sm">วันที่บิลสั่งซื้อ: {order?.date}</p>
                  </div>

                  {/* Cargo loaded info */}
                  {order && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] max-w-md">
                      <span className="text-slate-400 block font-semibold mb-1">สิ่งของที่ต้องทำการขนย้าย ({order.items.length} ตัว):</span>
                      <div className="space-y-0.5 text-slate-600 font-medium">
                        {order.items.map((oi, i) => {
                          const variant = db.variants.find(v => v.id === oi.variant_id);
                          const model = variant ? db.models.find(m => m.id === variant.model_id) : null;
                          return (
                            <div key={i}>
                              - {model?.name} ({variant?.color})
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right section: Tracking forms or displays */}
                <div className="min-w-64">
                  {isEditing ? (
                    // Inline editor block inputs
                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-3.5 text-xs animate-slide-up">
                      <h4 className="font-bold text-slate-700">อัปเดตข้อมูลพัสดุ</h4>
                      
                      {!isPickupType ? (
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">พิมพ์เลขพัสดุแทร็คกิ้ง</label>
                          <div className="relative">
                            <Hash className="absolute left-2 top-2.5 w-3.5 h-3.5 text-slate-400" />
                            <input
                              type="text"
                              value={trackingNo}
                              onChange={(e) => setTrackingNo(e.target.value)}
                              placeholder="เช่น TH-9284792-EX"
                              className="w-full text-xs p-1.5 pl-7 bg-white border border-slate-200 rounded-md text-slate-800"
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">วันเวลานัดเก็บสินค้า</label>
                          <input
                            type="datetime-local"
                            value={pickupDate}
                            onChange={(e) => setPickupDate(e.target.value)}
                            className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded-md text-slate-800"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">ปรับเปลี่ยนสถานะส่ง</label>
                        <select
                          value={deliveryStatus}
                          onChange={(e) => setDeliveryStatus(e.target.value as DeliveryStatus)}
                          className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded-md text-slate-800"
                        >
                          <option value="pending">อยู่ระหว่างจัดแพ็ก/เตรียม (Pending)</option>
                          <option value="dispatched">ส่งพัสดุออกไปแล้ว (Dispatched)</option>
                          <option value="delivered">ถึงมือลูกค้าปลายทางเรียบร้อย (Delivered)</option>
                        </select>
                      </div>

                      <div className="flex gap-1.5 justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingOrderId(null)}
                          className="text-[10px] py-1 px-2.5 text-slate-500 hover:bg-slate-200 rounded"
                        >
                          ปิด
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveDeliveryInfo(del.order_id)}
                          className="text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-1 px-3 rounded"
                        >
                          บันทึก
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Display area
                    <div className="space-y-3.5 text-xs text-slate-500 lg:text-right">
                      {!isPickupType ? (
                        <div>
                          <p className="text-[10px] text-slate-400">เลขอ้างอิงขนส่ง tracking</p>
                          {del.tracking ? (
                            <strong className="text-slate-800 font-mono text-sm bg-slate-50 px-2 py-0.5 border border-slate-200 rounded select-all">
                              {del.tracking}
                            </strong>
                          ) : (
                            <span className="text-rose-500 font-semibold italic">ยังไม่มีเลขพัสดุ</span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <p className="text-[10px] text-slate-400">วันนัดรับของหน้าร้าน</p>
                          {del.pickup_datetime ? (
                            <strong className="text-slate-800 font-sans text-xs bg-slate-50 px-2 py-0.5 border border-slate-200 rounded select-all flex items-center gap-1 justify-end">
                              <Calendar className="w-3.5 h-3.5 text-amber-500" /> {new Date(del.pickup_datetime).toLocaleString('th-TH')}
                            </strong>
                          ) : (
                            <span className="text-amber-600 font-semibold italic flex items-center gap-0.5 justify-end">
                              <AlertCircle className="w-3.5 h-3.5" /> โทรนัดหมายเวลา...
                            </span>
                          )}
                        </div>
                      )}

                      <div>
                        <button
                          onClick={() => startEditDelivery(del)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer ml-auto"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> แก้ไขข้อมูลแทร็กกิ้ง
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white p-12 text-center text-slate-400 border border-slate-150 rounded-2xl">
            ไม่มีพัสดุหรือนัดรับในแท็บคัดกรองนี้ขณะนี้
          </div>
        )}
      </div>
    </div>
  );
};
