/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppDatabase } from './types';

export const INITIAL_DATABASE: AppDatabase = {
  brands: [
    { id: 'b-1', name: 'Naturehike' },
    { id: 'b-2', name: 'Coleman' },
    { id: 'b-3', name: 'DOD' },
    { id: 'b-4', name: 'Kermit Chair' }
  ],
  models: [
    { id: 'm-1', brand_id: 'b-1', name: 'Folding Wooden Kermit' },
    { id: 'm-2', brand_id: 'b-1', name: 'Ultralight Moon Chair' },
    { id: 'm-3', brand_id: 'b-2', name: 'Compact Folding Chair' },
    { id: 'm-4', brand_id: 'b-3', name: 'Sugoi Chair (ปรับระดับ)' },
    { id: 'm-5', brand_id: 'b-4', name: 'Classic Oak Kermit' }
  ],
  variants: [
    { id: 'v-1', model_id: 'm-1', color: 'ครีม (Khaki)', qty_in_stock: 13, current_wac: 1531.43 },
    { id: 'v-2', model_id: 'm-1', color: 'ดำ (Black)', qty_in_stock: 8, current_wac: 1557.14 },
    { id: 'v-3', model_id: 'm-2', color: 'เขียวมะกอก (Olive)', qty_in_stock: 14, current_wac: 857.14 },
    { id: 'v-4', model_id: 'm-3', color: 'แดง (Red)', qty_in_stock: 8, current_wac: 1280.00 },
    { id: 'v-5', model_id: 'm-4', color: 'แทน (Tan)', qty_in_stock: 5, current_wac: 2450.00 }
  ],
  purchaseBatches: [
    {
      id: 'pb-1',
      date: '2026-06-01',
      shipping_cost: 1500,
      other_cost: 500,
      note: 'ล็อตเปิดร้าน สั่งจากโรงงานตรง',
      items: [
        { variant_id: 'v-1', qty: 10, unit_price: 1500 }, // cost_ใหม่ = 1500 + (2000/35) = 1557.14
        { variant_id: 'v-2', qty: 10, unit_price: 1500 }, // cost_ใหม่ = 1500 + 57.14 = 1557.14
        { variant_id: 'v-3', qty: 15, unit_price: 800 }   // cost_ใหม่ = 800 + 57.14 = 857.14
      ]
    },
    {
      id: 'pb-2',
      date: '2026-06-15',
      shipping_cost: 1000,
      other_cost: 200,
      note: 'เติมของเพิ่ม และเพิ่มรุ่นสลิมแดงกับสึโกอิแทน',
      items: [
        { variant_id: 'v-1', qty: 5, unit_price: 1400 },  // cost_ใหม่ = 1400 + (1200/23) = 1452.17 -> WAC_ใหม่ = (10*1557.14 + 5*1452.17)/15 = 1522.15 (let's use pre-calculated estimates)
        { variant_id: 'v-4', qty: 10, unit_price: 1200 }, // cost_ใหม่ = 1200 + 52.17 = 1252.17
        { variant_id: 'v-5', qty: 8, unit_price: 2400 }   // cost_ใหม่ = 2400 + 52.17 = 2452.17
      ]
    }
  ],
  stockItems: [
    // Batch 1 StockItems (Remaining in stock after some orders)
    { id: 'st-01_1', variant_id: 'v-1', wac_cost: 1557.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-01_2', variant_id: 'v-1', wac_cost: 1557.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-01_3', variant_id: 'v-1', wac_cost: 1557.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-01_4', variant_id: 'v-1', wac_cost: 1557.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-01_5', variant_id: 'v-1', wac_cost: 1557.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-01_6', variant_id: 'v-1', wac_cost: 1557.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-01_7', variant_id: 'v-1', wac_cost: 1557.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-01_8', variant_id: 'v-1', wac_cost: 1557.14, status: 'in_stock', batch_id: 'pb-1' },
    // Sold
    { id: 'st-01_9', variant_id: 'v-1', wac_cost: 1557.14, status: 'sold', order_id: 'ord-1', batch_id: 'pb-1' },
    { id: 'st-01_10', variant_id: 'v-1', wac_cost: 1557.14, status: 'sold', order_id: 'ord-1', batch_id: 'pb-1' },

    // V2 (Naturehike Kermit ดำ)
    { id: 'st-02_1', variant_id: 'v-2', wac_cost: 1557.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-02_2', variant_id: 'v-2', wac_cost: 1557.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-02_3', variant_id: 'v-2', wac_cost: 1557.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-02_4', variant_id: 'v-2', wac_cost: 1557.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-02_5', variant_id: 'v-2', wac_cost: 1557.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-02_6', variant_id: 'v-2', wac_cost: 1557.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-02_7', variant_id: 'v-2', wac_cost: 1557.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-02_8', variant_id: 'v-2', wac_cost: 1557.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-02_9', variant_id: 'v-2', wac_cost: 1557.14, status: 'sold', order_id: 'ord-2', batch_id: 'pb-1' },
    { id: 'st-02_10', variant_id: 'v-2', wac_cost: 1557.14, status: 'sold', order_id: 'ord-3', batch_id: 'pb-1' },

    // V3 (Ultralight Green)
    { id: 'st-03_1', variant_id: 'v-3', wac_cost: 857.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-03_2', variant_id: 'v-3', wac_cost: 857.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-03_3', variant_id: 'v-3', wac_cost: 857.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-03_4', variant_id: 'v-3', wac_cost: 857.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-03_5', variant_id: 'v-3', wac_cost: 857.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-03_6', variant_id: 'v-3', wac_cost: 857.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-03_7', variant_id: 'v-3', wac_cost: 857.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-03_8', variant_id: 'v-3', wac_cost: 857.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-03_9', variant_id: 'v-3', wac_cost: 857.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-03_10', variant_id: 'v-3', wac_cost: 857.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-03_11', variant_id: 'v-3', wac_cost: 857.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-03_12', variant_id: 'v-3', wac_cost: 857.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-03_13', variant_id: 'v-3', wac_cost: 857.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-03_14', variant_id: 'v-3', wac_cost: 857.14, status: 'in_stock', batch_id: 'pb-1' },
    { id: 'st-03_15', variant_id: 'v-3', wac_cost: 857.14, status: 'sold', order_id: 'ord-2', batch_id: 'pb-1' },

    // Batch 2 StockItems
    // V1 (added 5, cost base 1452.17)
    { id: 'st-01_11', variant_id: 'v-1', wac_cost: 1531.43, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-01_12', variant_id: 'v-1', wac_cost: 1531.43, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-01_13', variant_id: 'v-1', wac_cost: 1531.43, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-01_14', variant_id: 'v-1', wac_cost: 1531.43, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-01_15', variant_id: 'v-1', wac_cost: 1531.43, status: 'in_stock', batch_id: 'pb-2' },

    // V4 (added 10)
    { id: 'st-04_1', variant_id: 'v-4', wac_cost: 1280.00, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-04_2', variant_id: 'v-4', wac_cost: 1280.00, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-04_3', variant_id: 'v-4', wac_cost: 1280.00, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-04_4', variant_id: 'v-4', wac_cost: 1280.00, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-04_5', variant_id: 'v-4', wac_cost: 1280.00, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-04_6', variant_id: 'v-4', wac_cost: 1280.00, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-04_7', variant_id: 'v-4', wac_cost: 1280.00, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-04_8', variant_id: 'v-4', wac_cost: 1280.00, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-04_9', variant_id: 'v-4', wac_cost: 1280.00, status: 'sold', order_id: 'ord-3', batch_id: 'pb-2' },
    { id: 'st-04_10', variant_id: 'v-4', wac_cost: 1280.00, status: 'sold', order_id: 'ord-4', batch_id: 'pb-2' },

    // V5 (added 8)
    { id: 'st-05_1', variant_id: 'v-5', wac_cost: 2450.00, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-05_2', variant_id: 'v-5', wac_cost: 2450.00, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-05_3', variant_id: 'v-5', wac_cost: 2450.00, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-05_4', variant_id: 'v-5', wac_cost: 2450.00, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-05_5', variant_id: 'v-5', wac_cost: 2450.00, status: 'in_stock', batch_id: 'pb-2' },
    { id: 'st-05_6', variant_id: 'v-5', wac_cost: 2450.00, status: 'sold', order_id: 'ord-4', batch_id: 'pb-2' },
    { id: 'st-05_7', variant_id: 'v-5', wac_cost: 2450.00, status: 'sold', order_id: 'ord-4', batch_id: 'pb-2' },
    { id: 'st-05_8', variant_id: 'v-5', wac_cost: 2450.00, status: 'sold', order_id: 'ord-4', batch_id: 'pb-2' }
  ],
  customers: [
    { id: 'c-1', name: 'คุณสมศักดิ์ สายแคมป์', phone: '0812345678', facebook: 'Somsak CampLife', note: 'ลูกค้า VIP ชอบกางเต็นท์ป่าสน' },
    { id: 'c-2', name: 'คุณวิภา วงศ์ป่า', phone: '0898765432', facebook: 'Wipa Nature', note: 'จ่ายเงินเร็วมาก พูดจาดี สั่งซื้อบ่อย' },
    { id: 'c-3', name: 'คุณปรีชา แคลงใจ', phone: '0823456789', facebook: 'Preecha Campers', note: 'มักขอของแถมเล็กๆ น้อยๆ' },
    { id: 'c-4', name: 'คุณนลินี ใจรักป่า', phone: '0854321098', facebook: 'Nalinee Forest', note: 'นัดรับที่ร้านเป็นประจำ' }
  ],
  orders: [
    {
      id: 'ord-1',
      customer_id: 'c-1',
      date: '2026-06-05',
      channel: 'fb',
      status: 'delivered',
      delivery_type: 'shipping',
      discount: 200,
      items: [
        {
          id: 'oi-1',
          stock_item_id: 'st-01_9',
          variant_id: 'v-1',
          sale_price: 2200,
          discount: 0,
          final_price: 2200,
          wac_at_sale: 1557.14,
          profit: 642.86
        },
        {
          id: 'oi-2',
          stock_item_id: 'st-01_10',
          variant_id: 'v-1',
          sale_price: 2200,
          discount: 0,
          final_price: 2200,
          wac_at_sale: 1557.14,
          profit: 642.86
        }
      ]
    },
    {
      id: 'ord-2',
      customer_id: 'c-2',
      date: '2026-06-10',
      channel: 'ig',
      status: 'shipped',
      delivery_type: 'shipping',
      discount: 0,
      items: [
        {
          id: 'oi-3',
          stock_item_id: 'st-02_9',
          variant_id: 'v-2',
          sale_price: 2400,
          discount: 100,
          final_price: 2300,
          wac_at_sale: 1557.14,
          profit: 742.86
        },
        {
          id: 'oi-4',
          stock_item_id: 'st-03_15',
          variant_id: 'v-3',
          sale_price: 1300,
          discount: 50,
          final_price: 1250,
          wac_at_sale: 857.14,
          profit: 392.86
        }
      ]
    },
    {
      id: 'ord-3',
      customer_id: 'c-3',
      date: '2026-06-18',
      channel: 'other',
      status: 'confirmed',
      delivery_type: 'shipping',
      discount: 0,
      items: [
        {
          id: 'oi-5',
          stock_item_id: 'st-02_10',
          variant_id: 'v-2',
          sale_price: 2300,
          discount: 0,
          final_price: 2300,
          wac_at_sale: 1557.14,
          profit: 742.86
        },
        {
          id: 'oi-6',
          stock_item_id: 'st-04_9',
          variant_id: 'v-4',
          sale_price: 1800,
          discount: 0,
          final_price: 1800,
          wac_at_sale: 1280.00,
          profit: 520.00
        }
      ]
    },
    {
      id: 'ord-4',
      customer_id: 'c-4',
      date: '2026-06-20',
      channel: 'fb',
      status: 'pending',
      delivery_type: 'pickup',
      discount: 150,
      items: [
        {
          id: 'oi-7',
          stock_item_id: 'st-04_10',
          variant_id: 'v-4',
          sale_price: 1800,
          discount: 0,
          final_price: 1800,
          wac_at_sale: 1280.00,
          profit: 520.00
        },
        {
          id: 'oi-8',
          stock_item_id: 'st-05_6',
          variant_id: 'v-5',
          sale_price: 3200,
          discount: 0,
          final_price: 3200,
          wac_at_sale: 2450.00,
          profit: 750.00
        },
        {
          id: 'oi-9',
          stock_item_id: 'st-05_7',
          variant_id: 'v-5',
          sale_price: 3200,
          discount: 0,
          final_price: 3200,
          wac_at_sale: 2450.00,
          profit: 750.00
        },
        {
          id: 'oi-10',
          stock_item_id: 'st-05_8',
          variant_id: 'v-5',
          sale_price: 3200,
          discount: 100,
          final_price: 3100,
          wac_at_sale: 2450.00,
          profit: 650.00
        }
      ]
    }
  ],
  deliveries: [
    { id: 'del-1', order_id: 'ord-1', tracking: 'TH-EXPRESS-102948', pickup_datetime: '', status: 'delivered' },
    { id: 'del-2', order_id: 'ord-2', tracking: 'KER-DOMESTIC-592839', pickup_datetime: '', status: 'dispatched' },
    { id: 'del-3', order_id: 'ord-3', tracking: '', pickup_datetime: '', status: 'pending' },
    { id: 'del-4', order_id: 'ord-4', tracking: '', pickup_datetime: '2026-06-25T14:30', status: 'pending' }
  ]
};
