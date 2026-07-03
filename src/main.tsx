import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthGate } from './components/AuthGate.tsx';
import './index.css';

// Native alert is replaced by a non-blocking toast because embedded previews
// can block modal dialogs. The message is always written as text content.
if (typeof window !== 'undefined') {
  window.alert = (message?: any) => {
    console.info('[ALERT SHIELDED]:', message);
    try {
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
      icon.className = 'text-emerald-500 font-bold select-none text-sm';
      icon.textContent = '✓';

      const body = document.createElement('span');
      body.className = 'flex-1';
      body.textContent = String(message ?? '');

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
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
);
