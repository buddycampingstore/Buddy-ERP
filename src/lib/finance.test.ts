import { describe, expect, it } from 'vitest';
import { Order, PurchaseBatch } from '../types';
import {
  getNetProfit,
  getOrderProfit,
  getOrderRevenue,
  getPurchaseBatchTotalCost,
  getTotalPurchaseCost
} from './finance';

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-1',
  customer_id: null,
  customer_name_snapshot: 'ลูกค้าทั่วไป',
  date: '2026-07-03',
  channel: 'fb',
  status: 'confirmed',
  delivery_type: 'shipping',
  discount: 100,
  shipping_fee: 80,
  shipping_cost: 40,
  items: [
    {
      id: 'item-1',
      stock_item_id: 'stock-1',
      variant_id: 'variant-1',
      sale_price: 1200,
      discount: 100,
      final_price: 1100,
      wac_at_sale: 700,
      profit: 400,
      brand_name_snapshot: 'Brand',
      model_name_snapshot: 'Model',
      variant_color_snapshot: 'Khaki'
    }
  ],
  ...overrides
});

const makeBatch = (overrides: Partial<PurchaseBatch> = {}): PurchaseBatch => ({
  id: 'batch-1',
  date: '2026-07-01',
  shipping_cost: 120,
  other_cost: 80,
  note: '',
  items: [
    {
      variant_id: 'variant-1',
      qty: 2,
      unit_price: 700
    }
  ],
  ...overrides
});

describe('finance helpers', () => {
  it('calculates order revenue with shipping fee and order discount', () => {
    expect(getOrderRevenue(makeOrder())).toBe(1080);
  });

  it('calculates order profit with shipping cost and order discount', () => {
    expect(getOrderProfit(makeOrder())).toBe(340);
  });

  it('keeps purchase overhead inside WAC and does not subtract it again from net profit', () => {
    const order = makeOrder();
    const batch = makeBatch();

    expect(getPurchaseBatchTotalCost(batch)).toBe(1600);
    expect(getTotalPurchaseCost([batch])).toBe(1600);
    expect(getNetProfit([order])).toBe(340);
  });
});
