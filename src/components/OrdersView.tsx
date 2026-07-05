/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AppData,
  Customer,
  OrderChannel,
  OrderStatus,
  Delivery,
  DeliveryStatus,
  DeliveryType,
  OrderPageFilters
} from '../types';
import { getOrderProfit, getOrderRevenue, getOrderSubtotal } from '../lib/finance';
import {
  Plus,
  Trash2,
  Percent,
  Clock,
  CheckCircle,
  Truck,
  Check,
  UserPlus,
  TrendingUp,
  Search,
  Calendar,
  ShoppingBag,
  Users,
  Image as ImageIcon
} from 'lucide-react';

interface OrdersViewProps {
  data: AppData;
  addCustomer: (customerData: Omit<Customer, 'id'>) => Promise<Customer>;
  updateCustomer: (id: string, customerData: Omit<Customer, 'id'>) => Promise<void>;
  createOrder: (orderData: {
    customer_id?: string | null;
    customer_name_snapshot?: string;
    date: string;
    channel: OrderChannel;
    status: OrderStatus;
    delivery_type: DeliveryType;
    discount: number;
    items: { variant_id: string; qty: number; sale_price: number; discount: number }[];
    shipping_fee?: number;
    shipping_cost?: number;
  }) => Promise<string>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  updateDelivery: (orderId: string, updates: Partial<Delivery>) => Promise<void>;
  orderFilters: OrderPageFilters;
  setOrderFilters: (filters: OrderPageFilters) => void;
  loadMoreOrders: () => Promise<void>;
  ordersHasMore: boolean;
  ordersTotalCount: number;
  loadingOrders: boolean;
}

interface NewOrderItem {
  variant_id: string;
  qty: number;
  sale_price: number;
  discount: number;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  data,
  addCustomer,
  updateCustomer,
  createOrder,
  updateOrderStatus,
  deleteOrder,
  updateDelivery,
  orderFilters,
  setOrderFilters,
  loadMoreOrders,
  ordersHasMore,
  ordersTotalCount,
  loadingOrders
}) => {
  void updateCustomer;

  const brandById = React.useMemo(() => new Map(data.brands.map((brand) => [brand.id, brand])), [data.brands]);
  const modelById = React.useMemo(() => new Map(data.models.map((model) => [model.id, model])), [data.models]);
  const variantById = React.useMemo(() => new Map(data.variants.map((variant) => [variant.id, variant])), [data.variants]);
  const deliveryByOrderId = React.useMemo(() => new Map(data.deliveries.map((delivery) => [delivery.order_id, delivery])), [data.deliveries]);
  const stockQtyByVariantId = React.useMemo(
    () => new Map(data.stockSummary.map((item) => [item.variant_id, item.in_stock_qty])),
    [data.stockSummary]
  );

  const activeBrands = React.useMemo(
    () => data.brands.filter((brand) => brand.is_active !== false),
    [data.brands]
  );
  const activeModels = React.useMemo(
    () => data.models.filter((model) => {
      const brand = brandById.get(model.brand_id);
      return model.is_active !== false && brand?.is_active !== false;
    }),
    [brandById, data.models]
  );
  const activeVariants = React.useMemo(
    () => data.variants.filter((variant) => {
      const model = modelById.get(variant.model_id);
      const brand = model ? brandById.get(model.brand_id) : null;
      return variant.is_active !== false && model?.is_active !== false && brand?.is_active !== false;
    }),
    [brandById, data.variants, modelById]
  );
  const activeModelsByBrand = React.useMemo(() => {
    const grouped = new Map<string, typeof activeModels>();
    activeModels.forEach((model) => {
      const list = grouped.get(model.brand_id) || [];
      list.push(model);
      grouped.set(model.brand_id, list);
    });
    return grouped;
  }, [activeModels]);
  const activeVariantsByModel = React.useMemo(() => {
    const grouped = new Map<string, typeof activeVariants>();
    activeVariants.forEach((variant) => {
      const list = grouped.get(variant.model_id) || [];
      list.push(variant);
      grouped.set(variant.model_id, list);
    });
    return grouped;
  }, [activeVariants]);

  const [isAdding, setIsAdding] = useState(false);
  const [searchDraft, setSearchDraft] = useState(orderFilters.search);
  const [editingDeliveryOrderId, setEditingDeliveryOrderId] = useState<string | null>(null);
  const [trackingNo, setTrackingNo] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('pending');

  // --- IMAGE LIGHTBOX STATE ---
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');

  React.useEffect(() => {
    setSearchDraft(orderFilters.search);
  }, [orderFilters.search]);

  React.useEffect(() => {
    const nextSearch = searchDraft.trim();
    if (nextSearch === orderFilters.search) return;

    const timer = window.setTimeout(() => {
      setOrderFilters({ status: orderFilters.status, search: nextSearch });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [orderFilters.search, orderFilters.status, searchDraft, setOrderFilters]);

  // --- NEW SALES ORDER FORM STATE ---
  const [customerId, setCustomerId] = useState('general');
  const [date, setDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [channel, setChannel] = useState<OrderChannel>('fb');
  const [status, setStatus] = useState<OrderStatus>('confirmed');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('shipping');
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerDraft, setCustomerDraft] = useState<Omit<Customer, 'id'>>({
    name: '',
    phone: '',
    facebook: '',
    note: ''
  });
  const [items, setItems] = useState<NewOrderItem[]>([
    { variant_id: '', qty: 1, sale_price: 2200, discount: 0 }
  ]);

  const numberInputValue = (value: number) => value === 0 ? '' : value;

  const startEditDelivery = (orderId: string) => {
    const delivery = deliveryByOrderId.get(orderId);
    setEditingDeliveryOrderId(orderId);
    setTrackingNo(delivery?.tracking || '');
    setPickupDate(delivery?.pickup_datetime || '');
    setDeliveryStatus(delivery?.status || 'pending');
  };

  const handleSaveDeliveryInfo = async (orderId: string) => {
    try {
      await updateDelivery(orderId, {
        tracking: trackingNo,
        pickup_datetime: pickupDate,
        status: deliveryStatus
      });
      setEditingDeliveryOrderId(null);
      alert('อัปเดตข้อมูลจัดส่งเรียบร้อยแล้ว');
    } catch (err: any) {
      alert(`อัปเดตข้อมูลจัดส่งไม่สำเร็จ: ${err.message || err}`);
    }
  };

  // Set first variant as default on open
  React.useEffect(() => {
    if (isAdding && activeVariants.length > 0 && !items[0].variant_id) {
      const v0 = activeVariants[0];
      const defaultPrice = (v0 && v0.standard_sale_price !== undefined) ? v0.standard_sale_price : 2200;
      setItems([{ variant_id: v0.id, qty: 1, sale_price: defaultPrice, discount: 0 }]);
    }
  }, [isAdding, activeVariants, items]);

  // --- FORM HANDLERS ---
  const handleAddItemRow = () => {
    const firstId = activeVariants[0]?.id || '';
    const v = variantById.get(firstId);
    const defaultPrice = (v && v.standard_sale_price !== undefined) ? v.standard_sale_price : 2200;
    setItems([...items, { variant_id: firstId, qty: 1, sale_price: defaultPrice, discount: 0 }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItemRow = (index: number, field: keyof NewOrderItem, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i === index) {
        const updated = {
          ...item,
          [field]: value
        };
        // Auto-fill standard sale price when variant is selected
        if (field === 'variant_id') {
          const v = variantById.get(value);
          if (v && v.standard_sale_price !== undefined) {
            updated.sale_price = v.standard_sale_price;
          }
        }
        return updated;
      }
      return item;
    }));
  };

  const handleSaveCustomer = async () => {
    if (!customerDraft.name.trim()) {
      alert('กรุณากรอกชื่อลูกค้า');
      return;
    }

    setSavingCustomer(true);
    try {
      const created = await addCustomer(customerDraft);
      setCustomerId(created.id);
      setCustomerDraft({ name: '', phone: '', facebook: '', note: '' });
      setShowCustomerForm(false);
    } catch (err: any) {
      alert(`สร้างลูกค้าไม่สำเร็จ: ${err.message || err}`);
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some(item => !item.variant_id)) {
      alert('กรุณาเลือกโมเดลเก้าอี้และตัวเลือกสินค้าให้ครบทุกแถว');
      return;
    }
    if (items.some(item => item.qty <= 0 || item.sale_price < 0 || item.discount < 0 || item.discount > item.sale_price)) {
      alert('กรุณาตรวจจำนวน ราคา และส่วนลดของสินค้าแต่ละรายการ');
      return;
    }

    try {
      const selectedCustomer = data.customers.find(customer => customer.id === customerId);
      await createOrder({
        customer_id: customerId === 'general' ? null : customerId,
        customer_name_snapshot: selectedCustomer?.name || 'ลูกค้าทั่วไป',
        date,
        channel,
        status,
        delivery_type: deliveryType,
        discount: globalDiscount,
        items,
        shipping_fee: deliveryType === 'shipping' ? shippingFee : 0,
        shipping_cost: deliveryType === 'shipping' ? shippingCost : 0
      });

      alert('เปิดบันทึกปิดการขายสร้างออเดอร์เรียบร้อย!');
      setIsAdding(false);
      // Reset form defaults
      setCustomerId('general');
      setDate(new Date().toISOString().split('T')[0]);
      setChannel('fb');
      setStatus('confirmed');
      setDeliveryType('shipping');
      setGlobalDiscount(0);
      setShippingFee(0);
      setShippingCost(0);
      const defaultVariant = activeVariants[0];
      const defaultPrice = (defaultVariant && defaultVariant.standard_sale_price !== undefined) ? defaultVariant.standard_sale_price : 2200;
      setItems([{ variant_id: defaultVariant?.id || '', qty: 1, sale_price: defaultPrice, discount: 0 }]);
    } catch (err: any) {
      alert(`ไม่สามารถเปิดใบสั่งซื้อได้: ${err.message || err}`);
    }
  };

  // --- REAL-TIME CALCULATIONS ---
  const calculatedItems = items.map(item => {
    const variant = variantById.get(item.variant_id);
    const stockOnHand = stockQtyByVariantId.get(item.variant_id) || 0;
    const wac = variant?.current_wac || 0;
    const itemTotal = (item.sale_price - item.discount) * item.qty;
    const costBasisTotal = wac * item.qty;
    const profitTotal = itemTotal - costBasisTotal;

    return {
      ...item,
      wac,
      itemTotal,
      profitTotal,
      error: variant ? stockOnHand < item.qty : false
    };
  });

  const totalSale_สด = calculatedItems.reduce((sum, item) => sum + item.itemTotal, 0) + (deliveryType === 'shipping' ? shippingFee : 0) - globalDiscount;
  const totalCost_สด = calculatedItems.reduce((sum, item) => sum + (item.wac * item.qty), 0) + (deliveryType === 'shipping' ? shippingCost : 0);
  const totalProfit_สด = totalSale_สด - totalCost_สด;

  const visibleOrders = data.orders;

  const statusClassMap = {
    'pending': 'bg-slate-100 text-slate-600 border border-slate-200',
    'confirmed': 'bg-amber-50 text-amber-600 border border-amber-200',
    'shipped': 'bg-blue-50 text-blue-600 border border-blue-200',
    'delivered': 'bg-emerald-50 text-emerald-600 border border-emerald-200'
  };

  const statusTextMap = {
    'pending': 'รอยืนยัน',
    'confirmed': 'ค้างส่ง/พร้อมแพ็ค',
    'shipped': 'ส่งแล้ว/ระหว่างทาง',
    'delivered': 'ส่งสำเร็จ'
  };

  const channelTextMap = {
    'fb': 'Facebook',
    'ig': 'Instagram',
    'other': 'อื่นๆ'
  };

  return (
    <div className="space-y-6" id="orders-view-container">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between py-2 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight" id="orders-view-title">
            ระบบจัดบันทึกบิลซื้อขาย (Sales Orders)
          </h1>
          <p className="text-slate-500 text-sm">เปิดบิลออเดอร์ เช็คสต็อก ตัดคลังสแนปช็อตราคาทุน WAC เพื่อรู้กำไรทันที</p>
        </div>
        <div className="mt-2 md:mt-0">
          {!isAdding ? (
            <button
              onClick={() => setIsAdding(true)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              id="start-order-btn"
            >
              <Plus className="w-4.5 h-4.5" /> เปิดบิลขายเก้าอี้ใหม่ (Fulfill)
            </button>
          ) : (
            <button
              onClick={() => setIsAdding(false)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
            >
              กลับไปดูบิลขายทั้งหมด
            </button>
          )}
        </div>
      </div>

      {isAdding ? (
        // ================== STATE: NEW SALES ORDER FORM ==================
        <form onSubmit={handleSaveOrder} className="space-y-6 animate-fade-in" id="new-order-form">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left Column: Meta info */}
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs space-y-4 lg:col-span-1">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <ShoppingBag className="w-4.5 h-4.5 text-emerald-700" /> ข้อมูลการสั่งซื้อ (ไม่มีรายชื่อลูกค้า)
                </h3>
              </div>

              {/* Order Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">วันที่ทำรายการ</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-xs p-2.5 pl-9 bg-slate-50 outline-hidden border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">ลูกค้า</label>
                <div className="flex gap-2">
                  <select
                    value={customerId}
                    onChange={(event) => setCustomerId(event.target.value)}
                    className="min-w-0 flex-1 text-xs p-3 bg-slate-50 outline-hidden border border-slate-200 rounded-xl text-slate-800"
                  >
                    <option value="general">ลูกค้าทั่วไป / ไม่ระบุชื่อ</option>
                    {data.customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowCustomerForm((value) => !value)}
                    className="shrink-0 px-3 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
                    title="เพิ่มลูกค้า"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>

                {showCustomerForm && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <input
                      type="text"
                      value={customerDraft.name}
                      onChange={(event) => setCustomerDraft((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="ชื่อลูกค้า"
                      className="w-full text-xs p-2.5 bg-white outline-hidden border border-slate-200 rounded-lg"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={customerDraft.phone}
                        onChange={(event) => setCustomerDraft((prev) => ({ ...prev, phone: event.target.value }))}
                        placeholder="เบอร์โทร"
                        className="w-full text-xs p-2.5 bg-white outline-hidden border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        value={customerDraft.facebook}
                        onChange={(event) => setCustomerDraft((prev) => ({ ...prev, facebook: event.target.value }))}
                        placeholder="Facebook/ช่องทางติดต่อ"
                        className="w-full text-xs p-2.5 bg-white outline-hidden border border-slate-200 rounded-lg"
                      />
                    </div>
                    <textarea
                      rows={2}
                      value={customerDraft.note}
                      onChange={(event) => setCustomerDraft((prev) => ({ ...prev, note: event.target.value }))}
                      placeholder="หมายเหตุ"
                      className="w-full text-xs p-2.5 bg-white outline-hidden border border-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCustomer}
                      disabled={savingCustomer}
                      className="w-full py-2 rounded-lg bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold"
                    >
                      {savingCustomer ? 'กำลังบันทึกลูกค้า...' : 'บันทึกลูกค้าใหม่'}
                    </button>
                  </div>
                )}
              </div>

              {/* Channel */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">ช่องทางสั่งซื้อ</label>
                <div className="grid grid-cols-3 gap-2" id="channel-tabs">
                  {['fb', 'ig', 'other'].map(ch => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannel(ch as OrderChannel)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        channel === ch
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {ch === 'fb' ? 'Facebook' : ch === 'ig' ? 'Instagram' : 'อื่นๆ'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delivery Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">วิธีการจัดส่งสินค้า</label>
                <div className="grid grid-cols-2 gap-2" id="delivery-tabs">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('shipping')}
                    className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      deliveryType === 'shipping'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ส่งพัสดุขนส่ง
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryType('pickup')}
                    className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      deliveryType === 'pickup'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    นัดรับสินค้าที่ร้าน
                  </button>
                </div>
              </div>

              {/* Shipping fees (Conditional on deliveryType === 'shipping') */}
              {deliveryType === 'shipping' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-fade-in" id="shipping-fee-inputs-block">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block border-b border-slate-200 pb-1 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-emerald-600" /> รายละเอียดค่าจัดส่งพัสดุ
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1 truncate">ค่าส่งเก็บจากลูกค้า</label>
                      <input
                        type="number"
                        min="0"
                        value={numberInputValue(shippingFee)}
                        onChange={(e) => setShippingFee(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full text-xs p-2 bg-white outline-hidden border border-slate-200 rounded-lg text-slate-800 font-mono font-bold"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1 truncate">ต้นทุนค่าส่งจริง/ค่าแพ็ค</label>
                      <input
                        type="number"
                        min="0"
                        value={numberInputValue(shippingCost)}
                        onChange={(e) => setShippingCost(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full text-xs p-2 bg-white outline-hidden border border-slate-200 rounded-lg text-slate-800 font-mono font-bold text-rose-600"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    * ค่าส่งที่เก็บลูกค้าจะบวกเพิ่มในยอดรวม ส่วนต้นทุนค่าส่งจะนำไปหักออกจากประมาณการกำไรสุทธิ
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">สถานะออเดอร์เริ่มต้น</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OrderStatus)}
                  className="w-full text-xs p-3 bg-slate-50 outline-hidden border border-slate-200 rounded-xl text-slate-800"
                >
                  <option value="confirmed">จ่ายแล้ว/พร้อมแพ็คส่ง (Confirmed)</option>
                  <option value="shipped">ส่งของแล้ว (Shipped)</option>
                  <option value="delivered">จัดส่งสำเร็จลุล่วง (Delivered)</option>
                </select>
              </div>
            </div>

            {/* Right Column: Order Lines and Real-time Profit Preview */}
            <div className="lg:col-span-2 space-y-6">

              {/* Items Card list */}
              <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-slate-700 text-sm flex items-center gap-1.5">
                    <ShoppingBag className="w-4.5 h-4.5 text-emerald-700" />
                    รายการสั่งเก้าอี้
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-emerald-700 hover:text-emerald-800 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มแถวสินค้า
                  </button>
                </div>

                {/* Rows mapped */}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {items.map((item, idx) => {
                    const variant = variantById.get(item.variant_id);
                    const stockOnHand = stockQtyByVariantId.get(item.variant_id) || 0;
                    const error = stockOnHand < item.qty;

                    // Resolve current parent hierarchy for Brand -> Model -> Variant
                    const currentModel = variant ? modelById.get(variant.model_id) : null;
                    const currentBrand = currentModel ? brandById.get(currentModel.brand_id) : null;

                    const activeBrandId = currentBrand?.id || '';
                    const activeModelId = currentModel?.id || '';
                    const activeVariantId = item.variant_id || '';
                    const currentImage = variant?.image || currentModel?.image || '';

                    // Filter cascading levels
                    const modelsForBrand = activeModelsByBrand.get(activeBrandId) || [];
                    const variantsForModel = activeVariantsByModel.get(activeModelId) || [];

                    // Re-routing changers
                    const handleBrandChange = (bId: string) => {
                      const brandModels = activeModelsByBrand.get(bId) || [];
                      const matchedModel = brandModels[0];
                      const modelVariants = matchedModel ? activeVariantsByModel.get(matchedModel.id) || [] : [];
                      const nextVariantId = modelVariants[0]?.id || '';
                      handleUpdateItemRow(idx, 'variant_id', nextVariantId);
                    };

                    const handleModelChange = (mId: string) => {
                      const modelVariants = activeVariantsByModel.get(mId) || [];
                      const nextVariantId = modelVariants[0]?.id || '';
                      handleUpdateItemRow(idx, 'variant_id', nextVariantId);
                    };

                    const handleColorChange = (vId: string) => {
                      handleUpdateItemRow(idx, 'variant_id', vId);
                    };

                    return (
                      <div key={idx} className={`p-3 md:p-4 border rounded-xl space-y-3 relative group transition-all ${error ? 'bg-rose-50/40 border-rose-200' : 'bg-slate-50/50 border-slate-100'}`}>
                        <div className="flex flex-col md:flex-row md:items-end gap-3.5">
                          {/* Image Thumbnail Selection Preview */}
                          <div className="shrink-0 flex items-center justify-center" id={`order-row-image-container-${idx}`}>
                            {currentImage ? (
                              <img
                                src={currentImage}
                                className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover border border-slate-200 cursor-zoom-in hover:scale-105 active:scale-95 transition-all duration-150 shadow-xs"
                                referrerPolicy="no-referrer"
                                title="คลิกเพื่อขยายดูรูปภาพ"
                                onClick={() => {
                                  setPreviewImage(currentImage);
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

                          <div className="grow w-full flex flex-col gap-3 md:grid md:grid-cols-12 md:gap-3 md:items-end">

                            {/* Sequential Choose variation cascading options */}
                            <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs md:text-[10px] font-semibold text-slate-400 mb-1 uppercase truncate">ยี่ห้อ (Brand)</label>
                                <select
                                  value={activeBrandId}
                                  onChange={(e) => handleBrandChange(e.target.value)}
                                  className="w-full text-xs p-2.5 bg-white outline-hidden border border-slate-200 rounded-lg text-slate-800 focus:border-emerald-700"
                                  required
                                >
                                  <option value="" disabled>-- เลือกยี่ห้อ --</option>
                                  {activeBrands.map(b => (
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

                            {/* Order stock qty */}
                            <div className="md:col-span-2">
                              <label className="block text-xs md:text-[10px] font-semibold text-slate-400 mb-1 uppercase truncate">จำนวนสั่งซื้อ (ตัว)</label>
                              <input
                                type="number"
                                min="1"
                                value={numberInputValue(item.qty)}
                                onChange={(e) => handleUpdateItemRow(idx, 'qty', Math.max(1, parseInt(e.target.value) || 0))}
                                className="w-full text-xs p-2.5 md:p-2 bg-white outline-hidden border border-slate-200 rounded-lg text-slate-800 font-mono text-left md:text-center focus:border-emerald-700"
                                required
                              />
                            </div>

                            {/* Unit Sale Price */}
                            <div className="md:col-span-3">
                              <label className="block text-xs md:text-[10px] font-semibold text-slate-400 mb-1 uppercase truncate">ราคาจริง/ตัว</label>
                              <input
                                type="number"
                                min="0"
                                value={numberInputValue(item.sale_price)}
                                onChange={(e) => handleUpdateItemRow(idx, 'sale_price', Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full text-xs p-2.5 md:p-2 bg-white outline-hidden border border-slate-200 rounded-lg text-slate-800 font-mono text-right focus:border-emerald-700"
                                required
                              />
                            </div>



                            {/* Trash button */}
                            <div className="flex justify-end pt-1 md:pt-0 md:col-span-1 md:justify-center md:items-end">
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                disabled={items.length === 1}
                                className="w-full md:w-auto p-2.5 md:p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-50 border border-slate-200 md:border-none rounded-lg transition-colors cursor-pointer disabled:opacity-30 flex items-center justify-center gap-1.5 text-xs font-semibold"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="md:hidden text-rose-500">ลบสินค้าชิ้นนี้</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Detailed WAC Margin indicator */}
                        <div className="flex flex-wrap items-center justify-between text-[11px] pt-1.5 border-t border-dashed border-slate-200 text-slate-500">
                          <div className="flex items-center gap-1">
                            <span>คลังมีของพร้อมส่ง:</span>{' '}
                            <span className={`font-bold ${stockOnHand === 0 ? 'text-rose-500 font-bold' : stockOnHand < item.qty ? 'text-amber-500' : 'text-slate-800'}`}>
                              {stockOnHand} ตัว
                            </span>
                            {error && (
                              <span className="text-rose-500 font-bold ml-1 flex items-center gap-0.5 bg-rose-50 px-1.5 py-0.2 rounded">
                                ⚠️ สต็อกไม่พอขาย!
                              </span>
                            )}
                          </div>
                          {variant && (
                            <div className="flex items-center gap-2">
                              <span>ต้นทุนเฉลี่ย (WAC): <strong className="font-mono text-slate-700">฿{variant.current_wac.toLocaleString()}</strong></span>
                              <span>•</span>
                              <span>
                                ประมาณการกำไรบรรทัดนี้:{' '}
                                <strong className={`font-mono text-xs ${(item.sale_price - item.discount - variant.current_wac) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                  ฿{Math.round(((item.sale_price - item.discount - variant.current_wac) * item.qty) * 100) / 100}
                                </strong>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ส่วนลดท้ายบิลเพิ่มเติม */}
                <div className="mt-4 bg-slate-50 p-4 border border-slate-200/60 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 max-w-xs">
                    <Percent className="w-4 h-4 text-emerald-600" />
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase">ส่วนลดท้ายบิลเพิ่มเติม (บาท)</label>
                      <input
                        type="number"
                        min="0"
                        value={numberInputValue(globalDiscount)}
                        onChange={(e) => setGlobalDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                        className="text-xs p-1.5 mt-0.5 bg-white outline-hidden border border-slate-200 rounded-md text-slate-800 font-mono font-bold w-32 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Profit Real-time Preview Area (LEGENDARY UX) */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4 shadow-sm" id="profit-preview">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-xs">
                  <span className="text-slate-400 uppercase tracking-wider font-semibold">สรุปราคาขายและพรีวิวกำไรรวม (Real-time Preview)</span>
                  <span className="flex items-center gap-0.5 text-emerald-400"><TrendingUp className="w-3.5 h-3.5" /> Live Costing</span>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-1">
                  <div>
                    <p className="text-[10px] text-slate-400">ยอดรวมขายทั้งหมด (บาท)</p>
                    <h3 className="text-base md:text-xl font-bold font-mono text-white">
                      ฿{totalSale_สด.toLocaleString()}
                    </h3>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">มูลค่าฐานต้นทุน WAC สต็อกรวม</p>
                    <h3 className="text-base md:text-xl font-bold font-mono text-slate-300">
                      ฿{totalCost_สด.toLocaleString('th-TH', { maximumFractionDigits: 2 })}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-emerald-400 font-bold">ประมาณการกำไรสุทธิ</p>
                    <h3 className={`text-lg md:text-2xl font-extrabold font-mono ${totalProfit_สด >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ฿{totalProfit_สด.toLocaleString('th-TH', { maximumFractionDigits: 2 })}
                    </h3>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    ยกเลิกกลับ
                  </button>
                  <button
                    type="submit"
                    disabled={calculatedItems.some(i => i.error)}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-md disabled:bg-slate-700 disabled:text-slate-400 cursor-pointer transition-colors"
                  >
                    <Check className="w-4 h-4" /> เสร็จสิ้นการเปิดออเดอร์
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      ) : (
        // ================== STATE: ORDERS HISTORY VIEW ==================
        <div className="space-y-4 animate-fade-in" id="orders-list-view">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
            {/* Left side Search */}
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl flex-1 max-w-sm text-xs">
              <Search className="w-4 h-4 text-slate-400" />
	              <input
	                type="text"
	                placeholder="ค้นหารหัสบิล, ลูกค้า, เบอร์โทรศ์ หรือ รุ่น..."
	                value={searchDraft}
	                onChange={(e) => setSearchDraft(e.target.value)}
	                className="bg-transparent outline-hidden w-full text-slate-700 text-xs"
	              />
	            </div>

            {/* Right side status toggles */}
            <div className="flex gap-1.5 overflow-x-auto text-[11px] bg-slate-100 p-1 rounded-xl self-start" id="status-filter-group">
              {[
                { id: 'all', label: 'ทั้งหมด' },
                { id: 'confirmed', label: 'รอส่ง' },
                { id: 'shipped', label: 'ส่งแล้ว' },
                { id: 'delivered', label: 'สำเร็จ' }
	              ].map(f => (
	                <button
	                  key={f.id}
	                  onClick={() => setOrderFilters({ status: f.id as OrderPageFilters['status'], search: searchDraft.trim() })}
	                  className={`py-1.5 px-3.5 rounded-lg font-semibold transition-all cursor-pointer ${
	                    orderFilters.status === f.id
	                      ? 'bg-white text-slate-800 shadow-xs'
	                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders timeline Cards */}
	          <div className="space-y-3" id="orders-grid">
	            {visibleOrders.length > 0 ? (
	              visibleOrders.map(order => {
	                const orderSubTotal = getOrderSubtotal(order);
	                const orderNetAmount = getOrderRevenue(order);
	                const totalBatchProfit = getOrderProfit(order);
	                const delivery = deliveryByOrderId.get(order.id);
	                const isEditingDelivery = editingDeliveryOrderId === order.id;

                return (
                  <div
                    key={order.id}
                    className="bg-white border border-slate-150/40 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row justify-between gap-4 relative group"
                  >
                    {/* Trash float delete inside and release stock */}
                    <button
                      onClick={() => {
                        const ok = window.confirm(`ลบออเดอร์ ${order.id.slice(0, 8)} และคืนสต็อก ${order.items.length} ตัวเข้าคลังหรือไม่?`);
                        if (!ok) return;
                        deleteOrder(order.id)
                          .then(() => alert('ลบออเดอร์และคืนสต็อกเรียบร้อยแล้ว'))
                          .catch((err: any) => alert(`ลบออเดอร์ไม่สำเร็จ: ${err.message || err}`));
                      }}
                      className="absolute right-4 top-4 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="ลบออเดอร์และคืนสต็อกของ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Left Meta details */}
                    <div className="space-y-2.5 max-w-md text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-500 text-sm">
                          {order.id.replace('ord-', '#')}
                        </span>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${statusClassMap[order.status]}`}>
                          {statusTextMap[order.status]}
                        </span>
                        <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono font-medium">
                          ผ่าน {channelTextMap[order.channel]}
                        </span>
                        <span className="text-[10px] bg-purple-50 text-purple-700 px-2 border border-purple-100 py-0.5 rounded font-medium">
                          {order.delivery_type === 'shipping' ? '🚚 ส่งพัสดุ' : '🏪 นัดรับหน้าร้าน'}
                        </span>
                      </div>

                      {/* Date Info */}
                      <div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          วันสั่งซื้อ: {order.date}
                        </div>
                      </div>

                      {/* Line Items display */}
                      <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {order.customer_name_snapshot || 'ลูกค้าทั่วไป'}
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] space-y-1">
                        <strong className="text-slate-500 block mb-1">รายการเก้าอี้ในบิล ({order.items.length} ตัว):</strong>
	                        {order.items.map((oi, idx) => {
	                          const variant = variantById.get(oi.variant_id);
	                          const model = variant ? modelById.get(variant.model_id) : null;
	                          const brand = model ? brandById.get(model.brand_id) : null;
                          const displayModelName = model?.name || oi.model_name_snapshot || 'สินค้าเดิม';
                          const displayVariantColor = variant?.color || oi.variant_color_snapshot || '-';
                          const displayBrandName = brand?.name || oi.brand_name_snapshot || 'เก้าอี้';
                          const itemImage = variant?.image || model?.image || '';
                          return (
                            <div key={idx} className="flex items-center justify-between gap-3 text-slate-700 border-b border-slate-100 last:border-b-0 py-1.5 first:pt-0 last:pb-0">
                              <div className="flex items-center gap-2 min-w-0">
                                {itemImage ? (
                                  <img
                                    src={itemImage}
                                    className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0 cursor-zoom-in active:scale-95 transition-transform"
                                    referrerPolicy="no-referrer"
                                    title="คลิกเพื่อขยายดูรูปภาพ"
                                    onClick={() => {
                                      setPreviewImage(itemImage);
                                      setPreviewTitle(`${displayBrandName} ${displayModelName}`);
                                    }}
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                    <ImageIcon className="w-4 h-4 text-slate-300" />
                                  </div>
                                )}
                                <div className="truncate">
                                  {displayModelName} (<strong className="text-slate-600">{displayVariantColor}</strong>)
                                </div>
                              </div>
                              <span className="font-mono text-right shrink-0">
                                ฿{oi.final_price?.toLocaleString()} <span className="text-slate-400 block text-[9px]">(ทุน WAC: ฿{Math.round(oi.wac_at_sale)})</span>
                              </span>
                            </div>
                          );
                        })}
                        {order.discount > 0 && (
                          <div className="text-rose-500 font-semibold text-right pt-1 border-t border-dashed border-slate-200">
                            ส่วนลดบิลเพิ่มเติม: -฿{order.discount.toLocaleString()}
                          </div>
                        )}
                        {order.delivery_type === 'shipping' && ((order.shipping_fee || 0) > 0 || (order.shipping_cost || 0) > 0) && (
                          <div className="text-slate-500 text-right pt-1 border-t border-dashed border-slate-200 space-y-0.5 font-mono text-[10px]">
                            {order.shipping_fee !== undefined && order.shipping_fee > 0 && (
                              <div className="text-emerald-700">ค่าส่งเก็บจากลูกค้า: +฿{order.shipping_fee.toLocaleString()}</div>
                            )}
                            {order.shipping_cost !== undefined && order.shipping_cost > 0 && (
                              <div className="text-rose-600">ต้นทุนค่าจัดส่งจริง: -฿{order.shipping_cost.toLocaleString()}</div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="bg-white border border-slate-100 rounded-xl p-3 text-[11px] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-600 flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-emerald-700" />
                            {order.delivery_type === 'shipping' ? 'ข้อมูลจัดส่ง' : 'ข้อมูลนัดรับ'}
                          </span>
                          {!isEditingDelivery && (
                            <button
                              type="button"
                              onClick={() => startEditDelivery(order.id)}
                              className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800"
                            >
                              แก้ไข
                            </button>
                          )}
                        </div>

                        {isEditingDelivery ? (
                          <div className="space-y-2">
                            {order.delivery_type === 'shipping' ? (
                              <input
                                type="text"
                                value={trackingNo}
                                onChange={(event) => setTrackingNo(event.target.value)}
                                placeholder="เลขพัสดุ"
                                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                              />
                            ) : (
                              <input
                                type="datetime-local"
                                value={pickupDate}
                                onChange={(event) => setPickupDate(event.target.value)}
                                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                              />
                            )}
                            <select
                              value={deliveryStatus}
                              onChange={(event) => setDeliveryStatus(event.target.value as DeliveryStatus)}
                              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                            >
                              <option value="pending">รอดำเนินการ</option>
                              <option value="dispatched">ส่งแล้ว / นัดแล้ว</option>
                              <option value="delivered">สำเร็จ</option>
                            </select>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingDeliveryOrderId(null)}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-semibold"
                              >
                                ยกเลิก
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveDeliveryInfo(order.id)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold"
                              >
                                บันทึก
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-500 space-y-1">
                            {order.delivery_type === 'shipping' ? (
                              <div>เลขพัสดุ: <strong className="text-slate-700">{delivery?.tracking || '-'}</strong></div>
                            ) : (
                              <div>เวลานัดรับ: <strong className="text-slate-700">{delivery?.pickup_datetime || '-'}</strong></div>
                            )}
                            <div>
                              สถานะจัดส่ง: <strong className="text-slate-700">
                                {delivery?.status === 'delivered' ? 'สำเร็จ' : delivery?.status === 'dispatched' ? 'ส่งแล้ว / นัดแล้ว' : 'รอดำเนินการ'}
                              </strong>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Price details and fast action togglers */}
                    <div className="flex flex-row md:flex-col justify-between items-end gap-3 text-right">
                      {/* Pricing total */}
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 uppercase">ยอดบิลรวมสุทธิ</p>
                        <h4 className="text-base md:text-xl font-bold font-mono text-slate-800">
                          ฿{orderNetAmount.toLocaleString()}
                        </h4>
                        <span className="text-[9px] font-mono text-slate-400 block">
                          หักลดแล้ว {order.discount > 0 ? `(มีลดเพิ่ม ฿${order.discount})` : ''}
                          {order.shipping_fee !== undefined && order.shipping_fee > 0 ? ` (+ ค่าส่ง ฿${order.shipping_fee})` : ''}
                        </span>
                        <div className="text-[10px] mt-1 font-semibold flex items-center gap-1 justify-end">
                          <span className="text-slate-400">กำไรสุทธิแบรนด์:</span>
                          <span className={`font-mono text-xs ${totalBatchProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            ฿{totalBatchProfit.toLocaleString('th-TH', { maximumFractionDigits: 1 })}
                          </span>
                        </div>
                      </div>

                      {/* Fast status trigger updater */}
                      <div className="flex justify-end gap-1.5 self-end flex-wrap max-w-xs mt-2" id="quick-order-actions">
                        <span className="text-[9px] text-slate-400 block w-full mb-1">เปลี่ยนสถานะด่วน:</span>
                        {order.status === 'pending' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'confirmed').catch((err: any) => alert(`อัปเดตสถานะไม่สำเร็จ: ${err.message || err}`))}
                            className="text-[10px] bg-slate-900 text-white font-semibold py-1 px-2.5 rounded-lg hover:bg-slate-800 cursor-pointer"
                          >
                            ยืนยันการโอนเงินแล้ว
                          </button>
                        )}
                        {order.status === 'confirmed' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'shipped').catch((err: any) => alert(`อัปเดตสถานะไม่สำเร็จ: ${err.message || err}`))}
                            className="text-[10px] bg-slate-800 text-white font-semibold py-1 px-2.5 rounded-lg hover:bg-slate-900 cursor-pointer"
                          >
                            อัปเดต: ปิดจ๊อบส่งพัสดุ
                          </button>
                        )}
                        {order.status === 'shipped' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'delivered').catch((err: any) => alert(`อัปเดตสถานะไม่สำเร็จ: ${err.message || err}`))}
                            className="text-[10px] bg-emerald-600 text-white font-semibold py-1 px-2.5 rounded-lg hover:bg-emerald-700 cursor-pointer"
                          >
                            ยืนยัน: ของส่งถึงมือแล้ว
                          </button>
                        )}
                        {order.status === 'delivered' && (
                          <span className="text-[10px] text-emerald-500 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded flex items-center gap-0.5">
                            <Check className="w-3.5 h-3.5" /> บัญชีบันทึกเรียบร้อย
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white p-12 text-center text-slate-400 border border-slate-150 rounded-2xl">
                ไม่พบบันทึกใบสั่งซื้อตามตัวกรองที่เลือก
	              </div>
	            )}
	          </div>

	          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500 bg-white border border-slate-100 rounded-2xl p-4">
	            <span>
	              แสดง {visibleOrders.length.toLocaleString('th-TH')} จาก {ordersTotalCount.toLocaleString('th-TH')} บิล
	            </span>
	            {ordersHasMore && (
	              <button
	                type="button"
	                onClick={() => loadMoreOrders()}
	                disabled={loadingOrders}
	                className="self-start sm:self-auto px-4 py-2 rounded-xl bg-slate-900 text-white font-bold disabled:bg-slate-300"
	              >
	                {loadingOrders ? 'กำลังโหลด...' : 'โหลดออเดอร์เพิ่มเติม'}
	              </button>
	            )}
	          </div>
	        </div>
	      )}

      {/* Quick Customer modal removed */}

      {/* --- IMAGE LIGHTBOX MODAL --- */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-4 z-50 animate-fade-in"
          id="order-image-lightbox-modal"
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
