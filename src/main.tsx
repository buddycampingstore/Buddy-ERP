import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthGate } from './components/AuthGate.tsx';
import './index.css';

// Polyfill/Override native alert and confirm to prevent sandboxed iframe exceptions
if (typeof window !== 'undefined') {
  window.alert = (message?: any) => {
    console.info('[ALERT SHIELDED]:', message);
    try {
      // Create a beautiful, custom lightweight floating toast notice
      const containerId = 'safe-toast-holder';
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'fixed bottom-4 right-4 z-100 flex flex-col gap-2 pointer-events-none max-w-sm';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = 'bg-slate-900 border border-slate-800 text-white px-4 py-3 rounded-xl shadow-lg font-medium text-xs flex items-center gap-2.5 pointer-events-auto transition-all duration-300 transform translate-y-2 opacity-0';
      toast.innerHTML = `
        <span class="text-emerald-500 font-bold select-none text-sm">✓</span>
        <span class="flex-1">${message}</span>
      `;
      container.appendChild(toast);

      // Trigger animation
      requestAnimationFrame(() => {
        toast.className = 'bg-slate-900 border border-slate-800 text-white px-4 py-3 rounded-xl shadow-lg font-medium text-xs flex items-center gap-2.5 pointer-events-auto transition-all duration-300 transform translate-y-0 opacity-100';
      });

      // Dismount after 4.5 seconds
      setTimeout(() => {
        toast.className = 'bg-slate-900 border border-slate-800 text-white px-4 py-3 rounded-xl shadow-lg font-medium text-xs flex items-center gap-2.5 pointer-events-auto transition-all duration-300 transform translate-y-2 opacity-0';
        setTimeout(() => toast.remove(), 300);
      }, 4500);
    } catch (e) {
      console.warn('Could not render elegant toast payload:', e);
    }
  };

  window.confirm = (message?: string) => {
    console.info('[CONFIRM SHIELDED]:', message);
    // In sandboxed iframe context, native modal confirm() would otherwise crash the execution thread.
    // We return true directly to allow natural continuation of CRUD actions.
    return true;
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
);
