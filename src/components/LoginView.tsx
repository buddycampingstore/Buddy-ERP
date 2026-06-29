import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Tent, 
  ShieldCheck, 
  RefreshCw, 
  Mail, 
  Database, 
  Settings, 
  AlertTriangle, 
  Plus, 
  LogIn,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import logoImg from '../assets/images/logo_1782269852938.jpg';
import { SupabaseClient } from '@supabase/supabase-js';

interface LoginViewProps {
  client: SupabaseClient | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  errorMsg: string;
  url: string;
  setUrl: (url: string) => void;
  anonKey: string;
  setAnonKey: (key: string) => void;
  onLoginSuccess: () => void;
}

export function LoginView({ 
  client, 
  status, 
  errorMsg, 
  url, 
  setUrl, 
  anonKey, 
  setAnonKey, 
  onLoginSuccess 
}: LoginViewProps) {
  // Supabase Auth form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const isSignUpMode = false;
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseMessage, setSupabaseMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Connection settings display toggle
  const [showConnectionConfig, setShowConnectionConfig] = useState(false);
  const [inputUrl, setInputUrl] = useState(url);
  const [inputAnonKey, setInputAnonKey] = useState(anonKey);

  // Update input values when prop values change
  useEffect(() => {
    setInputUrl(url);
  }, [url]);

  useEffect(() => {
    setInputAnonKey(anonKey);
  }, [anonKey]);

  // Submit handler for Supabase Auth
  const handleSupabaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) {
      setSupabaseMessage({ 
        type: 'error', 
        text: 'ไม่ได้ตั้งค่าการเชื่อมต่อ Supabase กรุณาเปิดแผงตั้งค่าและระบุ URL / Anon Key' 
      });
      return;
    }

    setSupabaseMessage(null);
    setSupabaseLoading(true);

    try {
      if (isSignUpMode) {
        // Sign Up Flow
        const { data, error } = await client.auth.signUp({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        // Check if user needs to confirm email
        if (data?.user && data.session === null) {
          setSupabaseMessage({
            type: 'success',
            text: 'สมัครสมาชิกสำเร็จแล้ว! กรุณาเช็คกล่องข้อความในอีเมลเพื่อยืนยันตน หรือเปิดบอร์ด Supabase ข้ามการยืนยันอีเมล'
          });
        } else if (data?.session) {
          setSupabaseMessage({
            type: 'success',
            text: 'สมัครสมาชิกและเข้าสู่ระบบสำเร็จ!'
          });
          sessionStorage.setItem('campchair_is_authenticated', 'true');
          setTimeout(() => onLoginSuccess(), 1000);
        } else {
          setSupabaseMessage({
            type: 'success',
            text: 'ลงทะเบียนสำเร็จแล้ว!'
          });
        }
      } else {
        // Sign In Flow
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        sessionStorage.setItem('campchair_is_authenticated', 'true');
        onLoginSuccess();
      }
    } catch (err: any) {
      setSupabaseMessage({
        type: 'error',
        text: err?.message || 'เกิดข้อผิดพลาดในการดำเนินการของ Supabase Auth'
      });
    } finally {
      setSupabaseLoading(false);
    }
  };

  // Save Connection Config
  const handleSaveConnection = (e: React.FormEvent) => {
    e.preventDefault();
    setUrl(inputUrl.trim());
    setAnonKey(inputAnonKey.trim());
    setSupabaseMessage(null);
    alert('บันทึกค่าเชื่อมต่อเรียบร้อย กำลังทดสอบเชื่อมต่อใหม่...');
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative amber and green ambient glowing circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10 space-y-4">
        
        {/* Supabase Connection Warning Bar if status is not connected */}
        {status !== 'connected' && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-950/80 backdrop-blur-md border border-amber-500/30 text-amber-300 p-3.5 rounded-2xl flex items-start gap-3 text-xs"
          >
            <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold">ยังไม่พร้อมใช้งาน Supabase Auth:</strong>
              <p className="opacity-90 leading-relaxed text-[11px]">
                {status === 'disconnected' 
                  ? 'ยังไม่ได้ตั้งค่าเชื่อมต่อกับบริการคลาวด์ Supabase ของคุณ' 
                  : `การเชื่อมต่อขัดข้อง: ${errorMsg || 'กรุณาตรวจสอบ URL หรือ API Anon Key'}`}
              </p>
              <button 
                onClick={() => setShowConnectionConfig(true)}
                className="mt-1.5 inline-flex items-center gap-1 font-extrabold text-[10px] text-amber-400 hover:text-amber-200 uppercase cursor-pointer underline"
              >
                <Settings className="w-3 h-3" /> ตั้งค่าเชื่อมต่อตรงนี้
              </button>
            </div>
          </motion.div>
        )}

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="bg-slate-950/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-2xl space-y-5"
        >
          {/* Header & Logo */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center p-0.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-amber-500 shadow-lg">
              <div className="w-14 h-14 rounded-2xl overflow-hidden border border-slate-900 bg-white flex items-center justify-center">
                <img 
                  src={logoImg} 
                  alt="Buddy Camping Store Logo" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center justify-center gap-1.5 uppercase">
                <Tent className="w-5 h-5 text-emerald-500 animate-pulse" />
                Buddy Camping
              </h1>
              <p className="text-[10px] text-emerald-400 font-extrabold tracking-widest mt-1 uppercase">
                Backoffice & Stock ERP
              </p>
            </div>
          </div>

          {/* Supabase Authentication Form */}
          <form onSubmit={handleSupabaseSubmit} className="space-y-4">
            <div className="text-center">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-950/50 text-emerald-400 border border-emerald-900/40">
                <Database className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                ระบบเข้าใช้งานออนไลน์ผ่านระบบความปลอดภัยคลาวด์ (Supabase Auth)
              </span>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                อีเมล (Email Address)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="เช่น user@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs py-3 pl-10 pr-4 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 outline-none focus:bg-slate-900 focus:border-emerald-600 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="รหัสผ่านอย่างน้อย 6 หลัก..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs py-3 pl-10 pr-10 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 outline-none focus:bg-slate-900 focus:border-emerald-600 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {supabaseMessage && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-[11px] font-semibold p-2.5 rounded-xl text-center ${
                  supabaseMessage.type === 'success'
                    ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-900/40'
                    : 'text-rose-400 bg-rose-950/40 border border-rose-900/40'
                }`}
              >
                {supabaseMessage.type === 'success' ? '✓' : '⚠️'} {supabaseMessage.text}
              </motion.p>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="submit"
                disabled={supabaseLoading || status !== 'connected'}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs py-3 rounded-xl shadow-lg shadow-emerald-950/50 transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {supabaseLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white/80" />
                    กำลังประมวลผลระบบคลาวด์...
                  </>
                ) : isSignUpMode ? (
                  <>
                    <Plus className="w-4 h-4" />
                    ลงทะเบียนแอดมินใหม่
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    เข้าสู่ระบบด้วย Supabase Auth
                  </>
                )}
              </button>


            </div>
          </form>

          {/* Bottom utility: configuration status */}
          <div className="pt-3 border-t border-slate-900/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              สถานะ: {status === 'connected' ? 'พร้อมซิงค์ออนไลน์' : 'เซิร์ฟเวอร์ไม่ได้เชื่อมต่อ'}
            </span>
          </div>
        </motion.div>

        {/* Supabase connection configuration panel */}
        <AnimatePresence>
          {showConnectionConfig && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-slate-950/90 border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 to-amber-500" />
              <h3 className="font-bold text-white text-xs mb-3.5 flex items-center gap-2">
                <Database className="w-4.5 h-4.5 text-emerald-500" />
                ตั่งค่าเชื่อมต่อบริการคลาวด์ Supabase
              </h3>

              <form onSubmit={handleSaveConnection} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="เช่น https://yourproject.supabase.co"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    className="w-full text-[11px] p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 placeholder-slate-600 outline-none focus:border-emerald-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                    Anon Public API Key
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={inputAnonKey}
                    onChange={(e) => setInputAnonKey(e.target.value)}
                    className="w-full text-[11px] p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 placeholder-slate-600 outline-none focus:border-emerald-600 font-mono"
                  />
                </div>

                <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/60 text-[10px] text-slate-400 space-y-1">
                  <p className="font-bold flex items-center gap-1 text-slate-300">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ขั้นตอนความปลอดภัยสำหรับใช้งานออนไลน์:
                  </p>
                  <p className="leading-relaxed">
                    เมื่อเชื่อมต่อแล้ว ระบบจะสร้างตารางเก็บข้อมูลแบรนด์ สต็อกสินค้า WAC และประวัติออเดอร์ แอดมินทุกคนสามารถล็อกอินเพื่อแก้ไขคลังจากคนละเครื่องและซิงค์ข้อมูลผ่าน API ได้โดยตรง
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-100 font-extrabold text-[11px] py-2.5 rounded-xl border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  บันทึกความเชื่อมโยงและเชื่อมใหม่
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
