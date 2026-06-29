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
  Settings, 
  Menu,
  X,
  FileDown,
  FileUp,
  RotateCcw,
  Database,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  Copy,
  Check,
  LogOut
} from 'lucide-react';

type TabType = 'dashboard' | 'products' | 'purchase' | 'orders' | 'deliveries' | 'reports' | 'backup';
const AUTH_SESSION_KEY = 'buddy_erp_is_authenticated';
const AUTH_SCOPE_KEY = 'buddy_erp_auth_scope';

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
    anonKey: supabaseAnonKey,
    tableName: supabaseTableName,
    rowId: supabaseRowId,
    autoSync: supabaseAutoSync,
    setAutoSync: setSupabaseAutoSync,
    status: supabaseStatus,
    errorMsg: supabaseErrorMsg,
    lastSynced: supabaseLastSynced,
    isPushing: supabaseIsPushing,
    isPulling: supabaseIsPulling,
    pushToSupabase,
    pullFromSupabase,
    client: supabaseClient
  } = useSupabase(db, setDb);
  const authScope = `${supabaseUrl}|${supabaseTableName}`;

  // Listen to Supabase Auth state changes
  useEffect(() => {
    if (!supabaseClient) return;

    // Check existing session on load
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
        sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
        sessionStorage.setItem(AUTH_SCOPE_KEY, authScope);
      }
    });

    // Sub to changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsAuthenticated(true);
        sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
        sessionStorage.setItem(AUTH_SCOPE_KEY, authScope);
      } else {
        if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false);
          sessionStorage.removeItem(AUTH_SESSION_KEY);
          sessionStorage.removeItem(AUTH_SCOPE_KEY);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabaseClient, authScope]);

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- AUTHENTICATION STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem(AUTH_SESSION_KEY) === 'true' && sessionStorage.getItem(AUTH_SCOPE_KEY) === authScope;
  });

  useEffect(() => {
    if (sessionStorage.getItem(AUTH_SCOPE_KEY) !== authScope) {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      sessionStorage.removeItem(AUTH_SCOPE_KEY);
      setIsAuthenticated(false);
    }
  }, [authScope]);

  const markAuthenticated = () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
    sessionStorage.setItem(AUTH_SCOPE_KEY, authScope);
    setIsAuthenticated(true);
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
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      sessionStorage.removeItem(AUTH_SCOPE_KEY);
      setIsAuthenticated(false);
      setMobileMenuOpen(false);
    }
  };

  // --- BACKUP PANEL STATE ---
  const [backupInput, setBackupInput] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);
  const safeSupabaseTableName = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(supabaseTableName) ? supabaseTableName : 'buddy_erp_backoffice';
  const sqlCode = `create table if not exists public.${safeSupabaseTableName} (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists ${safeSupabaseTableName}_updated_at_idx
  on public.${safeSupabaseTableName} (updated_at desc);

create index if not exists ${safeSupabaseTableName}_data_gin_idx
  on public.${safeSupabaseTableName} using gin (data);

alter table public.${safeSupabaseTableName} enable row level security;

drop policy if exists "${safeSupabaseTableName}_authenticated_read" on public.${safeSupabaseTableName};
create policy "${safeSupabaseTableName}_authenticated_read"
  on public.${safeSupabaseTableName}
  for select
  to authenticated
  using (true);

drop policy if exists "${safeSupabaseTableName}_authenticated_write" on public.${safeSupabaseTableName};
create policy "${safeSupabaseTableName}_authenticated_write"
  on public.${safeSupabaseTableName}
  for all
  to authenticated
  using (true)
  with check (true);`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handlePushSupabase = async () => {
    const res = await pushToSupabase(db);
    if (res.success) {
      alert('อัปโหลดข้อมูลขึ้น Supabase สำเร็จ');
    } else {
      alert(`อัปโหลดไม่สำเร็จ: ${res.error}`);
    }
  };

  const handlePullSupabase = async () => {
    if (!window.confirm('ต้องการดึงข้อมูลจาก Supabase มาแทนข้อมูลในเครื่องนี้หรือไม่?')) {
      return;
    }
    const res = await pullFromSupabase();
    if (res.success) {
      alert('ดึงข้อมูลจาก Supabase สำเร็จ');
      setActiveTab('dashboard');
    } else {
      alert(`ดึงข้อมูลไม่สำเร็จ: ${res.error}`);
    }
  };

  // Export JSON file download
  const handleDownloadBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `buddy_erp_backup_${new Date().toISOString().split('T')[0]}.json`);
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
    if (window.confirm('⚠️ คำเตือน! การดำเนินการนี้จะล้างข้อมูลในเครื่องนี้ทั้งหมด และตั้งฐานข้อมูลกลับเป็นฐานว่าง ยืนยันที่จะล้างข้อมูลหรือไม่?')) {
      resetDatabase();
      alert('ล้างข้อมูลในเครื่องเรียบร้อยแล้ว ฐานข้อมูลปัจจุบันว่างเปล่า');
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

              {/* Supabase Sync Panel */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 md:col-span-2">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 border-b border-slate-50 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-1.5">
                      <Database className="w-4.5 h-4.5 text-emerald-700" />
                      เชื่อมต่อ Supabase Cloud Sync
                    </h3>
                    <p className="text-slate-500 text-xs mt-1">
                      ใช้ตาราง {safeSupabaseTableName} เพื่อสำรองและซิงค์ข้อมูลร้านระหว่างอุปกรณ์
                    </p>
                  </div>
                  <div className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border self-start ${
                    supabaseStatus === 'connected'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : supabaseStatus === 'connecting'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : supabaseStatus === 'error'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}>
                    {supabaseStatus === 'connected'
                      ? 'เชื่อมต่อแล้ว'
                      : supabaseStatus === 'connecting'
                        ? 'กำลังเชื่อมต่อ'
                        : supabaseStatus === 'error'
                          ? 'เชื่อมต่อขัดข้อง'
                          : 'ยังไม่เชื่อมต่อ'}
                  </div>
                </div>

                {supabaseErrorMsg && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    {supabaseErrorMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Supabase Project</p>
                    <p className="text-xs text-slate-700 font-mono truncate mt-1" title={supabaseUrl || 'ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL'}>
                      {supabaseUrl || 'ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Anon Key</p>
                    <p className={`text-xs font-semibold mt-1 ${supabaseAnonKey ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {supabaseAnonKey ? 'โหลดจาก .env.local แล้ว' : 'ยังไม่ได้ตั้งค่า VITE_SUPABASE_ANON_KEY'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Supabase Table</p>
                    <p className="text-xs text-slate-700 font-mono truncate mt-1">{supabaseTableName}</p>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Sync Row ID</p>
                    <p className="text-xs text-slate-700 font-mono truncate mt-1">{supabaseRowId}</p>
                  </div>

                  <div className="md:col-span-2 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer pb-2.5">
                      <input
                        type="checkbox"
                        checked={supabaseAutoSync}
                        onChange={(e) => setSupabaseAutoSync(e.target.checked)}
                        className="w-4 h-4 accent-emerald-700"
                      />
                      Auto sync เมื่อข้อมูลเปลี่ยน
                    </label>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-3 justify-between border-t border-slate-100 pt-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={handlePushSupabase}
                      disabled={supabaseStatus !== 'connected' || supabaseIsPushing}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {supabaseIsPushing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                      อัปโหลดข้อมูลขึ้น Supabase
                    </button>
                    <button
                      type="button"
                      onClick={handlePullSupabase}
                      disabled={supabaseStatus !== 'connected' || supabaseIsPulling}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {supabaseIsPulling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                      ดึงข้อมูลจาก Supabase
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    {supabaseLastSynced && (
                      <span className="text-[10px] text-slate-400 sm:order-first">
                        ซิงค์ล่าสุด: {supabaseLastSynced}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedSql ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      {copiedSql ? 'คัดลอก SQL แล้ว' : 'คัดลอก SQL สร้างตาราง'}
                    </button>
                  </div>
                </div>
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
        tableName={supabaseTableName}
        onLoginSuccess={markAuthenticated}
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
            {supabaseStatus === 'connected' ? (
              <button
                onClick={() => setActiveTab('backup')}
                className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all text-left cursor-pointer"
                title="เชื่อมต่อฐานข้อมูลคลาวด์แล้ว คลิกเพื่อดูข้อมูลสำรอง"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="truncate">Supabase ซิงค์ออนไลน์</span>
                </span>
                <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
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
            {supabaseStatus === 'connected' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                ซิงค์แล้ว
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
