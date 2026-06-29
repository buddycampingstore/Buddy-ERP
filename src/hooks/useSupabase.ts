import { useState, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AppDatabase,
  Brand,
  Customer,
  Delivery,
  DeliveryStatus,
  Model,
  Order,
  OrderChannel,
  OrderItem,
  OrderStatus,
  PurchaseBatch,
  PurchaseBatchItem,
  StockItem,
  StockItemStatus,
  Variant
} from '../types';

const URL_LS_KEY = 'campchair_supabase_url';
const KEY_LS_KEY = 'campchair_supabase_anon_key';
const AUTO_SYNC_LS_KEY = 'campchair_supabase_auto_sync';

const TABLE_MISSING_MESSAGE = 'ยังไม่พบตารางฐานข้อมูลจริงบางรายการใน Supabase กรุณารัน SQL ในหน้า ตั้งค่า / สำรองข้อมูล แล้วกดอัปโหลดขึ้นคลาวด์อีกครั้ง';

const REAL_TABLES = [
  'brands',
  'models',
  'variants',
  'purchase_batches',
  'purchase_batch_items',
  'stock_items',
  'customers',
  'orders',
  'order_items',
  'deliveries'
] as const;

type RealTable = typeof REAL_TABLES[number];

const DELETE_ORDER: RealTable[] = [
  'order_items',
  'deliveries',
  'stock_items',
  'purchase_batch_items',
  'orders',
  'purchase_batches',
  'variants',
  'models',
  'brands',
  'customers'
];

const INSERT_ORDER: RealTable[] = [
  'brands',
  'models',
  'variants',
  'customers',
  'purchase_batches',
  'purchase_batch_items',
  'orders',
  'order_items',
  'deliveries',
  'stock_items'
];

type TableRows = Record<RealTable, Record<string, unknown>[]>;

const emptyTableRows = (): TableRows => ({
  brands: [],
  models: [],
  variants: [],
  purchase_batches: [],
  purchase_batch_items: [],
  stock_items: [],
  customers: [],
  orders: [],
  order_items: [],
  deliveries: []
});

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asDateString = (value: unknown) => {
  return String(value || '').slice(0, 10);
};

const buildTableRows = (db: AppDatabase, userId: string): TableRows => {
  const rows = emptyTableRows();

  rows.brands = db.brands.map(brand => ({
    user_id: userId,
    id: brand.id,
    name: brand.name
  }));

  rows.models = db.models.map(model => ({
    user_id: userId,
    id: model.id,
    brand_id: model.brand_id,
    name: model.name,
    image: model.image || null
  }));

  rows.variants = db.variants.map(variant => ({
    user_id: userId,
    id: variant.id,
    model_id: variant.model_id,
    color: variant.color,
    qty_in_stock: variant.qty_in_stock,
    current_wac: variant.current_wac,
    standard_sale_price: variant.standard_sale_price ?? 0
  }));

  rows.purchase_batches = db.purchaseBatches.map(batch => ({
    user_id: userId,
    id: batch.id,
    date: batch.date,
    shipping_cost: batch.shipping_cost,
    other_cost: batch.other_cost,
    note: batch.note || null
  }));

  rows.purchase_batch_items = db.purchaseBatches.flatMap(batch =>
    batch.items.map((item, index) => ({
      user_id: userId,
      id: `${batch.id}-${index}`,
      batch_id: batch.id,
      line_index: index,
      variant_id: item.variant_id,
      qty: item.qty,
      unit_price: item.unit_price
    }))
  );

  rows.stock_items = db.stockItems.map(item => ({
    user_id: userId,
    id: item.id,
    variant_id: item.variant_id,
    wac_cost: item.wac_cost,
    status: item.status,
    order_id: item.order_id || null,
    batch_id: item.batch_id
  }));

  rows.customers = db.customers.map(customer => ({
    user_id: userId,
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    facebook: customer.facebook,
    note: customer.note
  }));

  rows.orders = db.orders.map(order => ({
    user_id: userId,
    id: order.id,
    customer_id: order.customer_id,
    date: order.date,
    channel: order.channel,
    status: order.status,
    delivery_type: order.delivery_type,
    discount: order.discount,
    shipping_fee: order.shipping_fee ?? 0,
    shipping_cost: order.shipping_cost ?? 0
  }));

  rows.order_items = db.orders.flatMap(order =>
    order.items.map(item => ({
      user_id: userId,
      id: item.id,
      order_id: order.id,
      stock_item_id: item.stock_item_id,
      variant_id: item.variant_id,
      sale_price: item.sale_price,
      discount: item.discount,
      final_price: item.final_price,
      wac_at_sale: item.wac_at_sale,
      profit: item.profit
    }))
  );

  rows.deliveries = db.deliveries.map(delivery => ({
    user_id: userId,
    id: delivery.id,
    order_id: delivery.order_id,
    tracking: delivery.tracking,
    pickup_datetime: delivery.pickup_datetime,
    status: delivery.status
  }));

  return rows;
};

const buildDatabaseFromRows = (rows: TableRows): AppDatabase => {
  const purchaseItemsByBatch = new Map<string, PurchaseBatchItem[]>();
  rows.purchase_batch_items
    .slice()
    .sort((a, b) => asNumber(a.line_index) - asNumber(b.line_index))
    .forEach(row => {
      const batchId = String(row.batch_id || '');
      if (!purchaseItemsByBatch.has(batchId)) {
        purchaseItemsByBatch.set(batchId, []);
      }
      purchaseItemsByBatch.get(batchId)?.push({
        variant_id: String(row.variant_id || ''),
        qty: asNumber(row.qty),
        unit_price: asNumber(row.unit_price)
      });
    });

  const orderItemsByOrder = new Map<string, OrderItem[]>();
  rows.order_items.forEach(row => {
    const orderId = String(row.order_id || '');
    if (!orderItemsByOrder.has(orderId)) {
      orderItemsByOrder.set(orderId, []);
    }
    orderItemsByOrder.get(orderId)?.push({
      id: String(row.id || ''),
      stock_item_id: String(row.stock_item_id || ''),
      variant_id: String(row.variant_id || ''),
      sale_price: asNumber(row.sale_price),
      discount: asNumber(row.discount),
      final_price: asNumber(row.final_price),
      wac_at_sale: asNumber(row.wac_at_sale),
      profit: asNumber(row.profit)
    });
  });

  return {
    brands: rows.brands.map(row => ({
      id: String(row.id || ''),
      name: String(row.name || '')
    })) as Brand[],

    models: rows.models.map(row => ({
      id: String(row.id || ''),
      brand_id: String(row.brand_id || ''),
      name: String(row.name || ''),
      image: row.image ? String(row.image) : undefined
    })) as Model[],

    variants: rows.variants.map(row => ({
      id: String(row.id || ''),
      model_id: String(row.model_id || ''),
      color: String(row.color || ''),
      qty_in_stock: asNumber(row.qty_in_stock),
      current_wac: asNumber(row.current_wac),
      standard_sale_price: asNumber(row.standard_sale_price)
    })) as Variant[],

    purchaseBatches: rows.purchase_batches.map(row => ({
      id: String(row.id || ''),
      date: asDateString(row.date),
      shipping_cost: asNumber(row.shipping_cost),
      other_cost: asNumber(row.other_cost),
      note: row.note ? String(row.note) : undefined,
      items: purchaseItemsByBatch.get(String(row.id || '')) || []
    })) as PurchaseBatch[],

    stockItems: rows.stock_items.map(row => ({
      id: String(row.id || ''),
      variant_id: String(row.variant_id || ''),
      wac_cost: asNumber(row.wac_cost),
      status: String(row.status || 'in_stock') as StockItemStatus,
      order_id: row.order_id ? String(row.order_id) : undefined,
      batch_id: String(row.batch_id || '')
    })) as StockItem[],

    customers: rows.customers.map(row => ({
      id: String(row.id || ''),
      name: String(row.name || ''),
      phone: String(row.phone || ''),
      facebook: String(row.facebook || ''),
      note: String(row.note || '')
    })) as Customer[],

    orders: rows.orders.map(row => ({
      id: String(row.id || ''),
      customer_id: String(row.customer_id || 'general'),
      date: asDateString(row.date),
      channel: String(row.channel || 'other') as OrderChannel,
      status: String(row.status || 'pending') as OrderStatus,
      delivery_type: String(row.delivery_type || 'shipping') as Order['delivery_type'],
      discount: asNumber(row.discount),
      items: orderItemsByOrder.get(String(row.id || '')) || [],
      shipping_fee: asNumber(row.shipping_fee),
      shipping_cost: asNumber(row.shipping_cost)
    })) as Order[],

    deliveries: rows.deliveries.map(row => ({
      id: String(row.id || ''),
      order_id: String(row.order_id || ''),
      tracking: String(row.tracking || ''),
      pickup_datetime: String(row.pickup_datetime || ''),
      status: String(row.status || 'pending') as DeliveryStatus
    })) as Delivery[]
  };
};

export function useSupabase(db: AppDatabase, setDb: (db: AppDatabase) => void) {
  const [url, setUrl] = useState(() => localStorage.getItem(URL_LS_KEY) || (import.meta.env.VITE_SUPABASE_URL || ''));
  const [anonKey, setAnonKey] = useState(() => localStorage.getItem(KEY_LS_KEY) || (import.meta.env.VITE_SUPABASE_ANON_KEY || ''));
  const [autoSync, setAutoSync] = useState(() => localStorage.getItem(AUTO_SYNC_LS_KEY) !== 'false');
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastSynced, setLastSynced] = useState<string>('');
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isTableReady, setIsTableReady] = useState(false);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(URL_LS_KEY, url);
  }, [url]);

  useEffect(() => {
    localStorage.setItem(KEY_LS_KEY, anonKey);
  }, [anonKey]);

  useEffect(() => {
    localStorage.setItem(AUTO_SYNC_LS_KEY, String(autoSync));
  }, [autoSync]);

  useEffect(() => {
    setHasBootstrapped(false);
    setIsTableReady(false);
    setIsAuthenticated(false);
    setSessionUserId(null);

    if (url.trim() && anonKey.trim()) {
      try {
        setStatus('connecting');
        const supabase = createClient(url.trim(), anonKey.trim(), {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
        setClient(supabase);
        setStatus('connected');
        setErrorMsg('');
      } catch (err: any) {
        setClient(null);
        setStatus('error');
        setIsTableReady(false);
        setErrorMsg(err?.message || 'URL หรือ API Key ไม่ถูกต้อง');
      }
    } else {
      setClient(null);
      setStatus('disconnected');
      setIsTableReady(false);
      setErrorMsg('');
    }
  }, [url, anonKey]);

  useEffect(() => {
    if (!client) {
      setIsAuthenticated(false);
      setSessionUserId(null);
      return;
    }

    let mounted = true;

    client.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setIsAuthenticated(Boolean(session));
        setSessionUserId(session?.user?.id || null);
      }
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
      setSessionUserId(session?.user?.id || null);
      if (!session) {
        setHasBootstrapped(false);
        setIsTableReady(false);
        setSessionUserId(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [client]);

  const readTables = async (supabase: SupabaseClient, userId: string): Promise<TableRows> => {
    const rows = emptyTableRows();

    for (const table of REAL_TABLES) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      rows[table] = data || [];
    }

    return rows;
  };

  const pushToSupabase = async (currentDb: AppDatabase = db): Promise<{ success: boolean; error?: string }> => {
    if (!client) {
      return { success: false, error: 'ไม่ได้กำหนดค่าการเชื่อมต่อ Supabase' };
    }
    if (!isAuthenticated) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบด้วย Supabase Auth ก่อนอัปโหลดข้อมูล' };
    }
    if (!sessionUserId) {
      return { success: false, error: 'ไม่พบรหัสผู้ใช้ Supabase Auth กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่' };
    }

    setIsPushing(true);
    try {
      const rows = buildTableRows(currentDb, sessionUserId);

      for (const table of DELETE_ORDER) {
        const { error } = await client
          .from(table)
          .delete()
          .eq('user_id', sessionUserId);

        if (error) {
          throw error;
        }
      }

      for (const table of INSERT_ORDER) {
        if (rows[table].length === 0) continue;

        const { error } = await client
          .from(table)
          .insert(rows[table]);

        if (error) {
          throw error;
        }
      }

      setIsTableReady(true);
      setHasBootstrapped(true);
      setErrorMsg('');
      setLastSynced(new Date().toLocaleTimeString('th-TH'));
      return { success: true };
    } catch (err: any) {
      const message = err?.code === '42P01'
        ? TABLE_MISSING_MESSAGE
        : err?.message || 'เกิดข้อผิดพลาดในการอัปโหลดข้อมูล';
      setIsTableReady(err?.code === '42P01' ? false : isTableReady);
      setErrorMsg(message);
      return { success: false, error: message };
    } finally {
      setIsPushing(false);
    }
  };

  const pullFromSupabase = async (): Promise<{ success: boolean; data?: AppDatabase; error?: string }> => {
    if (!client) {
      return { success: false, error: 'ไม่ได้กำหนดค่าการเชื่อมต่อ Supabase' };
    }
    if (!isAuthenticated) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบด้วย Supabase Auth ก่อนดาวน์โหลดข้อมูล' };
    }
    if (!sessionUserId) {
      return { success: false, error: 'ไม่พบรหัสผู้ใช้ Supabase Auth กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่' };
    }

    setIsPulling(true);
    try {
      const rows = await readTables(client, sessionUserId);
      const hasRemoteData = REAL_TABLES.some(table => rows[table].length > 0);

      if (!hasRemoteData) {
        const message = 'ยังไม่มีข้อมูลในตารางจริงบน Supabase (กรุณากด "อัปโหลดข้อมูล" เพื่อตั้งต้น)';
        setIsTableReady(true);
        setErrorMsg(message);
        return { success: false, error: message };
      }

      const remoteDb = buildDatabaseFromRows(rows);
      setDb(remoteDb);
      setIsTableReady(true);
      setHasBootstrapped(true);
      setErrorMsg('');
      setLastSynced(new Date().toLocaleTimeString('th-TH'));
      return { success: true, data: remoteDb };
    } catch (err: any) {
      const message = err?.code === '42P01'
        ? TABLE_MISSING_MESSAGE
        : err?.message || 'เกิดข้อผิดพลาดในการดาวน์โหลดข้อมูล';
      setIsTableReady(err?.code === '42P01' ? false : isTableReady);
      setErrorMsg(message);
      return { success: false, error: message };
    } finally {
      setIsPulling(false);
    }
  };

  useEffect(() => {
    if (!autoSync || status !== 'connected' || !client || !isAuthenticated || !sessionUserId || hasBootstrapped) return;

    let cancelled = false;

    const bootstrapRealTables = async () => {
      setIsPulling(true);
      try {
        const rows = await readTables(client, sessionUserId);
        if (cancelled) return;

        const hasRemoteData = REAL_TABLES.some(table => rows[table].length > 0);

        if (hasRemoteData) {
          setDb(buildDatabaseFromRows(rows));
          setIsTableReady(true);
          setErrorMsg('');
          setLastSynced(new Date().toLocaleTimeString('th-TH'));
          setHasBootstrapped(true);
          return;
        }

        const pushResult = await pushToSupabase(db);
        if (!cancelled && !pushResult.success) {
          setErrorMsg(`สร้างข้อมูลบน Supabase ไม่สำเร็จ: ${pushResult.error}`);
        }
      } catch (err: any) {
        if (!cancelled) {
          const message = err?.code === '42P01'
            ? TABLE_MISSING_MESSAGE
            : err?.message || 'เกิดข้อผิดพลาดในการซิงค์เริ่มต้น';
          setIsTableReady(err?.code === '42P01' ? false : isTableReady);
          setErrorMsg(message);
        }
      } finally {
        if (!cancelled) {
          setIsPulling(false);
        }
      }
    };

    bootstrapRealTables();

    return () => {
      cancelled = true;
    };
  }, [autoSync, status, client, isAuthenticated, sessionUserId, hasBootstrapped]);

  useEffect(() => {
    if (!autoSync || status !== 'connected' || !client || !isAuthenticated || !sessionUserId || !isTableReady || !hasBootstrapped) return;

    const timer = setTimeout(() => {
      pushToSupabase();
    }, 1000);

    return () => clearTimeout(timer);
  }, [db, autoSync, status, client, isAuthenticated, sessionUserId, isTableReady, hasBootstrapped]);

  return {
    url,
    setUrl,
    anonKey,
    setAnonKey,
    autoSync,
    setAutoSync,
    status,
    errorMsg,
    lastSynced,
    isPushing,
    isPulling,
    isTableReady,
    hasBootstrapped,
    isAuthenticated,
    sessionUserId,
    pushToSupabase,
    pullFromSupabase,
    client,
  };
}
