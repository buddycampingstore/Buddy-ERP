/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AppData,
  Brand,
  Customer,
  DashboardSummary,
  Delivery,
  DeliveryType,
  Model,
  OrderChannel,
  OrderItem,
  OrderStatus,
  StockItem,
  StockSummary,
  Variant
} from '../types';
import { supabase } from '../lib/supabase';

const BACKUP_SCHEMA_VERSION = 2;
const GENERAL_CUSTOMER_NAME = 'ลูกค้าทั่วไป';

const EMPTY_DATA: AppData = {
  schema_version: BACKUP_SCHEMA_VERSION,
  brands: [],
  models: [],
  variants: [],
  purchaseBatches: [],
  stockItems: [],
  stockSummary: [],
  customers: [],
  orders: [],
  deliveries: []
};

type DbPurchaseBatchItem = {
  batch_id: string;
  variant_id: string;
  qty: number;
  unit_price: number;
};

type DbOrderItem = OrderItem & {
  order_id: string;
};

type DbStockSummary = {
  variant_id: string;
  in_stock_qty: number;
  in_stock_value: number;
};

type DataSlice = 'products' | 'purchase' | 'orders' | 'deliveries' | 'reports';

type SliceState = Record<DataSlice, boolean>;

const EMPTY_SLICE_STATE: SliceState = {
  products: false,
  purchase: false,
  orders: false,
  deliveries: false,
  reports: false
};

const assertNoError = (error: { message: string } | null) => {
  if (error) {
    throw new Error(error.message);
  }
};

const sortByDateDesc = <T extends { date: string; id: string }>(items: T[]) => {
  return [...items].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    return dateCompare !== 0 ? dateCompare : b.id.localeCompare(a.id);
  });
};

const getLocalYearMonth = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
};

const requireArray = (value: unknown, label: string) => {
  if (!Array.isArray(value)) {
    throw new Error(`Backup is missing ${label}`);
  }
  return value;
};

const mapBrand = (brand: any): Brand => ({
  id: brand.id,
  name: brand.name,
  is_active: brand.is_active !== false,
  archived_at: brand.archived_at || null
});

const mapModel = (model: any): Model => ({
  id: model.id,
  brand_id: model.brand_id,
  name: model.name,
  image: model.image || undefined,
  is_active: model.is_active !== false,
  archived_at: model.archived_at || null
});

const mapVariant = (variant: any): Variant => ({
  id: variant.id,
  model_id: variant.model_id,
  color: variant.color,
  image: variant.image || undefined,
  qty_in_stock: Number(variant.qty_in_stock || 0),
  current_wac: Number(variant.current_wac || 0),
  standard_sale_price: Number(variant.standard_sale_price || 0),
  is_active: variant.is_active !== false,
  archived_at: variant.archived_at || null
});

const mapStockItem = (item: any): StockItem => ({
  id: item.id,
  variant_id: item.variant_id,
  wac_cost: Number(item.wac_cost),
  status: item.status,
  order_id: item.order_id || undefined,
  batch_id: item.batch_id
});

const mapStockSummary = (item: DbStockSummary): StockSummary => ({
  variant_id: item.variant_id,
  in_stock_qty: Number(item.in_stock_qty || 0),
  in_stock_value: Number(item.in_stock_value || 0)
});

const mapDashboardSummary = (summary: any): DashboardSummary => ({
  month: summary?.month || '',
  stock_qty: Number(summary?.stock_qty || 0),
  stock_value: Number(summary?.stock_value || 0),
  month_sales: Number(summary?.month_sales || 0),
  month_profit: Number(summary?.month_profit || 0),
  month_purchase_cost: Number(summary?.month_purchase_cost || 0),
  pending_orders_count: Number(summary?.pending_orders_count || 0),
  recent_orders: Array.isArray(summary?.recent_orders)
    ? summary.recent_orders.map((order: any) => ({
        id: order.id,
        date: order.date,
        channel: order.channel,
        status: order.status,
        total: Number(order.total || 0)
      }))
    : [],
  low_stock_variants: Array.isArray(summary?.low_stock_variants)
    ? summary.low_stock_variants.map((variant: any) => ({
        id: variant.id,
        name: variant.name,
        qty_in_stock: Number(variant.qty_in_stock || 0)
      }))
    : [],
  channel_chart: Array.isArray(summary?.channel_chart)
    ? summary.channel_chart.map((point: any) => ({
        name: point.name,
        value: Number(point.value || 0)
      }))
    : [],
  daily_sales: Array.isArray(summary?.daily_sales)
    ? summary.daily_sales.map((point: any) => ({
        date: point.date,
        'ยอดขาย (บาท)': Number(point['ยอดขาย (บาท)'] || 0)
      }))
    : []
});

const mapCustomer = (customer: any): Customer => ({
  id: customer.id,
  name: customer.name,
  phone: customer.phone,
  facebook: customer.facebook,
  note: customer.note
});

const mapDelivery = (delivery: any): Delivery => ({
  id: delivery.id,
  order_id: delivery.order_id,
  tracking: delivery.tracking,
  pickup_datetime: delivery.pickup_datetime,
  status: delivery.status
});

const buildPurchaseBatches = (batches: any[] = [], items: DbPurchaseBatchItem[] = []) => {
  const purchaseItemsByBatch = new Map<string, DbPurchaseBatchItem[]>();
  items.forEach((item) => {
    const list = purchaseItemsByBatch.get(item.batch_id) || [];
    list.push({
      batch_id: item.batch_id,
      variant_id: item.variant_id,
      qty: item.qty,
      unit_price: Number(item.unit_price)
    });
    purchaseItemsByBatch.set(item.batch_id, list);
  });

  return sortByDateDesc(batches.map((batch: any) => ({
    id: batch.id,
    date: batch.date,
    shipping_cost: Number(batch.shipping_cost || 0),
    other_cost: Number(batch.other_cost || 0),
    items: purchaseItemsByBatch.get(batch.id) || [],
    note: batch.note || undefined
  })));
};

const buildOrders = (orders: any[] = [], items: DbOrderItem[] = []) => {
  const orderItemsByOrder = new Map<string, OrderItem[]>();
  items.forEach((item) => {
    const list = orderItemsByOrder.get(item.order_id) || [];
    list.push({
      id: item.id,
      stock_item_id: item.stock_item_id,
      variant_id: item.variant_id,
      sale_price: Number(item.sale_price),
      discount: Number(item.discount),
      final_price: Number(item.final_price),
      wac_at_sale: Number(item.wac_at_sale),
      profit: Number(item.profit),
      brand_name_snapshot: item.brand_name_snapshot || '',
      model_name_snapshot: item.model_name_snapshot || '',
      variant_color_snapshot: item.variant_color_snapshot || ''
    });
    orderItemsByOrder.set(item.order_id, list);
  });

  return sortByDateDesc(orders.map((order: any) => ({
    id: order.id,
    customer_id: order.customer_id && order.customer_id !== 'general' ? order.customer_id : null,
    customer_name_snapshot: order.customer_name_snapshot || GENERAL_CUSTOMER_NAME,
    date: order.date,
    channel: order.channel,
    status: order.status,
    delivery_type: order.delivery_type,
    discount: Number(order.discount || 0),
    items: orderItemsByOrder.get(order.id) || [],
    shipping_fee: Number(order.shipping_fee || 0),
    shipping_cost: Number(order.shipping_cost || 0)
  })));
};

const normalizeBackup = (value: unknown): AppData => {
  const parsed = value as Partial<AppData>;
  const brands = requireArray(parsed.brands, 'brands');
  const models = requireArray(parsed.models, 'models');
  const variants = requireArray(parsed.variants, 'variants');
  const purchaseBatches = requireArray(parsed.purchaseBatches, 'purchaseBatches');
  const stockItems = requireArray(parsed.stockItems, 'stockItems');
  const customers = requireArray(parsed.customers, 'customers');
  const orders = requireArray(parsed.orders, 'orders');
  const deliveries = requireArray(parsed.deliveries, 'deliveries');

  return {
    schema_version: BACKUP_SCHEMA_VERSION,
    brands: brands.map(mapBrand),
    models: models.map(mapModel),
    variants: variants.map(mapVariant),
    purchaseBatches: purchaseBatches.map((batch: any) => ({
      ...batch,
      items: Array.isArray(batch.items) ? batch.items : []
    })),
    stockItems: stockItems.map(mapStockItem),
    stockSummary: [],
    customers: customers.map(mapCustomer),
    orders: orders.map((order: any) => ({
      ...order,
      customer_id: order.customer_id && order.customer_id !== 'general' ? order.customer_id : null,
      customer_name_snapshot: order.customer_name_snapshot || GENERAL_CUSTOMER_NAME,
      items: Array.isArray(order.items)
        ? order.items.map((item: any) => ({
            ...item,
            brand_name_snapshot: item.brand_name_snapshot || '',
            model_name_snapshot: item.model_name_snapshot || '',
            variant_color_snapshot: item.variant_color_snapshot || ''
          }))
        : []
    })),
    deliveries: deliveries.map(mapDelivery)
  };
};

export function useAppData() {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingSlices, setLoadingSlices] = useState<SliceState>(EMPTY_SLICE_STATE);
  const [loadedSlices, setLoadedSlices] = useState<SliceState>(EMPTY_SLICE_STATE);
  const [error, setError] = useState<string | null>(null);

  const setSliceLoading = useCallback((slice: DataSlice, value: boolean) => {
    setLoadingSlices(prev => ({ ...prev, [slice]: value }));
  }, []);

  const fetchStockSummary = useCallback(async () => {
    const { data: summary, error } = await supabase.rpc('get_stock_summary');
    assertNoError(error);
    return (summary || []).map(mapStockSummary);
  }, []);

  const fetchVariants = useCallback(async () => {
    const { data: variants, error } = await supabase.from('variants').select('*').order('color');
    assertNoError(error);
    return (variants || []).map(mapVariant);
  }, []);

  const fetchProducts = useCallback(async () => {
    const [brandsRes, modelsRes, variantsRes, stockSummary] = await Promise.all([
      supabase.from('brands').select('*').order('name'),
      supabase.from('models').select('*').order('name'),
      supabase.from('variants').select('*').order('color'),
      fetchStockSummary()
    ]);

    assertNoError(brandsRes.error);
    assertNoError(modelsRes.error);
    assertNoError(variantsRes.error);

    return {
      brands: (brandsRes.data || []).map(mapBrand),
      models: (modelsRes.data || []).map(mapModel),
      variants: (variantsRes.data || []).map(mapVariant),
      stockSummary
    };
  }, [fetchStockSummary]);

  const fetchCustomers = useCallback(async () => {
    const { data: customers, error } = await supabase.from('customers').select('*').order('name');
    assertNoError(error);
    return (customers || []).map(mapCustomer);
  }, []);

  const fetchPurchaseBatches = useCallback(async () => {
    const [purchaseBatchesRes, purchaseBatchItemsRes] = await Promise.all([
      supabase.from('purchase_batches').select('*').order('date', { ascending: false }),
      supabase.from('purchase_batch_items').select('*')
    ]);

    assertNoError(purchaseBatchesRes.error);
    assertNoError(purchaseBatchItemsRes.error);
    return buildPurchaseBatches(purchaseBatchesRes.data || [], purchaseBatchItemsRes.data || []);
  }, []);

  const fetchOrdersAndDeliveries = useCallback(async () => {
    const [ordersRes, orderItemsRes, deliveriesRes] = await Promise.all([
      supabase.from('orders').select('*').order('date', { ascending: false }),
      supabase.from('order_items').select('*'),
      supabase.from('deliveries').select('*')
    ]);

    assertNoError(ordersRes.error);
    assertNoError(orderItemsRes.error);
    assertNoError(deliveriesRes.error);

    return {
      orders: buildOrders(ordersRes.data || [], orderItemsRes.data || []),
      deliveries: (deliveriesRes.data || []).map(mapDelivery)
    };
  }, []);

  const loadDashboard = useCallback(async (month = getLocalYearMonth()) => {
    setLoadingDashboard(true);
    setLoading(true);
    setError(null);

    try {
      const { data: summary, error } = await supabase.rpc('get_dashboard_summary', {
        p_month: month
      });
      assertNoError(error);
      setDashboardSummary(mapDashboardSummary(summary));
    } catch (err: any) {
      const message = err?.message || 'โหลดข้อมูลแดชบอร์ดจาก Supabase ไม่สำเร็จ';
      setError(message);
      console.error(message, err);
    } finally {
      setLoadingDashboard(false);
      setLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        brandsRes,
        modelsRes,
        variantsRes,
        purchaseBatchesRes,
        purchaseBatchItemsRes,
        stockSummaryRes,
        customersRes,
        ordersRes,
        orderItemsRes,
        deliveriesRes
      ] = await Promise.all([
        supabase.from('brands').select('*').order('name'),
        supabase.from('models').select('*').order('name'),
        supabase.from('variants').select('*').order('color'),
        supabase.from('purchase_batches').select('*').order('date', { ascending: false }),
        supabase.from('purchase_batch_items').select('*'),
        supabase.rpc('get_stock_summary'),
        supabase.from('customers').select('*').order('name'),
        supabase.from('orders').select('*').order('date', { ascending: false }),
        supabase.from('order_items').select('*'),
        supabase.from('deliveries').select('*')
      ]);

      [
        brandsRes,
        modelsRes,
        variantsRes,
        purchaseBatchesRes,
        purchaseBatchItemsRes,
        stockSummaryRes,
        customersRes,
        ordersRes,
        orderItemsRes,
        deliveriesRes
      ].forEach((result) => assertNoError(result.error));

      setData({
        schema_version: BACKUP_SCHEMA_VERSION,
        brands: (brandsRes.data || []).map(mapBrand),
        models: (modelsRes.data || []).map(mapModel),
        variants: (variantsRes.data || []).map(mapVariant),
        purchaseBatches: buildPurchaseBatches(purchaseBatchesRes.data || [], purchaseBatchItemsRes.data || []),
        stockItems: [],
        stockSummary: (stockSummaryRes.data || []).map(mapStockSummary),
        customers: (customersRes.data || []).map(mapCustomer),
        orders: buildOrders(ordersRes.data || [], orderItemsRes.data || []),
        deliveries: (deliveriesRes.data || []).map(mapDelivery)
      });
    } catch (err: any) {
      const message = err?.message || 'โหลดข้อมูลจาก Supabase ไม่สำเร็จ';
      setError(message);
      console.error(message, err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const ensureProductsLoaded = useCallback(async (force = false) => {
    if (!force && loadedSlices.products) return;
    setSliceLoading('products', true);
    setError(null);

    try {
      const products = await fetchProducts();
      setData(prev => ({
        ...prev,
        brands: products.brands,
        models: products.models,
        variants: products.variants,
        stockItems: [],
        stockSummary: products.stockSummary
      }));
      setLoadedSlices(prev => ({ ...prev, products: true }));
    } catch (err: any) {
      const message = err?.message || 'โหลดข้อมูลสินค้าไม่สำเร็จ';
      setError(message);
      console.error(message, err);
    } finally {
      setSliceLoading('products', false);
    }
  }, [fetchProducts, loadedSlices.products, setSliceLoading]);

  const ensurePurchaseLoaded = useCallback(async (force = false) => {
    if (!force && loadedSlices.purchase) return;
    setSliceLoading('purchase', true);
    setError(null);

    try {
      const [products, purchaseBatches] = await Promise.all([
        fetchProducts(),
        fetchPurchaseBatches()
      ]);
      setData(prev => ({
        ...prev,
        brands: products.brands,
        models: products.models,
        variants: products.variants,
        purchaseBatches,
        stockItems: [],
        stockSummary: products.stockSummary
      }));
      setLoadedSlices(prev => ({ ...prev, products: true, purchase: true }));
    } catch (err: any) {
      const message = err?.message || 'โหลดข้อมูลรับเข้าคลังไม่สำเร็จ';
      setError(message);
      console.error(message, err);
    } finally {
      setSliceLoading('purchase', false);
    }
  }, [fetchProducts, fetchPurchaseBatches, loadedSlices.purchase, setSliceLoading]);

  const ensureOrdersLoaded = useCallback(async (force = false) => {
    if (!force && loadedSlices.orders) return;
    setSliceLoading('orders', true);
    setError(null);

    try {
      const [products, customers, ordersAndDeliveries] = await Promise.all([
        fetchProducts(),
        fetchCustomers(),
        fetchOrdersAndDeliveries()
      ]);
      setData(prev => ({
        ...prev,
        brands: products.brands,
        models: products.models,
        variants: products.variants,
        stockItems: [],
        stockSummary: products.stockSummary,
        customers,
        orders: ordersAndDeliveries.orders,
        deliveries: ordersAndDeliveries.deliveries
      }));
      setLoadedSlices(prev => ({
        ...prev,
        products: true,
        orders: true,
        deliveries: true
      }));
    } catch (err: any) {
      const message = err?.message || 'โหลดข้อมูลออเดอร์ไม่สำเร็จ';
      setError(message);
      console.error(message, err);
    } finally {
      setSliceLoading('orders', false);
    }
  }, [fetchCustomers, fetchOrdersAndDeliveries, fetchProducts, loadedSlices.orders, setSliceLoading]);

  const ensureDeliveriesLoaded = useCallback(async (force = false) => {
    if (!force && loadedSlices.deliveries) return;
    setSliceLoading('deliveries', true);
    setError(null);

    try {
      const [products, customers, ordersAndDeliveries] = await Promise.all([
        fetchProducts(),
        fetchCustomers(),
        fetchOrdersAndDeliveries()
      ]);
      setData(prev => ({
        ...prev,
        brands: products.brands,
        models: products.models,
        variants: products.variants,
        stockItems: [],
        stockSummary: products.stockSummary,
        customers,
        orders: ordersAndDeliveries.orders,
        deliveries: ordersAndDeliveries.deliveries
      }));
      setLoadedSlices(prev => ({
        ...prev,
        products: true,
        orders: true,
        deliveries: true
      }));
    } catch (err: any) {
      const message = err?.message || 'โหลดข้อมูลจัดส่งไม่สำเร็จ';
      setError(message);
      console.error(message, err);
    } finally {
      setSliceLoading('deliveries', false);
    }
  }, [fetchCustomers, fetchOrdersAndDeliveries, fetchProducts, loadedSlices.deliveries, setSliceLoading]);

  const ensureReportsLoaded = useCallback(async (force = false) => {
    if (!force && loadedSlices.reports) return;
    setSliceLoading('reports', true);
    setError(null);

    try {
      await loadData();
      setLoadedSlices({
        products: true,
        purchase: true,
        orders: true,
        deliveries: true,
        reports: true
      });
    } catch (err: any) {
      const message = err?.message || 'โหลดข้อมูลรายงานไม่สำเร็จ';
      setError(message);
      console.error(message, err);
    } finally {
      setSliceLoading('reports', false);
    }
  }, [loadData, loadedSlices.reports, setSliceLoading]);

  const refreshAfter = useCallback(async <T,>(operation: Promise<T>, reload: () => Promise<void> = loadDashboard) => {
    const result = await operation;
    await reload();
    return result;
  }, [loadDashboard]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const addBrand = async (name: string) => {
    const { data: created, error: insertError } = await supabase
      .from('brands')
      .insert({ name: name.trim() })
      .select()
      .single();
    assertNoError(insertError);

    const nextBrand = mapBrand(created);
    setData(prev => ({
      ...prev,
      brands: [...prev.brands, nextBrand].sort((a, b) => a.name.localeCompare(b.name))
    }));
    await loadDashboard();
    return nextBrand;
  };

  const updateBrand = async (id: string, name: string) => {
    await refreshAfter(
      supabase.from('brands').update({ name: name.trim() }).eq('id', id).then(({ error }) => assertNoError(error)),
      async () => {
        await Promise.all([loadDashboard(), ensureProductsLoaded(true)]);
      }
    );
  };

  const archiveBrand = async (id: string) => {
    await refreshAfter(
      supabase.rpc('archive_brand', { p_brand_id: id }).then(({ error }) => assertNoError(error)),
      async () => {
        await Promise.all([loadDashboard(), ensureProductsLoaded(true)]);
      }
    );
  };

  const addModel = async (brand_id: string, name: string, image?: string) => {
    const { data: created, error: insertError } = await supabase
      .from('models')
      .insert({ brand_id, name: name.trim(), image: image || null })
      .select()
      .single();
    assertNoError(insertError);

    const nextModel = mapModel(created);
    setData(prev => ({
      ...prev,
      models: [...prev.models, nextModel].sort((a, b) => a.name.localeCompare(b.name))
    }));
    await loadDashboard();
    return nextModel;
  };

  const updateModel = async (id: string, name: string, brand_id: string, image?: string) => {
    await refreshAfter(
      supabase
        .from('models')
        .update({ name: name.trim(), brand_id, image: image !== undefined ? image : null })
        .eq('id', id)
        .then(({ error }) => assertNoError(error)),
      async () => {
        await Promise.all([loadDashboard(), ensureProductsLoaded(true)]);
      }
    );
  };

  const archiveModel = async (id: string) => {
    await refreshAfter(
      supabase.rpc('archive_model', { p_model_id: id }).then(({ error }) => assertNoError(error)),
      async () => {
        await Promise.all([loadDashboard(), ensureProductsLoaded(true)]);
      }
    );
  };

  const uploadVariantImage = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const imageId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `variants/${imageId}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(path, file, {
        cacheControl: '31536000',
        upsert: false
      });
    assertNoError(uploadError);

    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  };

  const addVariant = async (model_id: string, color: string, standard_sale_price?: number, image?: string) => {
    const { data: created, error: insertError } = await supabase
      .from('variants')
      .insert({
        model_id,
        color: color.trim(),
        standard_sale_price: standard_sale_price || 0,
        image: image || null
      })
      .select()
      .single();
    assertNoError(insertError);

    const nextVariant = mapVariant(created);
    setData(prev => ({
      ...prev,
      variants: [...prev.variants, nextVariant].sort((a, b) => a.color.localeCompare(b.color)),
      stockSummary: [
        ...prev.stockSummary,
        { variant_id: nextVariant.id, in_stock_qty: 0, in_stock_value: 0 }
      ]
    }));
    await loadDashboard();
    return nextVariant;
  };

  const updateVariant = async (id: string, color: string, model_id: string, standard_sale_price?: number, image?: string) => {
    await refreshAfter(
      supabase
        .from('variants')
        .update({
          color: color.trim(),
          model_id,
          standard_sale_price: standard_sale_price || 0,
          image: image || null
        })
        .eq('id', id)
        .then(({ error }) => assertNoError(error)),
      async () => {
        await Promise.all([loadDashboard(), ensureProductsLoaded(true)]);
      }
    );
  };

  const archiveVariant = async (id: string) => {
    await refreshAfter(
      supabase.rpc('archive_variant', { p_variant_id: id }).then(({ error }) => assertNoError(error)),
      async () => {
        await Promise.all([loadDashboard(), ensureProductsLoaded(true)]);
      }
    );
  };

  const addPurchaseBatch = async (
    date: string,
    shipping_cost: number,
    other_cost: number,
    items: { variant_id: string; qty: number; unit_price: number }[],
    note?: string
  ) => {
    const { data: batchId, error: rpcError } = await supabase.rpc('add_purchase_batch', {
      p_date: date,
      p_shipping_cost: shipping_cost,
      p_other_cost: other_cost,
      p_items: items,
      p_note: note?.trim() || null
    });
    assertNoError(rpcError);

    const [variants, purchaseBatches, stockSummary] = await Promise.all([
      fetchVariants(),
      fetchPurchaseBatches(),
      fetchStockSummary()
    ]);
    setData(prev => ({
      ...prev,
      variants,
      purchaseBatches,
      stockItems: [],
      stockSummary
    }));
    await loadDashboard();
    setLoadedSlices(prev => ({ ...prev, products: true, purchase: true }));
    return batchId as string | null;
  };

  const addCustomer = async (customerData: Omit<Customer, 'id'>) => {
    const { data: created, error: insertError } = await supabase
      .from('customers')
      .insert({
        name: customerData.name.trim(),
        phone: customerData.phone.trim(),
        facebook: customerData.facebook.trim(),
        note: customerData.note.trim()
      })
      .select()
      .single();
    assertNoError(insertError);

    const nextCustomer = mapCustomer(created);
    setData(prev => ({
      ...prev,
      customers: [...prev.customers, nextCustomer].sort((a, b) => a.name.localeCompare(b.name))
    }));
    return nextCustomer;
  };

  const updateCustomer = async (id: string, customerData: Omit<Customer, 'id'>) => {
    await refreshAfter(
      supabase
        .from('customers')
        .update({
          name: customerData.name.trim(),
          phone: customerData.phone.trim(),
          facebook: customerData.facebook.trim(),
          note: customerData.note.trim()
        })
        .eq('id', id)
        .then(({ error }) => assertNoError(error)),
      async () => {
        await ensureOrdersLoaded(true);
      }
    );
  };

  const createOrder = async (orderData: {
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
  }) => {
    const { data: orderId, error: rpcError } = await supabase.rpc('create_order', {
      p_order: orderData
    });
    assertNoError(rpcError);

    const [variants, ordersAndDeliveries, stockSummary] = await Promise.all([
      fetchVariants(),
      fetchOrdersAndDeliveries(),
      fetchStockSummary()
    ]);
    setData(prev => ({
      ...prev,
      variants,
      orders: ordersAndDeliveries.orders,
      deliveries: ordersAndDeliveries.deliveries,
      stockItems: [],
      stockSummary
    }));
    await loadDashboard();
    setLoadedSlices(prev => ({
      ...prev,
      products: true,
      orders: true,
      deliveries: true
    }));
    return orderId as string;
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    await refreshAfter(
      supabase.rpc('update_order_status', {
        p_order_id: orderId,
        p_status: status
      }).then(({ error }) => assertNoError(error)),
      async () => {
        await Promise.all([loadDashboard(), ensureOrdersLoaded(true)]);
      }
    );
  };

  const deleteOrder = async (orderId: string) => {
    await refreshAfter(
      supabase.rpc('delete_order', { p_order_id: orderId }).then(({ error }) => assertNoError(error)),
      async () => {
        await Promise.all([loadDashboard(), ensureOrdersLoaded(true)]);
      }
    );
  };

  const updateDelivery = async (orderId: string, updates: Partial<Delivery>) => {
    await refreshAfter(
      supabase.rpc('update_delivery', {
        p_order_id: orderId,
        p_updates: updates
      }).then(({ error }) => assertNoError(error)),
      async () => {
        await Promise.all([loadDashboard(), ensureDeliveriesLoaded(true)]);
      }
    );
  };

  const importBackup = async (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      const normalized = normalizeBackup(parsed);
      const { error: rpcError } = await supabase.rpc('restore_backup', {
        p_backup: normalized
      });
      assertNoError(rpcError);
      setData(EMPTY_DATA);
      setLoadedSlices(EMPTY_SLICE_STATE);
      await loadDashboard();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'อ่านไฟล์ JSON ไม่สำเร็จ' };
    }
  };

  const exportBackup = async () => {
    const { data: stockItems, error: stockItemsError } = await supabase.from('stock_items').select('*');
    assertNoError(stockItemsError);

    return {
      ...data,
      schema_version: BACKUP_SCHEMA_VERSION,
      stockItems: (stockItems || []).map(mapStockItem)
    };
  };

  const clearData = async () => {
    await refreshAfter(
      supabase.rpc('clear_store_data').then(({ error }) => assertNoError(error)),
      async () => {
        setData(EMPTY_DATA);
        setLoadedSlices(EMPTY_SLICE_STATE);
        await loadDashboard();
      }
    );
  };

  return {
    data,
    dashboardSummary,
    loading,
    loadingDashboard,
    loadingSlices,
    loadedSlices,
    error,
    refresh: loadDashboard,
    loadDashboard,
    ensureProductsLoaded,
    ensurePurchaseLoaded,
    ensureOrdersLoaded,
    ensureDeliveriesLoaded,
    ensureReportsLoaded,
    addBrand,
    updateBrand,
    archiveBrand,
    addModel,
    updateModel,
    archiveModel,
    uploadVariantImage,
    addVariant,
    updateVariant,
    archiveVariant,
    addPurchaseBatch,
    addCustomer,
    updateCustomer,
    createOrder,
    updateOrderStatus,
    deleteOrder,
    updateDelivery,
    importBackup,
    exportBackup,
    clearData
  };
}
