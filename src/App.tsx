/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppData } from './hooks/useAppData';
import { DashboardView } from './components/DashboardView';
import { ProductsView } from './components/ProductsView';
import { PurchaseView } from './components/PurchaseView';
import { OrdersView } from './components/OrdersView';
import { DeliveriesView } from './components/DeliveriesView';
import { ReportsView } from './components/ReportsView';
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
  RotateCcw
} from 'lucide-react';

type TabType = 'dashboard' | 'products' | 'purchase' | 'orders' | 'deliveries' | 'reports' | 'backup';

export default function App() {
  const {
    data,
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
    clearData,
    loading,
    error
  } = useAppData();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- BACKUP PANEL STATE ---
  const [backupInput, setBackupInput] = useState('');

  // Export JSON file download
  const handleDownloadBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `buddy_erp_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    alert('ส่งออกไฟล์สํารองข้อมูล JSON เรียบร้อย!');
  };

  const handleImportBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupInput.trim()) return;
    const res = await importBackup(backupInput);
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

    fileReader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        const res = await importBackup(text);
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

  const handleClearAllSystemData = async () => {
    const password = window.prompt('⚠️ คำเตือนร้ายแรง! การดำเนินการนี้จะลบสินค้า ออเดอร์ ลูกค้า และข้อมูลสต็อกทั้งหมดออกจากระบบแบบถาวร\n\nกรุณากรอกรหัสผ่านความปลอดภัย (รหัสผ่านคือ: buddy99) เพื่อยืนยัน:');
    if (password === null) {
      return; // Cancelled
    }
    if (password.trim() === 'buddy99' || password.trim() === '9999' || password.trim() === 'buddy') {
      await clearData();
      alert('ระบบทำการลบข้อมูลทั้งหมดเรียบร้อยแล้ว ปัจจุบันข้อมูลว่างเปล่าสมบูรณ์!');
      setActiveTab('dashboard');
    } else {
      alert('❌ รหัสผ่านไม่ถูกต้อง! ไม่สามารถลบข้อมูลระบบได้');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-600">
        กำลังโหลดข้อมูลจาก Supabase...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md bg-white border border-rose-100 rounded-xl p-6 shadow-sm space-y-3">
          <h1 className="text-lg font-bold text-rose-600">โหลดข้อมูลไม่สำเร็จ</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

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
        return <DashboardView data={data} onNavigate={(tab) => setActiveTab(tab as TabType)} />;
      case 'products':
        return (
          <ProductsView
            data={data}
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
        return <PurchaseView data={data} addPurchaseBatch={addPurchaseBatch} />;
      case 'orders':
        return (
          <OrdersView
            data={data}
            createOrder={createOrder}
            updateOrderStatus={updateOrderStatus}
            deleteOrder={deleteOrder}
          />
        );
      case 'deliveries':
        return <DeliveriesView data={data} updateDelivery={updateDelivery} />;
      case 'reports':
        return <ReportsView data={data} />;
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
                  ส่งออกข้อมูลสํารอง (Export Data)
                </h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  ดาวน์โหลดข้อมูลและข้อมูลหลักของร้านค้าปัจจุบัน (แบรนด์, ล็อตนำเข้า, รายลูกค้า, และออเดอร์ทั้งหมด) เก็บไว้เป็นไฟล์ .json มีฟังก์ชันย้ายระบบ ย้ายโน้ตบุ๊ก ปล่อยเครื่องได้ปลอดภัย
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
                  นำเข้ากู้คืนข้อมูล (Import Data)
                </h3>
                <p className="text-slate-500 text-xs">
                  เลือกไฟล์สำรองนามสกุล .json ของแผงควบคุมนี้ เพื่อดึงข้อมูลกลับมาอย่างรวดเร็ว
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

              {/* Advanced Administration Reset Panel */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4 md:col-span-2">
                <h3 className="font-bold text-rose-600 text-sm flex items-center gap-1.5 border-b border-rose-50 pb-2">
                  <RotateCcw className="w-4.5 h-4.5 text-rose-500" />
                  ลบทำความสะอาดข้อมูลระบบทั้งหมด (Clear Data)
                </h3>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-slate-500">
                  <p className="max-w-xl leading-relaxed">
                    ฟังก์ชันนี้จะทำการลบข้อมูลการขาย ออเดอร์ แบรนด์ รุ่น คลังสินค้า ยอด WAC และรายการลูกค้าทั้งหมดออกจากระบบอย่างถาวรทันทีแบบไม่มีข้อมูลใดๆ หลงเหลืออยู่
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
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center bg-white shrink-0">
                <img src={logoImg} alt="BC" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 truncate">Buddy Camping</p>
                <p className="text-[9px] text-slate-400">ระบบคลังและออเดอร์</p>
              </div>
            </div>
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
        
        {/* Hamburger */}
        <div className="flex items-center gap-3 shrink-0">
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
