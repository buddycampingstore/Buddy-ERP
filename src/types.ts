/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Brand {
  id: string;
  name: string;
  is_active: boolean;
  archived_at?: string | null;
}

export interface Model {
  id: string;
  brand_id: string;
  name: string;
  image?: string; // Optional image data URL or URL
  is_active: boolean;
  archived_at?: string | null;
}

export interface Variant {
  id: string;
  model_id: string;
  color: string;
  image?: string;
  qty_in_stock: number; // calculated/sync'd count of active in_stock StockItems
  current_wac: number;  // weighted average cost (auto calculated)
  standard_sale_price?: number; // standard selling price of this model/color
  is_active: boolean;
  archived_at?: string | null;
}

export interface PurchaseBatchItem {
  variant_id: string;
  qty: number;
  unit_price: number;
}

export interface PurchaseBatch {
  id: string;
  date: string; // YYYY-MM-DD
  items: PurchaseBatchItem[];
  shipping_cost: number;
  other_cost: number;
  note?: string;
}

export type StockItemStatus = 'in_stock' | 'sold';

export interface StockItem {
  id: string;
  variant_id: string;
  wac_cost: number; // what the WAC of the variant was when this item was received
  status: StockItemStatus;
  order_id?: string; // linked when sold
  batch_id: string; // linked to purchase batch
}

export interface StockSummary {
  variant_id: string;
  in_stock_qty: number;
  in_stock_value: number;
}

export interface DashboardRecentOrder {
  id: string;
  date: string;
  channel: OrderChannel;
  status: OrderStatus;
  total: number;
}

export interface DashboardLowStockVariant {
  id: string;
  name: string;
  qty_in_stock: number;
}

export interface DashboardChannelPoint {
  name: string;
  value: number;
}

export interface DashboardDailySalesPoint {
  date: string;
  'ยอดขาย (บาท)': number;
}

export interface DashboardSummary {
  month: string;
  stock_qty: number;
  stock_value: number;
  month_sales: number;
  month_profit: number;
  month_purchase_cost: number;
  pending_orders_count: number;
  recent_orders: DashboardRecentOrder[];
  low_stock_variants: DashboardLowStockVariant[];
  channel_chart: DashboardChannelPoint[];
  daily_sales: DashboardDailySalesPoint[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  facebook: string;
  note: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered';
export type OrderChannel = 'fb' | 'ig' | 'other';
export type DeliveryType = 'shipping' | 'pickup';

export interface Order {
  id: string;
  customer_id: string | null;
  customer_name_snapshot: string;
  date: string; // YYYY-MM-DD
  channel: OrderChannel;
  status: OrderStatus;
  delivery_type: DeliveryType;
  discount: number; // global order discount
  items: OrderItem[];
  shipping_fee?: number; // shipping fee charged to customer
  shipping_cost?: number; // actual shipping cost paid by store
}

export interface OrderItem {
  id: string;
  stock_item_id: string; // link to unique serial/item in stock
  variant_id: string; // reference to variant
  sale_price: number;
  discount: number; // item level discount
  final_price: number; // computed: sale_price - discount
  wac_at_sale: number; // snaphotted WAC cost base at time of purchase
  profit: number; // final_price - wac_at_sale
  brand_name_snapshot: string;
  model_name_snapshot: string;
  variant_color_snapshot: string;
}

export type DeliveryStatus = 'pending' | 'dispatched' | 'delivered';

export interface Delivery {
  id: string;
  order_id: string;
  tracking: string; // tracking number or empty
  pickup_datetime: string; // empty or YYYY-MM-DDTHH:mm
  status: DeliveryStatus;
}

// Full application data state stored in LocalStorage
export interface AppData {
  schema_version?: number;
  brands: Brand[];
  models: Model[];
  variants: Variant[];
  purchaseBatches: PurchaseBatch[];
  stockItems: StockItem[];
  stockSummary: StockSummary[];
  customers: Customer[];
  orders: Order[];
  deliveries: Delivery[];
}
