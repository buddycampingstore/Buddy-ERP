/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppData,
  Brand,
  Customer,
  DashboardSummary,
  Delivery,
  DeliveryType,
  Model,
  OrderPageFilters,
  OrderChannel,
  OrderItem,
  OrderStatus,
  PaginatedOrdersPayload,
  PaginatedPurchasePayload,
  ProductsPayload,
  StockSummary,
  Variant
} from '../types';
import { supabase } from '../lib/supabase';

const BACKUP_SCHEMA_VERSION = 2;
const GENERAL_CUSTOMER_NAME = 'ลูกค้าทั่วไป';
export const DEFAULT_PAGE_SIZE = 50;

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
  brand_name_snapshot: string;
  model_name_snapshot: string;
  variant_color_snapshot: string;
};

type DbStockSummary = {
  variant_id: string;
  in_stock_qty: number;
  in_stock_value: number;
};

type DataSlice = 'products' | 'purchase' | 'orders';

type SliceState = Record<DataSlice, boolean>;

const EMPTY_SLICE_STATE: SliceState = {
  products: false,
  purchase: false,
  orders: false
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



const mapStockSummary = (item: DbStockSummary): StockSummary => ({
  variant_id: item.variant_id,
  in_stock_qty: Number(item.in_stock_qty || 0),
  in_stock_value: Number(item.in_stock_value || 0)
});

const mapStockSummaryFromVariants = (variants: Variant[]): StockSummary[] => (
  variants.map((variant) => ({
    variant_id: variant.id,
    in_stock_qty: variant.qty_in_stock,
    in_stock_value: variant.qty_in_stock * variant.current_wac
  }))
);

const timeSupabaseCall = async <T,>(label: string, call: () => PromiseLike<T>): Promise<T> => {
  if (!import.meta.env.DEV) return await call();

  const start = Date.now();
  try {
    return await call();
  } finally {
    console.debug(`[supabase] ${label}: ${Date.now() - start}ms`);
  }
};

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
      qty: Number(item.qty),
      unit_price: Number(item.unit_price),
      brand_name_snapshot: item.brand_name_snapshot || '',
      model_name_snapshot: item.model_name_snapshot || '',
      variant_color_snapshot: item.variant_color_snapshot || ''
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

const mapOrderItem = (item: any): OrderItem => ({
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

const mapOrder = (order: any, items: any[] = []): AppData['orders'][number] => ({
  id: order.id,
  customer_id: order.customer_id && order.customer_id !== 'general' ? order.customer_id : null,
  customer_name_snapshot: order.customer_name_snapshot || GENERAL_CUSTOMER_NAME,
  date: order.date,
  channel: order.channel,
  status: order.status,
  delivery_type: order.delivery_type,
  discount: Number(order.discount || 0),
  items: items.map(mapOrderItem),
  shipping_fee: Number(order.shipping_fee || 0),
  shipping_cost: Number(order.shipping_cost || 0)
});

export const mergeUniqueById = <T extends { id: string }>(current: T[], incoming: T[]) => {
  const merged = new Map<string, T>();
  current.forEach((item) => merged.set(item.id, item));
  incoming.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values());
};

export const mapProductsPayload = (payload: any): ProductsPayload => ({
  brands: Array.isArray(payload?.brands) ? payload.brands.map(mapBrand) : [],
  models: Array.isArray(payload?.models) ? payload.models.map(mapModel) : [],
  variants: Array.isArray(payload?.variants) ? payload.variants.map(mapVariant) : []
});

export const normalizeProductsPayload = (payload: any): Required<ProductsPayload> => {
  const products = mapProductsPayload(payload);
  return {
    ...products,
    stock_summary: Array.isArray(payload?.stock_summary)
      ? payload.stock_summary.map(mapStockSummary)
      : mapStockSummaryFromVariants(products.variants)
  };
};

export const mapOrdersPagePayload = (payload: any): PaginatedOrdersPayload => ({
  orders: Array.isArray(payload?.orders)
    ? sortByDateDesc(payload.orders.map((order: any) => mapOrder(order, Array.isArray(order.items) ? order.items : [])))
    : [],
  deliveries: Array.isArray(payload?.deliveries) ? payload.deliveries.map(mapDelivery) : [],
  total_count: Number(payload?.total_count || 0)
});

export const mapPurchasePagePayload = (payload: any): PaginatedPurchasePayload => ({
  purchase_batches: Array.isArray(payload?.purchase_batches)
    ? buildPurchaseBatches(
        payload.purchase_batches,
        payload.purchase_batches.flatMap((batch: any) =>
          Array.isArray(batch.items)
            ? batch.items.map((item: any) => ({ ...item, batch_id: item.batch_id || batch.id }))
            : []
        )
      )
    : [],
  total_count: Number(payload?.total_count || 0)
});

export function useAppData() {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingSlices, setLoadingSlices] = useState<SliceState>(EMPTY_SLICE_STATE);
  const [loadedSlices, setLoadedSlices] = useState<SliceState>(EMPTY_SLICE_STATE);
  const [ordersTotalCount, setOrdersTotalCount] = useState(0);
  const [purchaseTotalCount, setPurchaseTotalCount] = useState(0);
  const [orderFilters, setOrderFiltersState] = useState<OrderPageFilters>({ status: 'all', search: '' });
  const [error, setError] = useState<string | null>(null);
  const [archivedProducts, setArchivedProducts] = useState<ProductsPayload>({ brands: [], models: [], variants: [] });
  const [archivedLoaded, setArchivedLoaded] = useState(false);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const productsRequestRef = useRef<Promise<Required<ProductsPayload>> | null>(null);
  const customersLoadedRef = useRef(false);
  const ordersRequestSeqRef = useRef(0);

  const setSliceLoading = useCallback((slice: DataSlice, value: boolean) => {
    setLoadingSlices(prev => ({ ...prev, [slice]: value }));
  }, []);



  const fetchProducts = useCallback(async (force = false): Promise<Required<ProductsPayload>> => {
    if (!force && productsRequestRef.current) {
      return productsRequestRef.current;
    }

    let request: Promise<Required<ProductsPayload>>;
    request = (async () => {
      try {
        const { data: payload, error } = await timeSupabaseCall('get_products_payload', () =>
          supabase.rpc('get_products_payload')
        );
        assertNoError(error);
        return normalizeProductsPayload(payload);
      } finally {
        if (productsRequestRef.current === request) {
          productsRequestRef.current = null;
        }
      }
    })();

    productsRequestRef.current = request;
    return request;
  }, []);

  const fetchCustomers = useCallback(async () => {
    const { data: customers, error } = await timeSupabaseCall('customers', () =>
      supabase.from('customers').select('*').order('name')
    );
    assertNoError(error);
    return (customers || []).map(mapCustomer);
  }, []);

  const fetchPurchasePage = useCallback(async (offset = 0) => {
    const { data: payload, error } = await timeSupabaseCall('get_purchase_page', () =>
      supabase.rpc('get_purchase_page', {
        p_limit: DEFAULT_PAGE_SIZE,
        p_offset: offset
      })
    );
    assertNoError(error);
    return mapPurchasePagePayload(payload);
  }, []);

  const fetchOrdersPage = useCallback(async (filters: OrderPageFilters, offset = 0) => {
    const { data: payload, error } = await timeSupabaseCall('get_orders_page', () =>
      supabase.rpc('get_orders_page', {
        p_limit: DEFAULT_PAGE_SIZE,
        p_offset: offset,
        p_status: filters.status,
        p_search: filters.search.trim() || null
      })
    );
    assertNoError(error);
    return mapOrdersPagePayload(payload);
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



  const ensureProductsLoaded = useCallback(async (force = false) => {
    if (!force && loadedSlices.products) return;
    setSliceLoading('products', true);
    setError(null);

    try {
      const products = await fetchProducts(force);
      setData(prev => ({
        ...prev,
        brands: products.brands,
        models: products.models,
        variants: products.variants,
        stockItems: [],
        stockSummary: products.stock_summary
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

  const fetchArchivedProducts = useCallback(async () => {
    const { data: payload, error } = await timeSupabaseCall('get_archived_products', () =>
      supabase.rpc('get_archived_products')
    );
    assertNoError(error);
    return mapProductsPayload(payload);
  }, []);

  // "ซ่อน" (archive) used to be a one-way trip — nothing fetched archived rows
  // for viewing/undo, so hiding something read as permanent deletion. This is
  // loaded lazily only when the user opens the "ของที่ซ่อนไว้" panel.
  const ensureArchivedProductsLoaded = useCallback(async (force = false) => {
    if (!force && archivedLoaded) return;
    setLoadingArchived(true);
    setError(null);
    try {
      const archived = await fetchArchivedProducts();
      setArchivedProducts(archived);
      setArchivedLoaded(true);
    } catch (err: any) {
      const message = err?.message || 'โหลดข้อมูลสินค้าที่ซ่อนไม่สำเร็จ';
      setError(message);
      console.error(message, err);
    } finally {
      setLoadingArchived(false);
    }
  }, [archivedLoaded, fetchArchivedProducts]);

  const ensurePurchaseLoaded = useCallback(async (force = false) => {
    if (!force && loadedSlices.purchase) return;
    setSliceLoading('purchase', true);
    setError(null);

    try {
      const purchasePage = await fetchPurchasePage(0);
      setData(prev => ({
        ...prev,
        purchaseBatches: purchasePage.purchase_batches,
        stockItems: []
      }));
      setPurchaseTotalCount(purchasePage.total_count);
      setLoadedSlices(prev => ({ ...prev, purchase: true }));
    } catch (err: any) {
      const message = err?.message || 'โหลดข้อมูลรับเข้าคลังไม่สำเร็จ';
      setError(message);
      console.error(message, err);
    } finally {
      setSliceLoading('purchase', false);
    }
  }, [fetchPurchasePage, loadedSlices.purchase, setSliceLoading]);

  const loadMorePurchaseBatches = useCallback(async () => {
    if (loadingSlices.purchase || data.purchaseBatches.length >= purchaseTotalCount) return;
    setSliceLoading('purchase', true);
    setError(null);

    try {
      const page = await fetchPurchasePage(data.purchaseBatches.length);
      setData(prev => ({
        ...prev,
        purchaseBatches: mergeUniqueById(prev.purchaseBatches, page.purchase_batches)
      }));
      setPurchaseTotalCount(page.total_count);
      setLoadedSlices(prev => ({ ...prev, purchase: true }));
    } catch (err: any) {
      const message = err?.message || 'โหลดประวัติรับเข้าเพิ่มเติมไม่สำเร็จ';
      setError(message);
      console.error(message, err);
    } finally {
      setSliceLoading('purchase', false);
    }
  }, [data.purchaseBatches.length, fetchPurchasePage, loadingSlices.purchase, purchaseTotalCount, setSliceLoading]);

  const loadOrdersPage = useCallback(async (
    filters: OrderPageFilters,
    offset = 0,
    mode: 'replace' | 'append' = 'replace'
  ) => {
    const requestSeq = ++ordersRequestSeqRef.current;
    setSliceLoading('orders', true);
    setError(null);

    try {
      const shouldLoadCustomers = !customersLoadedRef.current;
      const [customers, ordersPage] = await Promise.all([
        shouldLoadCustomers ? fetchCustomers() : Promise.resolve(null),
        fetchOrdersPage(filters, offset)
      ]);

      if (requestSeq !== ordersRequestSeqRef.current) return;
      if (customers) customersLoadedRef.current = true;

      setData(prev => ({
        ...prev,
        ...(customers ? { customers } : {}),
        orders: mode === 'append'
          ? mergeUniqueById(prev.orders, ordersPage.orders)
          : ordersPage.orders,
        deliveries: mode === 'append'
          ? mergeUniqueById(prev.deliveries, ordersPage.deliveries)
          : ordersPage.deliveries
      }));
      setOrdersTotalCount(ordersPage.total_count);
      setLoadedSlices(prev => ({
        ...prev,
        orders: true
      }));
    } finally {
      if (requestSeq === ordersRequestSeqRef.current) {
        setSliceLoading('orders', false);
      }
    }
  }, [fetchCustomers, fetchOrdersPage, setSliceLoading]);

  const ensureOrdersLoaded = useCallback(async (force = false) => {
    if (!force && loadedSlices.orders) return;

    try {
      await loadOrdersPage(orderFilters, 0, 'replace');
    } catch (err: any) {
      const message = err?.message || 'โหลดข้อมูลออเดอร์ไม่สำเร็จ';
      setError(message);
      console.error(message, err);
    }
  }, [loadOrdersPage, loadedSlices.orders, orderFilters]);

  const loadMoreOrders = useCallback(async () => {
    if (loadingSlices.orders || data.orders.length >= ordersTotalCount) return;

    try {
      await loadOrdersPage(orderFilters, data.orders.length, 'append');
    } catch (err: any) {
      const message = err?.message || 'โหลดออเดอร์เพิ่มเติมไม่สำเร็จ';
      setError(message);
      console.error(message, err);
    }
  }, [data.orders.length, loadOrdersPage, loadingSlices.orders, orderFilters, ordersTotalCount]);

  const setOrderFilters = useCallback((nextFilters: OrderPageFilters) => {
    const normalizedFilters: OrderPageFilters = {
      status: nextFilters.status,
      search: nextFilters.search.trim()
    };
    setOrderFiltersState(normalizedFilters);

    if (loadedSlices.orders) {
      void loadOrdersPage(normalizedFilters, 0, 'replace');
    }
  }, [loadOrdersPage, loadedSlices.orders]);



  const refreshAfter = useCallback(async <T,>(operation: Promise<T>, reload: () => Promise<void> = loadDashboard) => {
    const result = await operation;
    await reload();
    return result;
  }, [loadDashboard]);

  const prefetchedRef = useRef(false);

  // Memoize the prefetch targets so the effect doesn't re-run on
  // every render.  The ensure* callbacks are stable after mount.
  const prefetchTargets = useMemo(
    () => [ensureProductsLoaded, ensurePurchaseLoaded, ensureOrdersLoaded],
    [ensureProductsLoaded, ensurePurchaseLoaded, ensureOrdersLoaded]
  );

  useEffect(() => {
    loadDashboard().then(() => {
      if (!prefetchedRef.current) {
        prefetchedRef.current = true;
        // Fire-and-forget: preload all tabs in the background
        void Promise.allSettled(prefetchTargets.map(fn => fn()));
      }
    });
  }, [loadDashboard, prefetchTargets]);

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
    const trimmed = name.trim();
    await supabase.from('brands').update({ name: trimmed }).eq('id', id).then(({ error }) => assertNoError(error));
    // Patch locally instead of refetching the whole products payload for a
    // single renamed row. Nothing on the dashboard depends on a brand name.
    setData(prev => ({
      ...prev,
      brands: prev.brands
        .map(b => (b.id === id ? { ...b, name: trimmed } : b))
        .sort((a, b) => a.name.localeCompare(b.name))
    }));
  };

  const archiveBrand = async (id: string) => {
    await supabase.rpc('archive_brand', { p_brand_id: id }).then(({ error }) => assertNoError(error));
    // archive_brand cascades to the brand's models and their variants, so
    // remove all three locally to mirror the server without a full refetch.
    setData(prev => {
      const removedModelIds = new Set(prev.models.filter(m => m.brand_id === id).map(m => m.id));
      const removedVariantIds = new Set(prev.variants.filter(v => removedModelIds.has(v.model_id)).map(v => v.id));
      return {
        ...prev,
        brands: prev.brands.filter(b => b.id !== id),
        models: prev.models.filter(m => m.brand_id !== id),
        variants: prev.variants.filter(v => !removedVariantIds.has(v.id)),
        stockSummary: prev.stockSummary.filter(s => !removedVariantIds.has(s.variant_id))
      };
    });
    // Archiving can remove in-stock variants, which changes dashboard totals.
    await loadDashboard();
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
    const trimmed = name.trim();
    const nextImage = image !== undefined ? image : null;
    await supabase
      .from('models')
      .update({ name: trimmed, brand_id, image: nextImage })
      .eq('id', id)
      .then(({ error }) => assertNoError(error));
    setData(prev => ({
      ...prev,
      models: prev.models
        .map(m => (m.id === id ? { ...m, name: trimmed, brand_id, image: nextImage || undefined } : m))
        .sort((a, b) => a.name.localeCompare(b.name))
    }));
  };

  const archiveModel = async (id: string) => {
    await supabase.rpc('archive_model', { p_model_id: id }).then(({ error }) => assertNoError(error));
    // archive_model cascades to the model's variants.
    setData(prev => {
      const removedVariantIds = new Set(prev.variants.filter(v => v.model_id === id).map(v => v.id));
      return {
        ...prev,
        models: prev.models.filter(m => m.id !== id),
        variants: prev.variants.filter(v => !removedVariantIds.has(v.id)),
        stockSummary: prev.stockSummary.filter(s => !removedVariantIds.has(s.variant_id))
      };
    });
    await loadDashboard();
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
    const trimmedColor = color.trim();
    const nextPrice = standard_sale_price || 0;
    const nextImage = image || null;
    await supabase
      .from('variants')
      .update({
        color: trimmedColor,
        model_id,
        standard_sale_price: nextPrice,
        image: nextImage
      })
      .eq('id', id)
      .then(({ error }) => assertNoError(error));
    setData(prev => ({
      ...prev,
      variants: prev.variants
        .map(v => (v.id === id
          ? { ...v, color: trimmedColor, model_id, standard_sale_price: nextPrice, image: nextImage || undefined }
          : v))
        .sort((a, b) => a.color.localeCompare(b.color))
    }));
  };

  const archiveVariant = async (id: string) => {
    await supabase.rpc('archive_variant', { p_variant_id: id }).then(({ error }) => assertNoError(error));
    setData(prev => ({
      ...prev,
      variants: prev.variants.filter(v => v.id !== id),
      stockSummary: prev.stockSummary.filter(s => s.variant_id !== id)
    }));
    await loadDashboard();
  };

  // Restoring can cascade (e.g. restoring a brand un-hides its models and
  // variants too), so the affected set isn't knowable from the client alone —
  // refetch both the archived list and the active catalog rather than patch.
  const restoreBrand = async (id: string) => {
    await supabase.rpc('restore_brand', { p_brand_id: id }).then(({ error }) => assertNoError(error));
    await Promise.all([
      ensureArchivedProductsLoaded(true),
      ensureProductsLoaded(true),
      loadDashboard()
    ]);
  };

  const restoreModel = async (id: string) => {
    await supabase.rpc('restore_model', { p_model_id: id }).then(({ error }) => assertNoError(error));
    await Promise.all([
      ensureArchivedProductsLoaded(true),
      ensureProductsLoaded(true),
      loadDashboard()
    ]);
  };

  const restoreVariant = async (id: string) => {
    await supabase.rpc('restore_variant', { p_variant_id: id }).then(({ error }) => assertNoError(error));
    await Promise.all([
      ensureArchivedProductsLoaded(true),
      ensureProductsLoaded(true),
      loadDashboard()
    ]);
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

    const [products, purchasePage] = await Promise.all([
      fetchProducts(true),
      fetchPurchasePage(0),
      loadDashboard()
    ]);
    setData(prev => ({
      ...prev,
      brands: products.brands,
      models: products.models,
      variants: products.variants,
      purchaseBatches: purchasePage.purchase_batches,
      stockItems: [],
      stockSummary: products.stock_summary
    }));
    setPurchaseTotalCount(purchasePage.total_count);
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
    customersLoadedRef.current = true;
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
        customersLoadedRef.current = false;
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

    const [products, ordersPage] = await Promise.all([
      fetchProducts(true),
      fetchOrdersPage(orderFilters, 0),
      loadDashboard()
    ]);
    setData(prev => ({
      ...prev,
      brands: products.brands,
      models: products.models,
      variants: products.variants,
      orders: ordersPage.orders,
      deliveries: ordersPage.deliveries,
      stockItems: [],
      stockSummary: products.stock_summary
    }));
    setOrdersTotalCount(ordersPage.total_count);
    setLoadedSlices(prev => ({
      ...prev,
      products: true,
      orders: true
    }));
    return orderId as string;
  };

  const updateOrder = async (orderId: string, orderData: {
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
    const { error: rpcError } = await supabase.rpc('update_order', {
      p_order_id: orderId,
      p_order: orderData
    });
    assertNoError(rpcError);

    // Editing an order re-consumes stock and rewrites WAC/profit snapshots, so
    // refresh products + orders + dashboard like createOrder does.
    const [products, ordersPage] = await Promise.all([
      fetchProducts(true),
      fetchOrdersPage(orderFilters, 0),
      loadDashboard()
    ]);
    setData(prev => ({
      ...prev,
      brands: products.brands,
      models: products.models,
      variants: products.variants,
      orders: ordersPage.orders,
      deliveries: ordersPage.deliveries,
      stockItems: [],
      stockSummary: products.stock_summary
    }));
    setOrdersTotalCount(ordersPage.total_count);
    setLoadedSlices(prev => ({
      ...prev,
      products: true,
      orders: true
    }));
    return orderId;
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    await refreshAfter(
      supabase.rpc('update_order_status', {
        p_order_id: orderId,
        p_status: status
      }).then(({ error }) => assertNoError(error)),
      async () => {
        await Promise.all([loadDashboard(), loadOrdersPage(orderFilters, 0, 'replace')]);
      }
    );
  };

  const deleteOrder = async (orderId: string) => {
    await refreshAfter(
      supabase.rpc('delete_order', { p_order_id: orderId }).then(({ error }) => assertNoError(error)),
      async () => {
        await Promise.all([loadDashboard(), ensureProductsLoaded(true), ensureOrdersLoaded(true)]);
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
        await Promise.all([loadDashboard(), loadOrdersPage(orderFilters, 0, 'replace')]);
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
    orderFilters,
    ordersTotalCount,
    ordersHasMore: data.orders.length < ordersTotalCount,
    purchaseTotalCount,
    purchaseHasMore: data.purchaseBatches.length < purchaseTotalCount,
    pageSize: DEFAULT_PAGE_SIZE,
    error,
    refresh: loadDashboard,
    loadDashboard,
    ensureProductsLoaded,
    ensureArchivedProductsLoaded,
    archivedProducts,
    archivedLoaded,
    loadingArchived,
    ensurePurchaseLoaded,
    ensureOrdersLoaded,
    loadMoreOrders,
    loadMorePurchaseBatches,
    setOrderFilters,
    addBrand,
    updateBrand,
    archiveBrand,
    restoreBrand,
    addModel,
    updateModel,
    archiveModel,
    restoreModel,
    uploadVariantImage,
    addVariant,
    updateVariant,
    archiveVariant,
    restoreVariant,
    addPurchaseBatch,
    addCustomer,
    updateCustomer,
    createOrder,
    updateOrder,
    updateOrderStatus,
    deleteOrder,
    updateDelivery,

  };
}
