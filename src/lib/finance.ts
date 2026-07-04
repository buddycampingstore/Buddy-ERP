import { Order, PurchaseBatch, StockItem, StockSummary } from '../types';

export const getOrderSubtotal = (order: Order) => {
  return order.items.reduce((sum, item) => sum + Number(item.final_price || 0), 0);
};

export const getOrderRevenue = (order: Order) => {
  return getOrderSubtotal(order) + Number(order.shipping_fee || 0) - Number(order.discount || 0);
};

export const getOrderCogs = (order: Order) => {
  return order.items.reduce((sum, item) => sum + Number(item.wac_at_sale || 0), 0);
};

export const getOrderProfit = (order: Order) => {
  const itemProfit = order.items.reduce((sum, item) => sum + Number(item.profit || 0), 0);
  return itemProfit + Number(order.shipping_fee || 0) - Number(order.shipping_cost || 0) - Number(order.discount || 0);
};

export const getTotalRevenue = (orders: Order[]) => {
  return orders.reduce((sum, order) => sum + getOrderRevenue(order), 0);
};

export const getTotalCogs = (orders: Order[]) => {
  return orders.reduce((sum, order) => sum + getOrderCogs(order), 0);
};

export const getGrossProfit = (orders: Order[]) => {
  return getTotalRevenue(orders) - getTotalCogs(orders);
};

export const getNetProfit = (orders: Order[]) => {
  return orders.reduce((sum, order) => sum + getOrderProfit(order), 0);
};

export const getPurchaseBatchTotalCost = (batch: PurchaseBatch) => {
  const itemCost = batch.items.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
  return itemCost + batch.shipping_cost + batch.other_cost;
};

export const getTotalPurchaseCost = (batches: PurchaseBatch[]) => {
  return batches.reduce((sum, batch) => sum + getPurchaseBatchTotalCost(batch), 0);
};

export const getActiveStockValue = (stockItems: StockItem[]) => {
  return stockItems
    .filter((item) => item.status === 'in_stock')
    .reduce((sum, item) => sum + Number(item.wac_cost || 0), 0);
};

export const getStockSummaryQty = (stockSummary: StockSummary[]) => {
  return stockSummary.reduce((sum, item) => sum + Number(item.in_stock_qty || 0), 0);
};

export const getStockSummaryValue = (stockSummary: StockSummary[]) => {
  return stockSummary.reduce((sum, item) => sum + Number(item.in_stock_value || 0), 0);
};

export const getVariantStockQty = (stockSummary: StockSummary[], variantId: string) => {
  return stockSummary.find((item) => item.variant_id === variantId)?.in_stock_qty || 0;
};

export const getLocalYearMonth = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
};

export const filterOrdersByYearMonth = (orders: Order[], yearMonth: string) => {
  return orders.filter((order) => order.date.startsWith(yearMonth));
};

export const filterPurchaseBatchesByYearMonth = (batches: PurchaseBatch[], yearMonth: string) => {
  return batches.filter((batch) => batch.date.startsWith(yearMonth));
};
