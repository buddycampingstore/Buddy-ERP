import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthGate } from './components/AuthGate.tsx';
import './index.css';

// Native alert is replaced by a non-blocking toast because embedded previews
// can block modal dialogs. The message is always written as text content.
type ToastType = 'success' | 'error' | 'warning';

// Infer the toast tone from the message text so genuine failures don't render
// with a success checkmark. Error phrases are checked first because "สำเร็จ"
// is a substring of "ไม่สำเร็จ".
const ERROR_KEYWORDS = ['ไม่สำเร็จ', 'ไม่สามารถ', 'ผิดพลาด', 'ล้มเหลว', 'เกินไป', 'error', 'Error'];
const WARNING_KEYWORDS = ['กรุณา', 'ก่อน'];

const classifyToast = (message: string): ToastType => {
  if (ERROR_KEYWORDS.some(k => message.includes(k))) return 'error';
  if (WARNING_KEYWORDS.some(k => message.includes(k))) return 'warning';
  return 'success';
};

const TOAST_STYLES: Record<ToastType, { icon: string; iconClass: string }> = {
  success: { icon: '✓', iconClass: 'text-emerald-500' },
  error: { icon: '✕', iconClass: 'text-red-500' },
  warning: { icon: '⚠', iconClass: 'text-amber-400' },
};

const renderToast = (message?: unknown, type?: ToastType) => {
  console.info('[ALERT SHIELDED]:', message);
  try {
    const text = String(message ?? '');
    const tone = type ?? classifyToast(text);
    const { icon: iconChar, iconClass } = TOAST_STYLES[tone];

    const containerId = 'safe-toast-holder';
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.className = 'fixed bottom-4 right-4 z-100 flex flex-col gap-2 pointer-events-none max-w-sm';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const baseClass = 'bg-slate-900 border border-slate-800 text-white px-4 py-3 rounded-xl shadow-lg font-medium text-xs flex items-center gap-2.5 pointer-events-auto transition-all duration-300 transform';
    toast.className = `${baseClass} translate-y-2 opacity-0`;

    const icon = document.createElement('span');
    icon.className = `${iconClass} font-bold select-none text-sm`;
    icon.textContent = iconChar;

    const body = document.createElement('span');
    body.className = 'flex-1';
    body.textContent = text;

    toast.append(icon, body);
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.className = `${baseClass} translate-y-0 opacity-100`;
    });

    setTimeout(() => {
      toast.className = `${baseClass} translate-y-2 opacity-0`;
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  } catch (e) {
    console.warn('Could not render toast payload:', e);
  }
};

if (typeof window !== 'undefined') {
  window.alert = (message?: unknown) => renderToast(message);
  // Optional explicit API for callers that want to force a tone.
  (window as unknown as { notify?: (m: unknown, t?: ToastType) => void }).notify = renderToast;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
);
