import React from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface DeleteAuthRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
}

interface DeleteAuthDialogProps {
  request: DeleteAuthRequest | null;
  onClose: () => void;
}

export const DeleteAuthDialog: React.FC<DeleteAuthDialogProps> = ({ request, onClose }) => {
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setPassword('');
    setError(null);
    setSubmitting(false);
  }, [request]);

  if (!request) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const email = sessionData.session?.user.email;
      if (!email) {
        throw new Error('ไม่พบอีเมลของผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (authError) {
        throw new Error('รหัสผ่าน Supabase ไม่ถูกต้อง');
      }

      await request.onConfirm();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'ยืนยันตัวตนไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/45 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white border border-rose-100 rounded-xl shadow-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">{request.title}</h2>
            <p className="text-xs text-slate-600 leading-relaxed">{request.message}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">รหัสผ่าน Supabase</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full text-sm pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:border-rose-500"
              placeholder="กรอกรหัสผ่านเพื่อยืนยัน"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-3">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 rounded-xl"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl"
          >
            {submitting ? 'กำลังตรวจสอบ...' : request.confirmLabel || 'ยืนยันและลบ'}
          </button>
        </div>
      </form>
    </div>
  );
};
