import { describe, expect, it } from 'vitest';
import {
  mapOrdersPagePayload,
  mapProductsPayload,
  mapPurchasePagePayload,
  mergeUniqueById
} from './useAppData';

describe('useAppData payload mappers', () => {
  it('maps the products RPC payload into app slices', () => {
    const payload = mapProductsPayload({
      brands: [{ id: 'brand-1', name: 'Buddy', is_active: true }],
      models: [{ id: 'model-1', brand_id: 'brand-1', name: 'Camp', image: null, is_active: true }],
      variants: [{
        id: 'variant-1',
        model_id: 'model-1',
        color: 'Khaki',
        image: null,
        qty_in_stock: '3',
        current_wac: '1200.50',
        standard_sale_price: '2200',
        is_active: true
      }],
      stock_summary: [{ variant_id: 'variant-1', in_stock_qty: '3', in_stock_value: '3601.50' }]
    });

    expect(payload.variants[0].qty_in_stock).toBe(3);
    expect(payload.variants[0].current_wac).toBe(1200.5);
    expect(payload.stock_summary[0].in_stock_value).toBe(3601.5);
  });

  it('maps an orders page with nested line items', () => {
    const payload = mapOrdersPagePayload({
      total_count: 2,
      orders: [{
        id: 'order-1',
        customer_id: null,
        customer_name_snapshot: '',
        date: '2026-07-05',
        channel: 'fb',
        status: 'confirmed',
        delivery_type: 'shipping',
        discount: '100',
        shipping_fee: '80',
        shipping_cost: '40',
        items: [{
          id: 'item-1',
          stock_item_id: 'stock-1',
          variant_id: 'variant-1',
          sale_price: '1200',
          discount: '100',
          final_price: '1100',
          wac_at_sale: '700',
          profit: '400',
          brand_name_snapshot: 'Buddy',
          model_name_snapshot: 'Camp',
          variant_color_snapshot: 'Khaki'
        }]
      }],
      deliveries: [{ id: 'delivery-1', order_id: 'order-1', tracking: '', pickup_datetime: '', status: 'pending' }]
    });

    expect(payload.total_count).toBe(2);
    expect(payload.orders[0].customer_name_snapshot).toBe('ลูกค้าทั่วไป');
    expect(payload.orders[0].items[0].profit).toBe(400);
    expect(payload.deliveries[0].order_id).toBe('order-1');
  });

  it('maps purchase pages and appends unique rows by id', () => {
    const payload = mapPurchasePagePayload({
      total_count: 3,
      purchase_batches: [{
        id: 'batch-1',
        date: '2026-07-04',
        shipping_cost: '100',
        other_cost: '50',
        note: 'first',
        items: [{ variant_id: 'variant-1', qty: '2', unit_price: '700' }]
      }]
    });

    const merged = mergeUniqueById(
      [{ id: 'batch-1', date: 'old' }, { id: 'batch-2', date: 'keep' }],
      [{ id: 'batch-1', date: 'new' }]
    );

    expect(payload.purchase_batches[0].shipping_cost).toBe(100);
    expect(payload.purchase_batches[0].items[0].qty).toBe(2);
    expect(payload.total_count).toBe(3);
    expect(merged).toEqual([{ id: 'batch-1', date: 'new' }, { id: 'batch-2', date: 'keep' }]);
  });
});
