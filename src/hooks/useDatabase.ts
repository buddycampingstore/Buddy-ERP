/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  AppDatabase, 
  Brand, 
  Model, 
  Variant, 
  PurchaseBatch, 
  StockItem, 
  Customer, 
  Order, 
  Delivery, 
  OrderItem, 
  OrderStatus, 
  OrderChannel, 
  DeliveryType, 
  DeliveryStatus 
} from '../types';

const EMPTY_DATABASE: AppDatabase = {
  brands: [],
  models: [],
  variants: [],
  purchaseBatches: [],
  stockItems: [],
  customers: [],
  orders: [],
  deliveries: []
};

export function useDatabase() {
  const [db, setDb] = useState<AppDatabase>(EMPTY_DATABASE);

  // Recalculate variant quantities dynamically to ensure robustness
  const syncVariantQuantities = (currentStockItems: StockItem[], currentVariants: Variant[]): Variant[] => {
    return currentVariants.map(v => {
      const activeStock = currentStockItems.filter(item => item.variant_id === v.id && item.status === 'in_stock');
      return {
        ...v,
        qty_in_stock: activeStock.length
      };
    });
  };

  // --- BRANDS ---
  const addBrand = (name: string) => {
    const newBrand: Brand = {
      id: `b-${Date.now()}`,
      name: name.trim()
    };
    setDb(prev => ({
      ...prev,
      brands: [...prev.brands, newBrand]
    }));
    return newBrand;
  };

  const updateBrand = (id: string, name: string) => {
    setDb(prev => ({
      ...prev,
      brands: prev.brands.map(b => b.id === id ? { ...b, name: name.trim() } : b)
    }));
  };

  const deleteBrand = (id: string) => {
    setDb(prev => {
      // Also delete models under this brand, and prevent breaking variants if they exist
      const modelsToDelete = prev.models.filter(m => m.brand_id === id).map(m => m.id);
      return {
        ...prev,
        brands: prev.brands.filter(b => b.id !== id),
        models: prev.models.filter(m => m.brand_id !== id),
        variants: prev.variants.filter(v => !modelsToDelete.includes(v.model_id))
      };
    });
  };

  // --- MODELS ---
  const addModel = (brand_id: string, name: string, image?: string) => {
    const newModel: Model = {
      id: `m-${Date.now()}`,
      brand_id,
      name: name.trim(),
      image
    };
    setDb(prev => ({
      ...prev,
      models: [...prev.models, newModel]
    }));
    return newModel;
  };

  const updateModel = (id: string, name: string, brand_id: string, image?: string) => {
    setDb(prev => ({
      ...prev,
      models: prev.models.map(m => m.id === id ? { ...m, name: name.trim(), brand_id, image: image !== undefined ? image : m.image } : m)
    }));
  };

  const deleteModel = (id: string) => {
    setDb(prev => ({
      ...prev,
      models: prev.models.filter(m => m.id !== id),
      variants: prev.variants.filter(v => v.model_id !== id)
    }));
  };

  // --- VARIANTS ---
  const addVariant = (model_id: string, color: string, standard_sale_price?: number) => {
    const newVariant: Variant = {
      id: `v-${Date.now()}`,
      model_id,
      color: color.trim(),
      qty_in_stock: 0,
      current_wac: 0,
      standard_sale_price: standard_sale_price !== undefined ? standard_sale_price : 0
    };
    setDb(prev => ({
      ...prev,
      variants: [...prev.variants, newVariant]
    }));
    return newVariant;
  };

  const updateVariant = (id: string, color: string, model_id: string, standard_sale_price?: number) => {
    setDb(prev => ({
      ...prev,
      variants: prev.variants.map(v => v.id === id ? { 
        ...v, 
        color: color.trim(), 
        model_id, 
        standard_sale_price: standard_sale_price !== undefined ? standard_sale_price : v.standard_sale_price 
      } : v)
    }));
  };

  const deleteVariant = (id: string) => {
    setDb(prev => ({
      ...prev,
      variants: prev.variants.filter(v => v.id !== id),
      stockItems: prev.stockItems.filter(item => item.variant_id !== id)
    }));
  };

  // --- PURCHASE BATCH & WAC CALCULATION ---
  const addPurchaseBatch = (
    date: string,
    shipping_cost: number,
    other_cost: number,
    items: { variant_id: string; qty: number; unit_price: number }[],
    note?: string
  ) => {
    const batchId = `pb-${Date.now()}`;
    const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
    
    if (totalQty === 0) return null;

    // cost_ใหม่/ตัว = (ราคาสินค้า + shipping + other) / จำนวนทั้งหมดใน batch
    // To handle varying unit_prices correctly, we distribute the shipping+other cost proportionally to unit quantity:
    // cost_ใหม่ per unit of item V = unit_price_V + (shipping_cost + other_cost) / total_qty
    const overheadPerUnit = (shipping_cost + other_cost) / totalQty;

    const newBatch: PurchaseBatch = {
      id: batchId,
      date,
      shipping_cost,
      other_cost,
      items,
      note: note?.trim()
    };

    setDb(prev => {
      const updatedVariants = [...prev.variants];
      const newStockItems: StockItem[] = [];

      items.forEach(batchItem => {
        const variantIndex = updatedVariants.findIndex(v => v.id === batchItem.variant_id);
        if (variantIndex !== -1) {
          const variant = updatedVariants[variantIndex];

          // 1. Calculate qty_เดิม (the count of currently in_stock stockItems for this variant)
          const qty_เดิม = prev.stockItems.filter(
            item => item.variant_id === variant.id && item.status === 'in_stock'
          ).length;

          // 2. WAC_เดิม
          const WAC_เดิม = variant.current_wac;

          // 3. cost_ใหม่ for this item
          const cost_ใหม่ = batchItem.unit_price + overheadPerUnit;

          // 4. Calculate WAC_ใหม่
          // WAC ใหม่ = (qty_เดิม × WAC_เดิม + qty_ใหม่ × cost_ใหม่) / (qty_เดิม + qty_ใหม่)
          const qty_ใหม่ = batchItem.qty;
          let WAC_ใหม่ = cost_ใหม่;
          if (qty_เดิม + qty_ใหม่ > 0) {
            WAC_ใหม่ = (qty_เดิม * WAC_เดิม + qty_ใหม่ * cost_ใหม่) / (qty_เดิม + qty_ใหม่);
          }

          // Round WAC to 2 decimal places
          WAC_ใหม่ = Math.round(WAC_ใหม่ * 100) / 100;

          // Update variant info
          updatedVariants[variantIndex] = {
            ...variant,
            current_wac: WAC_ใหม่,
            qty_in_stock: qty_เดิม + qty_ใหม่
          };

          // Generate StockItem rows
          for (let i = 0; i < qty_ใหม่; i++) {
            newStockItems.push({
              id: `st-${variant.id}-${Date.now()}-${i}`,
              variant_id: variant.id,
              wac_cost: WAC_ใหม่, // record computed WAC as its cost base
              status: 'in_stock',
              batch_id: batchId
            });
          }
        }
      });

      const nextStockItems = [...prev.stockItems, ...newStockItems];
      const nextVariants = syncVariantQuantities(nextStockItems, updatedVariants);

      return {
        ...prev,
        purchaseBatches: [newBatch, ...prev.purchaseBatches],
        stockItems: nextStockItems,
        variants: nextVariants
      };
    });

    return batchId;
  };

  // --- CUSTOMERS ---
  const addCustomer = (customerData: Omit<Customer, 'id'>) => {
    const newCustomer: Customer = {
      id: `c-${Date.now()}`,
      name: customerData.name.trim(),
      phone: customerData.phone.trim(),
      facebook: customerData.facebook.trim(),
      note: customerData.note.trim()
    };
    setDb(prev => ({
      ...prev,
      customers: [...prev.customers, newCustomer]
    }));
    return newCustomer;
  };

  const updateCustomer = (id: string, customerData: Omit<Customer, 'id'>) => {
    setDb(prev => ({
      ...prev,
      customers: prev.customers.map(c => c.id === id ? {
        ...c,
        name: customerData.name.trim(),
        phone: customerData.phone.trim(),
        facebook: customerData.facebook.trim(),
        note: customerData.note.trim()
      } : c)
    }));
  };

  // --- ORDERS, DELIVERIES & SHOT WAC_AT_SALE ---
  const createOrder = (orderData: {
    customer_id: string;
    date: string;
    channel: OrderChannel;
    status: OrderStatus;
    delivery_type: DeliveryType;
    discount: number;
    items: { variant_id: string; qty: number; sale_price: number; discount: number }[];
    shipping_fee?: number;
    shipping_cost?: number;
  }) => {
    const orderId = `ord-${Date.now()}`;
    
    // Validate if enough stock is available for each item
    for (const orderItem of orderData.items) {
      const activeStockCount = db.stockItems.filter(
        item => item.variant_id === orderItem.variant_id && item.status === 'in_stock'
      ).length;
      if (activeStockCount < orderItem.qty) {
        throw new Error(`สินค้าในสต็อกไม่เพียงพอสำหรับทำรายการนี้`);
      }
    }

    setDb(prev => {
      const updatedStockItems = [...prev.stockItems];
      const orderItemsList: OrderItem[] = [];

      orderData.items.forEach((itemParam, index) => {
        // Collect required qty of in_stock items of this variant
        const availableItems = updatedStockItems.filter(
          item => item.variant_id === itemParam.variant_id && item.status === 'in_stock'
        );

        const currentWac = prev.variants.find(v => v.id === itemParam.variant_id)?.current_wac || 0;

        for (let i = 0; i < itemParam.qty; i++) {
          const stockDoc = availableItems[i];
          
          // Update status of this specific StockItem
          const stockIndex = updatedStockItems.findIndex(s => s.id === stockDoc.id);
          if (stockIndex !== -1) {
            updatedStockItems[stockIndex] = {
              ...updatedStockItems[stockIndex],
              status: 'sold',
              order_id: orderId
            };

            // Calculate profit based on snapshotted WAC at the moment of sale
            const final_price = itemParam.sale_price - itemParam.discount;
            const profit = final_price - currentWac;

            orderItemsList.push({
              id: `oi-${orderId}-${index}-${i}`,
              stock_item_id: stockDoc.id,
              variant_id: itemParam.variant_id,
              sale_price: itemParam.sale_price,
              discount: itemParam.discount,
              final_price,
              wac_at_sale: currentWac, // Snapshot cost base (CRITICAL)
              profit: Math.round(profit * 100) / 100
            });
          }
        }
      });

      const newOrder: Order = {
        id: orderId,
        customer_id: orderData.customer_id,
        date: orderData.date,
        channel: orderData.channel,
        status: orderData.status,
        delivery_type: orderData.delivery_type,
        discount: orderData.discount,
        items: orderItemsList,
        shipping_fee: orderData.shipping_fee || 0,
        shipping_cost: orderData.shipping_cost || 0
      };

      // Create a Delivery item
      const deliveryStatusMap: Record<OrderStatus, DeliveryStatus> = {
        'pending': 'pending',
        'confirmed': 'pending',
        'shipped': 'dispatched',
        'delivered': 'delivered'
      };

      const newDelivery: Delivery = {
        id: `del-${Date.now()}`,
        order_id: orderId,
        tracking: '',
        pickup_datetime: '',
        status: deliveryStatusMap[orderData.status]
      };

      const nextVariants = syncVariantQuantities(updatedStockItems, prev.variants);

      return {
        ...prev,
        orders: [newOrder, ...prev.orders],
        deliveries: [...prev.deliveries, newDelivery],
        stockItems: updatedStockItems,
        variants: nextVariants
      };
    });

    return orderId;
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    const deliveryStatusMap: Record<OrderStatus, DeliveryStatus> = {
      'pending': 'pending',
      'confirmed': 'pending',
      'shipped': 'dispatched',
      'delivered': 'delivered'
    };

    setDb(prev => ({
      ...prev,
      orders: prev.orders.map(o => o.id === orderId ? { ...o, status } : o),
      deliveries: prev.deliveries.map(d => d.order_id === orderId ? {
        ...d,
        status: deliveryStatusMap[status]
      }: d)
    }));
  };

  const deleteOrder = (orderId: string) => {
    setDb(prev => {
      // Find all StockItems committed to this order and restore them
      const nextStockItems = prev.stockItems.map(item => {
        if (item.order_id === orderId) {
          return {
            ...item,
            status: 'in_stock' as const,
            order_id: undefined
          };
        }
        return item;
      });

      const nextVariants = syncVariantQuantities(nextStockItems, prev.variants);

      return {
        ...prev,
        orders: prev.orders.filter(o => o.id !== orderId),
        deliveries: prev.deliveries.filter(d => d.order_id !== orderId),
        stockItems: nextStockItems,
        variants: nextVariants
      };
    });
  };

  // --- DELIVERIES ---
  const updateDelivery = (orderId: string, updates: Partial<Delivery>) => {
    setDb(prev => {
      const updatedDeliveries = prev.deliveries.map(d => {
        if (d.order_id === orderId) {
          return {
            ...d,
            ...updates
          };
        }
        return d;
      });

      // Synchronize back order status if delivery status is changed explicitly
      // dispatched -> shipped, delivered -> delivered
      let updatedOrders = [...prev.orders];
      if (updates.status) {
        const orderStatusMap: Record<DeliveryStatus, OrderStatus | null> = {
          'pending': 'confirmed',
          'dispatched': 'shipped',
          'delivered': 'delivered'
        };
        const orderStatusUpdate = orderStatusMap[updates.status];
        if (orderStatusUpdate) {
          updatedOrders = prev.orders.map(o => o.id === orderId ? {
            ...o,
            status: orderStatusUpdate
          } : o);
        }
      }

      return {
        ...prev,
        deliveries: updatedDeliveries,
        orders: updatedOrders
      };
    });
  };

  // --- BACKUP / IMPORT / EXPORT / RESET ---
  const importBackup = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString) as AppDatabase;
      if (
        Array.isArray(parsed.brands) &&
        Array.isArray(parsed.models) &&
        Array.isArray(parsed.variants) &&
        Array.isArray(parsed.purchaseBatches) &&
        Array.isArray(parsed.stockItems) &&
        Array.isArray(parsed.customers) &&
        Array.isArray(parsed.orders) &&
        Array.isArray(parsed.deliveries)
      ) {
        setDb(parsed);
        return { success: true };
      } else {
        return { success: false, error: 'รูปแบบข้อมูลสำรองไม่ถูกต้อง (ขาดตารางข้อมูลหลักสำคัญ)' };
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'การอ่านไฟล์ JSON ล้มเหลว' };
    }
  };

  const resetDatabase = () => {
    setDb(EMPTY_DATABASE);
  };

  const clearDatabase = () => {
    setDb(EMPTY_DATABASE);
  };

  return {
    db,
    addBrand,
    updateBrand,
    deleteBrand,
    addModel,
    updateModel,
    deleteModel,
    addVariant,
    updateVariant,
    deleteVariant,
    addPurchaseBatch,
    addCustomer,
    updateCustomer,
    createOrder,
    updateOrderStatus,
    deleteOrder,
    updateDelivery,
    importBackup,
    resetDatabase,
    clearDatabase,
    setDb
  };
}
