import { describe, expect, it } from 'vitest';
import { AppData } from '../types';
import { getSetupProgress, SetupStepId } from './setupProgress';

const emptyData = (): AppData => ({
  brands: [],
  models: [],
  variants: [],
  purchaseBatches: [],
  stockItems: [],
  stockSummary: [],
  customers: [],
  orders: [],
  deliveries: []
});

const currentStep = (data: AppData): SetupStepId | 'complete' =>
  getSetupProgress(data).currentStep?.id || 'complete';

describe('setup progress helper', () => {
  it('starts new accounts at brand creation', () => {
    expect(currentStep(emptyData())).toBe('brand');
  });

  it('moves from brand to model once a brand exists', () => {
    const data = emptyData();
    data.brands = [{ id: 'brand-1', name: 'Buddy', is_active: true }];

    expect(currentStep(data)).toBe('model');
  });

  it('moves from model to variant once a model exists', () => {
    const data = emptyData();
    data.brands = [{ id: 'brand-1', name: 'Buddy', is_active: true }];
    data.models = [{ id: 'model-1', brand_id: 'brand-1', name: 'Camp', is_active: true }];

    expect(currentStep(data)).toBe('variant');
  });

  it('moves from variant to purchase until stock is received', () => {
    const data = emptyData();
    data.brands = [{ id: 'brand-1', name: 'Buddy', is_active: true }];
    data.models = [{ id: 'model-1', brand_id: 'brand-1', name: 'Camp', is_active: true }];
    data.variants = [{
      id: 'variant-1',
      model_id: 'model-1',
      color: 'Khaki',
      qty_in_stock: 0,
      current_wac: 0,
      standard_sale_price: 2200,
      is_active: true
    }];

    expect(currentStep(data)).toBe('purchase');
  });

  it('treats sale as ready only after stock exists', () => {
    const data = emptyData();
    data.brands = [{ id: 'brand-1', name: 'Buddy', is_active: true }];
    data.models = [{ id: 'model-1', brand_id: 'brand-1', name: 'Camp', is_active: true }];
    data.variants = [{
      id: 'variant-1',
      model_id: 'model-1',
      color: 'Khaki',
      qty_in_stock: 3,
      current_wac: 1200,
      standard_sale_price: 2200,
      is_active: true
    }];
    data.stockSummary = [{ variant_id: 'variant-1', in_stock_qty: 3, in_stock_value: 3600 }];

    expect(currentStep(data)).toBe('sale');
    expect(getSetupProgress(data).activeStockQty).toBe(3);
  });

  it('is complete after a stocked product has an order', () => {
    const data = emptyData();
    data.brands = [{ id: 'brand-1', name: 'Buddy', is_active: true }];
    data.models = [{ id: 'model-1', brand_id: 'brand-1', name: 'Camp', is_active: true }];
    data.variants = [{
      id: 'variant-1',
      model_id: 'model-1',
      color: 'Khaki',
      qty_in_stock: 2,
      current_wac: 1200,
      standard_sale_price: 2200,
      is_active: true
    }];
    data.stockSummary = [{ variant_id: 'variant-1', in_stock_qty: 2, in_stock_value: 2400 }];
    data.orders = [{
      id: 'order-1',
      customer_id: null,
      customer_name_snapshot: 'ลูกค้าทั่วไป',
      date: '2026-07-09',
      channel: 'fb',
      status: 'confirmed',
      delivery_type: 'shipping',
      discount: 0,
      shipping_fee: 0,
      shipping_cost: 0,
      items: [{
        id: 'item-1',
        stock_item_id: 'stock-1',
        variant_id: 'variant-1',
        sale_price: 2200,
        discount: 0,
        final_price: 2200,
        wac_at_sale: 1200,
        profit: 1000,
        brand_name_snapshot: 'Buddy',
        model_name_snapshot: 'Camp',
        variant_color_snapshot: 'Khaki'
      }]
    }];

    const progress = getSetupProgress(data);

    expect(progress.isComplete).toBe(true);
    expect(progress.currentStep).toBeNull();
  });
});
