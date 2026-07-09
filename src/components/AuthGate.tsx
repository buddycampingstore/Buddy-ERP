import React from 'react';
import { Session } from '@supabase/supabase-js';
import { LogIn } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import logoImg from '../assets/images/logo_1782269852938.jpg';

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Supabase auth errors come back in English; the rest of the screen is Thai.
  const toThaiAuthError = (message: string): string => {
    const lower = message.toLowerCase();
    if (lower.includes('invalid login credentials')) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่';
    if (lower.includes('email not confirmed')) return 'อีเมลนี้ยังไม่ได้ยืนยัน กรุณาติดต่อผู้ดูแลระบบ';
    if (lower.includes('email logins are disabled') || lower.includes('email_provider_disabled')) {
      return 'ระบบล็อกอินด้วยอีเมลถูกปิดอยู่ กรุณาติดต่อผู้ดูแลระบบ (เปิด Email provider ใน Supabase)';
    }
    if (lower.includes('too many requests') || lower.includes('rate limit')) return 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
    if (lower.includes('network') || lower.includes('fetch')) return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
    return `เข้าสู่ระบบไม่สำเร็จ: ${message}`;
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    setSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      setAuthError(toThaiAuthError(error.message));
    }
    setSubmitting(false);
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-amber-200 rounded-xl p-6 shadow-sm space-y-3">
          <h1 className="text-lg font-bold text-slate-900">Supabase ยังไม่ได้ตั้งค่า</h1>
          <p className="text-sm text-slate-600">
            กรุณาเพิ่ม `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ใน local `.env` และ Vercel Environment Variables
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-600">
        กำลังตรวจสอบสถานะเข้าสู่ระบบ...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
          <div className="space-y-2">
            <div className="w-11 h-11 rounded-xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center">
              <img src={logoImg} alt="Buddy ERP Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Buddy ERP Login</h1>
              <p className="text-xs text-slate-500">เข้าสู่ระบบเพื่อจัดการคลังและออเดอร์ของร้าน</p>
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:border-emerald-700"
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:border-emerald-700"
            />
          </div>

          {authError && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-3">{authError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white text-sm font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
};
