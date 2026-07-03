/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AppData,
  Brand,
  Customer,
  Delivery,
  DeliveryType,
  Model,
  OrderChannel,
  OrderItem,
  OrderStatus,
  StockItem
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

const requireArray = (value: unknown, label: string) => {
  if (!Array.isArray(value)) {
    throw new Error(`Backup is missing ${label}`);
  }
  return value;
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
    brands: brands.map((brand: any) => ({
      ...brand,
      is_active: brand.is_active !== false,
      archived_at: brand.archived_at ?? null
    })),
    models: models.map((model: any) => ({
      ...model,
      is_active: model.is_active !== false,
      archived_at: model.archived_at ?? null
    })),
    variants: variants.map((variant: any) => ({
      ...variant,
      qty_in_stock: Number(variant.qty_in_stock || 0),
      current_wac: Number(variant.current_wac || 0),
      standard_sale_price: Number(variant.standard_sale_price || 0),
      is_active: variant.is_active !== false,
      archived_at: variant.archived_at ?? null
    })),
    purchaseBatches: purchaseBatches.map((batch: any) => ({
      ...batch,
      items: Array.isArray(batch.items) ? batch.items : []
    })),
    stockItems: stockItems as StockItem[],
    customers: customers as Customer[],
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
    deliveries: deliveries as Delivery[]
  };
};

export function useAppData() {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        stockItemsRes,
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
        supabase.from('stock_items').select('*'),
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
        stockItemsRes,
        customersRes,
        ordersRes,
        orderItemsRes,
        deliveriesRes
      ].forEach((result) => assertNoError(result.error));

      const purchaseItemsByBatch = new Map<string, DbPurchaseBatchItem[]>();
      (purchaseBatchItemsRes.data || []).forEach((item: DbPurchaseBatchItem) => {
        const list = purchaseItemsByBatch.get(item.batch_id) || [];
        list.push({
          batch_id: item.batch_id,
          variant_id: item.variant_id,
          qty: item.qty,
          unit_price: Number(item.unit_price)
        });
        purchaseItemsByBatch.set(item.batch_id, list);
      });

      const orderItemsByOrder = new Map<string, OrderItem[]>();
      (orderItemsRes.data || []).forEach((item: DbOrderItem) => {
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

      const nextData: AppData = {
        schema_version: BACKUP_SCHEMA_VERSION,
        brands: (brandsRes.data || []).map((brand: any): Brand => ({
          id: brand.id,
          name: brand.name,
          is_active: brand.is_active !== false,
          archived_at: brand.archived_at || null
        })),
        models: (modelsRes.data || []).map((model: any): Model => ({
          id: model.id,
          brand_id: model.brand_id,
          name: model.name,
          image: model.image || undefined,
          is_active: model.is_active !== false,
          archived_at: model.archived_at || null
        })),
        variants: (variantsRes.data || []).map((variant: any) => ({
          id: variant.id,
          model_id: variant.model_id,
          color: variant.color,
          qty_in_stock: Number(variant.qty_in_stock || 0),
          current_wac: Number(variant.current_wac || 0),
          standard_sale_price: Number(variant.standard_sale_price || 0),
          is_active: variant.is_active !== false,
          archived_at: variant.archived_at || null
        })),
        purchaseBatches: sortByDateDesc((purchaseBatchesRes.data || []).map((batch: any) => ({
          id: batch.id,
          date: batch.date,
          shipping_cost: Number(batch.shipping_cost || 0),
          other_cost: Number(batch.other_cost || 0),
          items: purchaseItemsByBatch.get(batch.id) || [],
          note: batch.note || undefined
        }))),
        stockItems: (stockItemsRes.data || []).map((item: any): StockItem => ({
          id: item.id,
          variant_id: item.variant_id,
          wac_cost: Number(item.wac_cost),
          status: item.status,
          order_id: item.order_id || undefined,
          batch_id: item.batch_id
        })),
        customers: (customersRes.data || []).map((customer: any): Customer => ({
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          facebook: customer.facebook,
          note: customer.note
        })),
        orders: sortByDateDesc((ordersRes.data || []).map((order: any) => ({
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
        }))),
        deliveries: (deliveriesRes.data || []).map((delivery: any): Delivery => ({
          id: delivery.id,
          order_id: delivery.order_id,
          tracking: delivery.tracking,
          pickup_datetime: delivery.pickup_datetime,
          status: delivery.status
        }))
      };

      setData(nextData);
    } catch (err: any) {
      const message = err?.message || 'โหลดข้อมูลจาก Supabase ไม่สำเร็จ';
      setError(message);
      console.error(message, err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAfter = useCallback(async <T,>(operation: Promise<T>) => {
    const result = await operation;
    await loadData();
    return result;
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addBrand = async (name: string) => {
    const { data: created, error: insertError } = await supabase
      .from('brands')
      .insert({ name: name.trim() })
      .select()
      .single();
    assertNoError(insertError);
    await loadData();
    return created as Brand;
  };

  const updateBrand = async (id: string, name: string) => {
    await refreshAfter(
      supabase.from('brands').update({ name: name.trim() }).eq('id', id).then(({ error }) => assertNoError(error))
    );
  };

  const archiveBrand = async (id: string) => {
    await refreshAfter(
      supabase.rpc('archive_brand', { p_brand_id: id }).then(({ error }) => assertNoError(error))
    );
  };

  const addModel = async (brand_id: string, name: string, image?: string) => {
    const { data: created, error: insertError } = await supabase
      .from('models')
      .insert({ brand_id, name: name.trim(), image: image || null })
      .select()
      .single();
    assertNoError(insertError);
    await loadData();
    return created as Model;
  };

  const updateModel = async (id: string, name: string, brand_id: string, image?: string) => {
    await refreshAfter(
      supabase
        .from('models')
        .update({ name: name.trim(), brand_id, image: image !== undefined ? image : null })
        .eq('id', id)
        .then(({ error }) => assertNoError(error))
    );
  };

  const archiveModel = async (id: string) => {
    await refreshAfter(
      supabase.rpc('archive_model', { p_model_id: id }).then(({ error }) => assertNoError(error))
    );
  };

  const uploadModelImage = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const imageId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `models/${imageId}.${extension}`;

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

  const addVariant = async (model_id: string, color: string, standard_sale_price?: number) => {
    const { data: created, error: insertError } = await supabase
      .from('variants')
      .insert({
        model_id,
        color: color.trim(),
        standard_sale_price: standard_sale_price || 0
      })
      .select()
      .single();
    assertNoError(insertError);
    await loadData();
    return created;
  };

  const updateVariant = async (id: string, color: string, model_id: string, standard_sale_price?: number) => {
    await refreshAfter(
      supabase
        .from('variants')
        .update({
          color: color.trim(),
          model_id,
          standard_sale_price: standard_sale_price || 0
        })
        .eq('id', id)
        .then(({ error }) => assertNoError(error))
    );
  };

  const archiveVariant = async (id: string) => {
    await refreshAfter(
      supabase.rpc('archive_variant', { p_variant_id: id }).then(({ error }) => assertNoError(error))
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
    await loadData();
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
    await loadData();
    return created as Customer;
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
        .then(({ error }) => assertNoError(error))
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
    await loadData();
    return orderId as string;
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    await refreshAfter(
      supabase.rpc('update_order_status', {
        p_order_id: orderId,
        p_status: status
      }).then(({ error }) => assertNoError(error))
    );
  };

  const deleteOrder = async (orderId: string) => {
    await refreshAfter(
      supabase.rpc('delete_order', { p_order_id: orderId }).then(({ error }) => assertNoError(error))
    );
  };

  const updateDelivery = async (orderId: string, updates: Partial<Delivery>) => {
    await refreshAfter(
      supabase.rpc('update_delivery', {
        p_order_id: orderId,
        p_updates: updates
      }).then(({ error }) => assertNoError(error))
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
      await loadData();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'อ่านไฟล์ JSON ไม่สำเร็จ' };
    }
  };

  const clearData = async () => {
    await refreshAfter(
      supabase.rpc('clear_store_data').then(({ error }) => assertNoError(error))
    );
  };

  return {
    data,
    loading,
    error,
    refresh: loadData,
    addBrand,
    updateBrand,
    archiveBrand,
    addModel,
    updateModel,
    archiveModel,
    uploadModelImage,
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
    clearData
  };
}
