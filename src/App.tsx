/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useDatabase } from './hooks/useDatabase';
import { useSupabase } from './hooks/useSupabase';
import { DashboardView } from './components/DashboardView';
import { ProductsView } from './components/ProductsView';
import { PurchaseView } from './components/PurchaseView';
import { OrdersView } from './components/OrdersView';
import { DeliveriesView } from './components/DeliveriesView';
import { ReportsView } from './components/ReportsView';
import { LoginView } from './components/LoginView';
import { AnimatePresence, motion } from 'motion/react';
import logoImg from './assets/images/logo_1782269852938.jpg';
import { 
  BarChart2, 
  Package, 
  PlusSquare, 
  ShoppingBag, 
  Truck, 
  Users, 
  Settings, 
  HelpCircle,
  Menu,
  X,
  FileDown,
  FileUp,
  RotateCcw,
  Tent,
  Database,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  Copy,
  Check,
  LogOut,
  Key,
  Lock
} from 'lucide-react';

type TabType = 'dashboard' | 'products' | 'purchase' | 'orders' | 'deliveries' | 'reports' | 'backup';

export default function App() {
  const {
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
  } = useDatabase();

  const {
    url: supabaseUrl,
    setUrl: setSupabaseUrl,
    anonKey: supabaseAnonKey,
    setAnonKey: setSupabaseAnonKey,
    autoSync: supabaseAutoSync,
    setAutoSync: setSupabaseAutoSync,
    status: supabaseStatus,
    errorMsg: supabaseErrorMsg,
    lastSynced: supabaseLastSynced,
    isPushing: supabaseIsPushing,
    isPulling: supabaseIsPulling,
    isTableReady: supabaseIsTableReady,
    hasBootstrapped: supabaseHasBootstrapped,
    sessionUserId: supabaseSessionUserId,
    pushToSupabase,
    pullFromSupabase,
    client: supabaseClient
  } = useSupabase(db, setDb);

  // Listen to Supabase Auth state changes
  useEffect(() => {
    if (!supabaseClient) return;

    // Check existing session on load
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
        sessionStorage.setItem('campchair_is_authenticated', 'true');
      }
    });

    // Sub to changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsAuthenticated(true);
        sessionStorage.setItem('campchair_is_authenticated', 'true');
      } else {
        if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false);
          sessionStorage.removeItem('campchair_is_authenticated');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabaseClient]);

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- AUTHENTICATION STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('campchair_is_authenticated') === 'true';
  });
  const [configUser, setConfigUser] = useState(() => localStorage.getItem('campchair_login_user') || 'admin');
  const [configPass, setConfigPass] = useState(() => localStorage.getItem('campchair_login_pass') || 'buddycamping');
  const [isSavingCreds, setIsSavingCreds] = useState(false);

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!configUser.trim() || !configPass.trim()) {
      alert('กรุณากรอกข้อมูลชื่อผู้ใช้งานและรหัสผ่านให้ครบถ้วน');
      return;
    }
    localStorage.setItem('campchair_login_user', configUser.trim());
    localStorage.setItem('campchair_login_pass', configPass.trim());
    setIsSavingCreds(true);
    setTimeout(() => {
      setIsSavingCreds(false);
      alert('บันทึกชื่อผู้ใช้และรหัสผ่านเข้าสู่ระบบระบบใหม่สำเร็จ!');
    }, 500);
  };

  const handleLogout = async () => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบเพื่อความปลอดภัย?')) {
      if (supabaseClient) {
        try {
          await supabaseClient.auth.signOut();
        } catch (e) {
          console.error(e);
        }
      }
      sessionStorage.removeItem('campchair_is_authenticated');
      setIsAuthenticated(false);
      setMobileMenuOpen(false);
    }
  };

  // --- BACKUP PANEL STATE ---
  const [backupInput, setBackupInput] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);
  const sqlCode = `-- Buddy ERP real relational database schema for Vercel + Supabase
-- Run this in Supabase SQL Editor. It is safe to run again after edits.

create table if not exists brands (
  user_id uuid not null default auth.uid(),
  id text not null,
  name text not null
);

create table if not exists models (
  user_id uuid not null default auth.uid(),
  id text not null,
  brand_id text not null,
  name text not null,
  image text
);

create table if not exists variants (
  user_id uuid not null default auth.uid(),
  id text not null,
  model_id text not null,
  color text not null,
  qty_in_stock integer not null default 0,
  current_wac numeric not null default 0,
  standard_sale_price numeric not null default 0
);

create table if not exists customers (
  user_id uuid not null default auth.uid(),
  id text not null,
  name text not null,
  phone text not null default '',
  facebook text not null default '',
  note text not null default ''
);

create table if not exists purchase_batches (
  user_id uuid not null default auth.uid(),
  id text not null,
  date date not null,
  shipping_cost numeric not null default 0,
  other_cost numeric not null default 0,
  note text
);

create table if not exists purchase_batch_items (
  user_id uuid not null default auth.uid(),
  id text not null,
  batch_id text not null,
  line_index integer not null default 0,
  variant_id text not null,
  qty integer not null default 0,
  unit_price numeric not null default 0
);

create table if not exists orders (
  user_id uuid not null default auth.uid(),
  id text not null,
  customer_id text not null default 'general',
  date date not null,
  channel text not null default 'other',
  status text not null default 'pending',
  delivery_type text not null default 'shipping',
  discount numeric not null default 0,
  shipping_fee numeric not null default 0,
  shipping_cost numeric not null default 0
);

create table if not exists order_items (
  user_id uuid not null default auth.uid(),
  id text not null,
  order_id text not null,
  stock_item_id text not null,
  variant_id text not null,
  sale_price numeric not null default 0,
  discount numeric not null default 0,
  final_price numeric not null default 0,
  wac_at_sale numeric not null default 0,
  profit numeric not null default 0
);

create table if not exists deliveries (
  user_id uuid not null default auth.uid(),
  id text not null,
  order_id text not null,
  tracking text not null default '',
  pickup_datetime text not null default '',
  status text not null default 'pending'
);

create table if not exists stock_items (
  user_id uuid not null default auth.uid(),
  id text not null,
  variant_id text not null,
  wac_cost numeric not null default 0,
  status text not null default 'in_stock',
  order_id text,
  batch_id text not null
);

-- Add/repair columns on existing tables that were created manually.
alter table brands add column if not exists user_id uuid;
alter table brands add column if not exists id text;
alter table brands add column if not exists name text;

alter table models add column if not exists user_id uuid;
alter table models add column if not exists id text;
alter table models add column if not exists brand_id text;
alter table models add column if not exists name text;
alter table models add column if not exists image text;

alter table variants add column if not exists user_id uuid;
alter table variants add column if not exists id text;
alter table variants add column if not exists model_id text;
alter table variants add column if not exists color text;
alter table variants add column if not exists qty_in_stock integer default 0;
alter table variants add column if not exists current_wac numeric default 0;
alter table variants add column if not exists standard_sale_price numeric default 0;

alter table customers add column if not exists user_id uuid;
alter table customers add column if not exists id text;
alter table customers add column if not exists name text;
alter table customers add column if not exists phone text default '';
alter table customers add column if not exists facebook text default '';
alter table customers add column if not exists note text default '';

alter table purchase_batches add column if not exists user_id uuid;
alter table purchase_batches add column if not exists id text;
alter table purchase_batches add column if not exists date date;
alter table purchase_batches add column if not exists shipping_cost numeric default 0;
alter table purchase_batches add column if not exists other_cost numeric default 0;
alter table purchase_batches add column if not exists note text;

alter table purchase_batch_items add column if not exists user_id uuid;
alter table purchase_batch_items add column if not exists id text;
alter table purchase_batch_items add column if not exists batch_id text;
alter table purchase_batch_items add column if not exists line_index integer default 0;
alter table purchase_batch_items add column if not exists variant_id text;
alter table purchase_batch_items add column if not exists qty integer default 0;
alter table purchase_batch_items add column if not exists unit_price numeric default 0;

alter table orders add column if not exists user_id uuid;
alter table orders add column if not exists id text;
alter table orders add column if not exists customer_id text default 'general';
alter table orders add column if not exists date date;
alter table orders add column if not exists channel text default 'other';
alter table orders add column if not exists status text default 'pending';
alter table orders add column if not exists delivery_type text default 'shipping';
alter table orders add column if not exists discount numeric default 0;
alter table orders add column if not exists shipping_fee numeric default 0;
alter table orders add column if not exists shipping_cost numeric default 0;

alter table order_items add column if not exists user_id uuid;
alter table order_items add column if not exists id text;
alter table order_items add column if not exists order_id text;
alter table order_items add column if not exists stock_item_id text;
alter table order_items add column if not exists variant_id text;
alter table order_items add column if not exists sale_price numeric default 0;
alter table order_items add column if not exists discount numeric default 0;
alter table order_items add column if not exists final_price numeric default 0;
alter table order_items add column if not exists wac_at_sale numeric default 0;
alter table order_items add column if not exists profit numeric default 0;

alter table deliveries add column if not exists user_id uuid;
alter table deliveries add column if not exists id text;
alter table deliveries add column if not exists order_id text;
alter table deliveries add column if not exists tracking text default '';
alter table deliveries add column if not exists pickup_datetime text default '';
alter table deliveries add column if not exists status text default 'pending';

alter table stock_items add column if not exists user_id uuid;
alter table stock_items add column if not exists id text;
alter table stock_items add column if not exists variant_id text;
alter table stock_items add column if not exists wac_cost numeric default 0;
alter table stock_items add column if not exists status text default 'in_stock';
alter table stock_items add column if not exists order_id text;
alter table stock_items add column if not exists batch_id text;

do $$
declare
  table_name text;
  first_user uuid;
begin
  select id into first_user from auth.users order by created_at asc limit 1;

  foreach table_name in array array[
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
  ]
  loop
    execute format('alter table %I alter column user_id set default auth.uid()', table_name);

    if first_user is not null then
      execute format('update %I set user_id = $1 where user_id is null', table_name) using first_user;
    end if;

    execute format('alter table %I enable row level security', table_name);

    execute format('drop policy if exists select_own on %I', table_name);
    execute format('drop policy if exists insert_own on %I', table_name);
    execute format('drop policy if exists update_own on %I', table_name);
    execute format('drop policy if exists delete_own on %I', table_name);

    execute format('create policy select_own on %I for select to authenticated using (auth.uid() = user_id)', table_name);
    execute format('create policy insert_own on %I for insert to authenticated with check (auth.uid() = user_id)', table_name);
    execute format('create policy update_own on %I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name);
    execute format('create policy delete_own on %I for delete to authenticated using (auth.uid() = user_id)', table_name);
  end loop;
end $$;`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Export JSON file download
  const handleDownloadBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `campchair_erp_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    alert('ส่งออกไฟล์สํารองข้อมูล JSON เรียบร้อย!');
  };

  const handleImportBackup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupInput.trim()) return;
    const res = importBackup(backupInput);
    if (res.success) {
      alert('นำเข้าสำรองข้อมูลสำเร็จ คลังได้รับการกู้คืนเรียบร้อย!');
      setBackupInput('');
      setActiveTab('dashboard');
    } else {
      alert(`นำเข้าล้มเหลว: ${res.error}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    fileReader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const res = importBackup(text);
        if (res.success) {
          alert('นำเข้าไฟล์สำรองข้อมูล JSON สำเร็จ คลังพร้อมขายทันที!');
          setActiveTab('dashboard');
        } else {
          alert(`ไฟล์สำรองข้อมูลไม่ถูกต้อง: ${res.error}`);
        }
      }
    };
    fileReader.readAsText(file);
  };

  const handleResetToDefaults = () => {
    if (window.confirm('⚠️ คำเตือน! การล้างข้อมูลจะทำการล้างประวัติการทำออเดอร์และการรับสินค้าทั้งหมด ทั้งนี้ระบบจะป้อนข้อมูลตัวอย่างเปิดบู๊ธขึ้นมาใหม่เพื่อให้สำรวจได้ง่าย ยืนยันที่จะล้างข้อมูลหรือไม่?')) {
      resetDatabase();
      alert('คืนค่าเริ่มต้นฐานข้อมูลเรียนร้อย บู๊ธตัวอย่างโหลดเข้าระบบเรียบร้อยแล้ว!');
      setActiveTab('dashboard');
    }
  };

  const handleClearAllSystemData = () => {
    const password = window.prompt('⚠️ คำเตือนร้ายแรง! การดำเนินการนี้จะลบสินค้า ออเดอร์ ลูกค้า และข้อมูลสต็อกทั้งหมดออกจากระบบแบบถาวร\n\nกรุณากรอกรหัสผ่านความปลอดภัย (รหัสผ่านคือ: buddy99) เพื่อยืนยัน:');
    if (password === null) {
      return; // Cancelled
    }
    if (password.trim() === 'buddy99' || password.trim() === '9999' || password.trim() === 'buddy') {
      clearDatabase();
      alert('ระบบทำการลบข้อมูลทั้งหมดเรียบร้อยแล้ว ปัจจุบันฐานข้อมูลว่างเปล่าสมบูรณ์!');
      setActiveTab('dashboard');
    } else {
      alert('❌ รหัสผ่านไม่ถูกต้อง! ไม่สามารถลบข้อมูลระบบได้');
    }
  };

  // Tab configurations
  const menuItems = [
    { id: 'dashboard', label: 'แดชบอร์ด', icon: BarChart2 },
    { id: 'products', label: 'รายละเอียดสินค้า', icon: Package },
    { id: 'purchase', label: 'รับเข้าคลัง (WAC)', icon: PlusSquare },
    { id: 'orders', label: 'บิลสั่งเสนอขาย', icon: ShoppingBag },
    { id: 'deliveries', label: 'จัดส่ง / นัดรับ', icon: Truck },
    { id: 'reports', label: 'รายงานกำไรและงบ', icon: BarChart2 },
    { id: 'backup', label: 'ตั้งค่า / สำรองข้อมูล', icon: Settings },
  ] as const;

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView db={db} onNavigate={(tab) => setActiveTab(tab as TabType)} />;
      case 'products':
        return (
          <ProductsView
            db={db}
            addBrand={addBrand}
            updateBrand={updateBrand}
            deleteBrand={deleteBrand}
            addModel={addModel}
            updateModel={updateModel}
            deleteModel={deleteModel}
            addVariant={addVariant}
            updateVariant={updateVariant}
            deleteVariant={deleteVariant}
          />
        );
      case 'purchase':
        return <PurchaseView db={db} addPurchaseBatch={addPurchaseBatch} />;
      case 'orders':
        return (
          <OrdersView
            db={db}
            createOrder={createOrder}
            updateOrderStatus={updateOrderStatus}
            deleteOrder={deleteOrder}
          />
        );
      case 'deliveries':
        return <DeliveriesView db={db} updateDelivery={updateDelivery} />;
      case 'reports':
        return <ReportsView db={db} />;
      case 'backup':
        return (
          <div className="space-y-6" id="settings-view">
            <div className="py-2 border-b border-slate-100">
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">ตั้งค่าและสำรองระบบ (Backup)</h1>
              <p className="text-slate-500 text-sm">การจัดลำดับข้อมูลหลัก จัดการสำรองข้อมูลคลังเพื่อความมั่นคงและปลอดภัย</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Export Panel */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-1.5 border-b border-slate-50 pb-2">
                  <FileDown className="w-4.5 h-4.5 text-emerald-700" />
                  ส่งออกข้อมูลสํารอง (Export Database)
                </h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  ดาวน์โหลดฐานข้อมูลและข้อมูลหลักของร้านค้าปัจจุบัน (แบรนด์, ล็อตนำเข้า, รายลูกค้า, และออเดอร์ทั้งหมด) เก็บไว้เป็นไฟล์ .json มีฟังก์ชันย้ายระบบ ย้ายโน้ตบุ๊ก ปล่อยเครื่องได้ปลอดภัย
                </p>
                <div className="pt-2">
                  <button
                    onClick={handleDownloadBackup}
                    className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2.5 px-5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileDown className="w-4 h-4" /> ส่งออกเป็นไฟล์สํารอง JSON
                  </button>
                </div>
              </div>

              {/* Import Panel */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-1.5 border-b border-slate-50 pb-2">
                  <FileUp className="w-4.5 h-4.5 text-emerald-500" />
                  นำเข้ากู้คืนข้อมูล (Import Database)
                </h3>
                <p className="text-slate-500 text-xs">
                  เลือกไฟล์สำรองนามสกุล .json ของแผงควบคุมนี้ เพื่อดึงฐานข้อมูลกลับมาอย่างรวดเร็ว
                </p>
                
                {/* Upload Trigger button */}
                <div className="p-3.5 bg-slate-55 border border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-center">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="import-file-upload"
                  />
                  <label
                    htmlFor="import-file-upload"
                    className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-3.5 rounded-lg cursor-pointer transition-colors"
                  >
                    เลือกไฟล์สำรองของคลัง
                  </label>
                  <span className="text-[10px] text-slate-400 mt-1.5 block">เฉพาะไฟล์ .json เท่านั้น</span>
                </div>

                {/* Textarea Import Option */}
                <form onSubmit={handleImportBackup} className="space-y-3 pt-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase">หรือป้อน JSON สตริงข้อความกู้คืน</label>
                  <textarea
                    rows={2}
                    value={backupInput}
                    onChange={(e) => setBackupInput(e.target.value)}
                    placeholder="วางโค้ด JSON กู้คืนที่นี่..."
                    className="w-full text-[10px] p-2 bg-slate-50 font-mono border border-slate-200 rounded-lg outline-hidden focus:bg-white"
                  ></textarea>
                  <button
                    type="submit"
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    กู้คืนข้อมูลจากโค้ด
                  </button>
                </form>
              </div>

              {/* --- SUPABASE INTEGRATION PANEL --- */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 md:col-span-2" id="supabase-panel">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">การเชื่อมต่อและซิงค์ข้อมูล Supabase Cloud</h3>
                      <p className="text-slate-400 text-[10px] mt-0.5">เชื่อมโยงสต็อกและออเดอร์กับฐานข้อมูลออนไลน์ของร้านเพื่อความปลอดภัยและการซิงค์ข้ามเครื่อง</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Connection Status Badge */}
                    {supabaseStatus === 'disconnected' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        ไม่ได้เชื่อมต่อ
                      </span>
                    )}
                    {supabaseStatus === 'connecting' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-55 text-amber-600 border border-amber-200 bg-amber-50">
                        <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
                        กำลังเชื่อมต่อ...
                      </span>
                    )}
                    {supabaseStatus === 'connected' && supabaseIsTableReady && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        พร้อมเก็บข้อมูล
                      </span>
                    )}
                    {supabaseStatus === 'connected' && !supabaseIsTableReady && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        ต้องสร้างตาราง
                      </span>
                    )}
                    {supabaseStatus === 'error' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        เกิดข้อผิดพลาด
                      </span>
                    )}
                  </div>
                </div>

                {supabaseErrorMsg && (
                  <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-rose-700 text-xs">
                    ⚠️ {supabaseErrorMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  {/* Left Column: Form Settings */}
                  <div className="md:col-span-5 space-y-3.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Supabase URL</label>
                      <input
                        type="url"
                        placeholder="https://your-project-id.supabase.co"
                        value={supabaseUrl}
                        onChange={(e) => setSupabaseUrl(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:border-emerald-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Supabase Anon Key (API Key)</label>
                      <input
                        type="password"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        value={supabaseAnonKey}
                        onChange={(e) => setSupabaseAnonKey(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:border-emerald-700"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">ขอบเขตข้อมูล</label>
                        <div className="text-[10px] leading-relaxed p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
                          ใช้ตารางจริงแยกตามผู้ใช้ Supabase Auth
                          {supabaseSessionUserId && (
                            <span className="block mt-1 font-mono text-slate-400 truncate">{supabaseSessionUserId}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-2 text-xs text-slate-600 select-none pb-2.5 font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={supabaseAutoSync}
                            onChange={(e) => setSupabaseAutoSync(e.target.checked)}
                            className="h-4 w-4 accent-emerald-700 cursor-pointer"
                          />
                          <span>{supabaseAutoSync ? 'ซิงค์อัตโนมัติเปิดอยู่' : 'ซิงค์อัตโนมัติปิดอยู่'}</span>
                        </label>
                      </div>
                    </div>

                    {supabaseStatus === 'connected' && (
                      <div className={`text-[10px] rounded-xl border p-2.5 leading-relaxed ${
                        supabaseIsTableReady
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {supabaseIsTableReady
                          ? (supabaseHasBootstrapped
                              ? 'เชื่อมต่อพร้อมใช้งานแล้ว ข้อมูลจะถูกเก็บใน Supabase อัตโนมัติเมื่อมีการเปลี่ยนแปลง'
                              : 'ตารางพร้อมแล้ว ระบบกำลังเตรียมซิงค์ข้อมูลเริ่มต้นกับ Supabase')
                          : 'เชื่อมต่อโปรเจกต์ได้แล้ว แต่ยังไม่พบตารางเก็บข้อมูล กรุณารัน SQL ด้านขวาก่อน แล้วกดอัปโหลดขึ้นคลาวด์'}
                      </div>
                    )}

                    {supabaseStatus === 'connected' && (
                      <div className="pt-2 flex flex-wrap gap-2.5">
                        <button
                          onClick={async () => {
                            const res = await pushToSupabase();
                            if (res.success) {
                              alert('อัปโหลดข้อมูลสต็อกและออเดอร์ไปยัง Supabase เรียบร้อยแล้ว!');
                            } else {
                              alert(`อัปโหลดล้มเหลว: ${res.error}`);
                            }
                          }}
                          disabled={supabaseIsPushing || supabaseIsPulling}
                          className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <CloudUpload className="w-4 h-4" />
                          {supabaseIsPushing ? 'กำลังส่งข้อมูล...' : 'อัปโหลดขึ้นคลาวด์'}
                        </button>

                        <button
                          onClick={async () => {
                            if (window.confirm('⚠️ คำเตือน! การดาวน์โหลดข้อมูลจะเขียนทับคลังปัจจุบันในเครื่องทันที ต้องการดำเนินการต่อหรือไม่?')) {
                              const res = await pullFromSupabase();
                              if (res.success) {
                                alert('ดึงข้อมูลกู้คืนจาก Supabase สำเร็จ สต็อกเป็นข้อมูลล่าสุดเรียบร้อย!');
                              } else {
                                alert(`ดาวน์โหลดล้มเหลว: ${res.error}`);
                              }
                            }
                          }}
                          disabled={supabaseIsPushing || supabaseIsPulling}
                          className="flex-1 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <CloudDownload className="w-4 h-4" />
                          {supabaseIsPulling ? 'กำลังดึงข้อมูล...' : 'ดาวน์โหลดกู้คืน'}
                        </button>
                      </div>
                    )}

                    {supabaseLastSynced && (
                      <p className="text-[10px] text-slate-400 font-mono text-center">
                        ซิงค์ล่าสุดเวลา: {supabaseLastSynced}
                      </p>
                    )}
                  </div>

                  {/* Right Column: SQL setup instruction block */}
                  <div className="md:col-span-7 bg-slate-50 p-4 rounded-2xl border border-slate-200/60 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 text-xs uppercase tracking-tight">ขั้นตอนการสร้างตารางบน Supabase</h4>
                        <button
                          onClick={handleCopySql}
                          type="button"
                          className={`text-[10px] font-bold py-1 px-2.5 rounded-lg border flex items-center gap-1 cursor-pointer transition-all ${
                            copiedSql 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-white text-slate-600 hover:text-slate-800 border-slate-200'
                          }`}
                        >
                          {copiedSql ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> คัดลอกสำเร็จ!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> คัดลอก SQL
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        ใช้งานครั้งแรกให้นำ SQL นี้ไปรันใน <strong>SQL Editor</strong> ของ <strong>Supabase Dashboard</strong> ก่อน จากนั้นกลับมากด <strong>อัปโหลดขึ้นคลาวด์</strong> ระบบจะบันทึกข้อมูลลงตารางจริง เช่น brands, models, variants, orders และ stock_items:
                      </p>
                    </div>

                    <div className="relative">
                      <pre className="text-[9.5px] font-mono p-3 bg-slate-900 text-slate-300 rounded-xl overflow-x-auto select-all max-h-[140px] leading-relaxed">
                        {sqlCode}
                      </pre>
                    </div>

                    <div className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl">
                      <strong>สถานะการเก็บข้อมูล:</strong> แอปจะเก็บข้อมูลลงเครื่องก่อนเสมอ และจะ sync ไปยังตารางจริงบน Supabase เมื่อสถานะเป็น “พร้อมเก็บข้อมูล” หรือเมื่อกด “อัปโหลดขึ้นคลาวด์”
                    </div>
                  </div>
                </div>
              </div>

              {/* --- LOGIN CREDENTIALS SETTINGS --- */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 md:col-span-2" id="login-creds-panel">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <Key className="w-5 h-5 text-emerald-600" />
                    ตั้งค่าชื่อผู้ใช้งานและรหัสผ่านเข้าสู่ระบบ (ERP Password Settings)
                  </h3>
                  <p className="text-slate-400 text-[10px] mt-0.5">เปลี่ยนข้อมูลชื่อผู้ใช้และรหัสผ่านแอดมินสำหรับการล็อกอินเข้าใช้งานในเครื่องนี้</p>
                </div>

                <form onSubmit={handleSaveCredentials} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">ชื่อผู้ใช้งานใหม่ (New Username)</label>
                    <input
                      type="text"
                      required
                      value={configUser}
                      onChange={(e) => setConfigUser(e.target.value)}
                      placeholder="เช่น admin"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:border-emerald-700 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">รหัสผ่านใหม่ (New Password)</label>
                    <input
                      type="text"
                      required
                      value={configPass}
                      onChange={(e) => setConfigPass(e.target.value)}
                      placeholder="เช่น รหัสผ่านเข้าคลัง"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:border-emerald-700 font-medium"
                    />
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={isSavingCreds}
                      className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isSavingCreds ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white/80" />
                          กำลังบันทึก...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          อัปเดตข้อมูลล็อกอิน
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Advanced Administration Reset Panel */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4 md:col-span-2">
                <h3 className="font-bold text-rose-600 text-sm flex items-center gap-1.5 border-b border-rose-50 pb-2">
                  <RotateCcw className="w-4.5 h-4.5 text-rose-500" />
                  ลบทำความสะอาดข้อมูลระบบทั้งหมด (Clear Database)
                </h3>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-slate-500">
                  <p className="max-w-xl leading-relaxed">
                    ฟังก์ชันนี้จะทำการลบฐานข้อมูลการขาย ออเดอร์ แบรนด์ รุ่น คลังสินค้า ยอด WAC และรายการลูกค้าทั้งหมดออกจากระบบอย่างถาวรทันทีแบบไม่มีข้อมูลใดๆ หลงเหลืออยู่
                  </p>
                  <button
                    type="button"
                    onClick={handleClearAllSystemData}
                    className="bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200 font-bold py-2.5 px-5 rounded-xl text-xs transition-colors cursor-pointer whitespace-nowrap self-start sm:self-center animate-pulse"
                  >
                    ลบข้อมูลระบบทั้งหมดทันที
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (!isAuthenticated) {
    return (
      <LoginView 
        client={supabaseClient}
        status={supabaseStatus}
        errorMsg={supabaseErrorMsg}
        url={supabaseUrl}
        setUrl={setSupabaseUrl}
        anonKey={supabaseAnonKey}
        setAnonKey={setSupabaseAnonKey}
        onLoginSuccess={() => setIsAuthenticated(true)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans" id="app-viewport">
      
      {/* ⚠️ DESKTOP LEFT SIDEBAR */}
      <aside className="w-64 bg-white text-slate-700 flex-col shrink-0 hidden md:flex border-r border-slate-200" id="desktop-sidebar">
        
        {/* Sidebar Brand header and Launcher brand */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center shrink-0 bg-white">
              <img src={logoImg} alt="Buddy Camping Store Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="grow">
              <h2 className="font-bold text-slate-900 text-sm tracking-tight leading-none uppercase">Buddy Camping</h2>
              <span className="text-[9px] text-emerald-700 font-extrabold tracking-widest block mt-1.5 uppercase">Store. ERP</span>
            </div>
          </div>
          
          {/* Supabase Status Pill */}
          <div className="mt-3.5">
            {supabaseStatus === 'connected' && supabaseIsTableReady ? (
              <button
                onClick={() => setActiveTab('backup')}
                className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all text-left cursor-pointer"
                title="พร้อมเก็บข้อมูลบน Supabase แล้ว คลิกเพื่อดูข้อมูลสำรอง"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="truncate">Supabase ซิงค์ออนไลน์</span>
                </span>
                <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              </button>
            ) : supabaseStatus === 'connected' && !supabaseIsTableReady ? (
              <button
                onClick={() => setActiveTab('backup')}
                className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-all text-left cursor-pointer"
                title="เชื่อมต่อ Supabase ได้แล้ว แต่ต้องสร้างตารางก่อนเก็บข้อมูล"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">Supabase รอตาราง</span>
                </span>
                <Database className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              </button>
            ) : supabaseStatus === 'connecting' ? (
              <button
                onClick={() => setActiveTab('backup')}
                className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-all text-left cursor-pointer"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-500 shrink-0" />
                  <span className="truncate">กำลังเชื่อมต่อ...</span>
                </span>
              </button>
            ) : supabaseStatus === 'error' ? (
              <button
                onClick={() => setActiveTab('backup')}
                className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-all text-left cursor-pointer"
                title="เชื่อมต่อล้มเหลว คลิกเพื่อแก้ไขค่าเชื่อมต่อ"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="truncate">การเชื่อมต่อขัดข้อง</span>
                </span>
                <Database className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('backup')}
                className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200 transition-all text-left cursor-pointer"
                title="ยังไม่ได้กำหนดค่าเชื่อมต่อ คลิกเพื่อตั้งค่าซิงค์คลาวด์"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                  <span className="truncate">ไม่พบการซิงค์ออนไลน์</span>
                </span>
                <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
            )}
          </div>
        </div>

        {/* Sidebar Menu elements */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto text-xs" id="desktop-navigation">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full py-2.5 px-3.5 rounded-xl font-semibold flex items-center gap-3 transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-slate-100 text-emerald-700 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Operator Badge info at base of Sidebar */}
        <div className="p-4 border-t border-slate-100 text-[11px] text-slate-500 space-y-2">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center bg-white shrink-0">
                <img src={logoImg} alt="BC" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 truncate">Buddy Camping</p>
                <p className="text-[9px] text-slate-400">ระบบคลังและออเดอร์</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer p-1"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </aside>

      {/* ⚠️ MOBILE HEADER BAR */}
      <header className="bg-white text-slate-800 py-3 px-4 flex justify-between items-center md:hidden border-b border-slate-200 z-30" id="mobile-header">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-150 flex items-center justify-center bg-white shrink-0">
            <img src={logoImg} alt="Buddy Camping Store Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <span className="font-extrabold text-sm uppercase tracking-tight text-slate-950 truncate">Buddy Camping ERP</span>
        </div>
        
        {/* Connection status and Hamburger */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Mobile Supabase Connection Indicator */}
          <button
            onClick={() => setActiveTab('backup')}
            className="flex items-center justify-center cursor-pointer transition-transform active:scale-95"
            title="ตั้งค่า/ดูสถานะซิงค์ข้อมูล Supabase"
          >
            {supabaseStatus === 'connected' && supabaseIsTableReady ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                ซิงค์แล้ว
              </span>
            ) : supabaseStatus === 'connected' && !supabaseIsTableReady ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-1 h-1 rounded-full bg-amber-500" />
                รอตาราง
              </span>
            ) : supabaseStatus === 'connecting' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-500" />
                ซิงค์...
              </span>
            ) : supabaseStatus === 'error' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                <span className="w-1 h-1 rounded-full bg-rose-500" />
                ขัดข้อง
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
                <span className="w-1 h-1 rounded-full bg-slate-400" />
                ออฟไลน์
              </span>
            )}
          </button>

          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 text-slate-500 hover:text-slate-900"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* ⚠️ MOBILE SLIDEOUT DRAWER MENU */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-14 right-0 bg-white z-20 border-b border-slate-200 p-4 shadow-lg md:hidden text-xs space-y-1 block"
            id="mobile-drawer-menu"
          >
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold flex items-center gap-3 transition-colors text-left cursor-pointer ${
                    isActive 
                      ? 'bg-slate-100 text-emerald-700' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            
            <div className="border-t border-slate-100 my-2 pt-2">
              <button
                onClick={handleLogout}
                className="w-full py-2.5 px-4 rounded-xl font-bold flex items-center gap-3 text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ⚠️ MAIN VIEWPORT CONTENT SCREEN */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto pb-20 md:pb-8" id="main-content-display">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.12 }}
            className="max-w-6xl mx-auto"
          >
            {renderActiveView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ⚠️ MOBILE BOTTOM NAVIGATION BAR (UX PRIORITY) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 md:hidden flex justify-around items-center py-2.5 px-2 z-35 shadow-lg" id="mobile-bottom-nav">
        {menuItems.slice(0, 5).map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                isActive ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              <span className="text-[9px] font-medium leading-none">{item.label}</span>
            </button>
          );
        })}
        {/* Plus quick backoffice anchor toggle or report */}
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            activeTab === 'reports' ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <BarChart2 className="w-4.5 h-4.5 shrink-0" />
          <span className="text-[9px] font-medium leading-none">รายงาน</span>
        </button>
      </nav>

    </div>
  );
}
