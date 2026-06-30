import { useState, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppDatabase } from '../types';

const AUTO_SYNC_LS_KEY = 'buddy_erp_supabase_auto_sync';
const DEFAULT_TABLE = 'buddy_erp_backoffice';
const LEGACY_LS_KEYS = [
  'campchair_supabase_url',
  'campchair_supabase_anon_key',
  'campchair_supabase_auto_sync',
  'campchair_supabase_row_id',
  'campchair_supabase_table',
  'buddy_erp_supabase_url',
  'buddy_erp_supabase_anon_key',
  'buddy_erp_supabase_table',
  'buddy_erp_supabase_row_id'
];

function clearLegacySupabaseConfig() {
  LEGACY_LS_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function useSupabase(db: AppDatabase, setDb: (db: AppDatabase) => void) {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const tableName = import.meta.env.VITE_SUPABASE_TABLE || DEFAULT_TABLE;
  const rowId = import.meta.env.VITE_SUPABASE_ROW_ID || 'default';
  const [autoSync, setAutoSync] = useState(() => {
    const stored = localStorage.getItem(AUTO_SYNC_LS_KEY);
    return stored === null ? true : stored === 'true';
  });
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastSynced, setLastSynced] = useState<string>('');
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  useEffect(() => {
    clearLegacySupabaseConfig();
  }, []);

  useEffect(() => {
    localStorage.setItem(AUTO_SYNC_LS_KEY, String(autoSync));
  }, [autoSync]);

  // Re-initialize client when url or key changes
  useEffect(() => {
    if (url.trim() && anonKey.trim()) {
      try {
        setStatus('connecting');
        const supabase = createClient(url.trim(), anonKey.trim(), {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        });
        setClient(supabase);
        setStatus('connected');
        setErrorMsg('');
      } catch (err: any) {
        setClient(null);
        setStatus('error');
        setErrorMsg(err?.message || 'URL หรือ API Key ไม่ถูกต้อง');
      }
    } else {
      setClient(null);
      setStatus('disconnected');
      setErrorMsg('');
    }
  }, [url, anonKey, tableName]);

  // Push to Supabase
  const pushToSupabase = async (currentDb: AppDatabase = db): Promise<{ success: boolean; error?: string }> => {
    if (!client) {
      return { success: false, error: 'ไม่ได้กำหนดค่าการเชื่อมต่อ Supabase' };
    }
    setIsPushing(true);
    try {
      const { error } = await client
        .from(tableName)
        .upsert({
          id: rowId,
          data: currentDb,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      setIsPushing(false);
      if (error) {
        if (error.code === '42P01') {
          return { success: false, error: `ไม่พบตาราง "${tableName}" ใน Supabase กรุณารัน SQL เพื่อสร้างตารางก่อน` };
        }
        return { success: false, error: error.message };
      }
      setLastSynced(new Date().toLocaleTimeString('th-TH'));
      return { success: true };
    } catch (err: any) {
      setIsPushing(false);
      return { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการอัปโหลดข้อมูล' };
    }
  };

  // Pull from Supabase
  const pullFromSupabase = async (): Promise<{ success: boolean; data?: AppDatabase; error?: string }> => {
    if (!client) {
      return { success: false, error: 'ไม่ได้กำหนดค่าการเชื่อมต่อ Supabase' };
    }
    setIsPulling(true);
    try {
      const { data, error } = await client
        .from(tableName)
        .select('data, updated_at')
        .eq('id', rowId)
        .maybeSingle();

      setIsPulling(false);
      if (error) {
        if (error.code === '42P01') {
          return { success: false, error: `ไม่พบตาราง "${tableName}" ใน Supabase กรุณารัน SQL เพื่อสร้างตารางก่อน` };
        }
        return { success: false, error: error.message };
      }

      if (data && data.data) {
        const remoteDb = data.data as AppDatabase;
        
        // Basic schema checking to avoid corruption
        if (
          Array.isArray(remoteDb.brands) &&
          Array.isArray(remoteDb.models) &&
          Array.isArray(remoteDb.variants)
        ) {
          setDb(remoteDb);
          setLastSynced(new Date().toLocaleTimeString('th-TH'));
          return { success: true, data: remoteDb };
        } else {
          return { success: false, error: 'รูปแบบข้อมูลใน Supabase ไม่ถูกต้องหรือเสียหาย' };
        }
      } else {
        return { success: false, error: 'ยังไม่มีข้อมูลสำรองในคีย์นี้บน Supabase (กรุณากด "อัปโหลดข้อมูล" เพื่อตั้งต้น)' };
      }
    } catch (err: any) {
      setIsPulling(false);
      return { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการดาวน์โหลดข้อมูล' };
    }
  };

  // Debounced Auto Sync on database changes
  useEffect(() => {
    if (!autoSync || status !== 'connected' || !client) return;

    const timer = setTimeout(() => {
      pushToSupabase();
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [db, autoSync, status]);

  // Auto Pull on connection if autoSync is true
  useEffect(() => {
    if (autoSync && status === 'connected' && client) {
      pullFromSupabase();
    }
  }, [status]);

  return {
    url,
    anonKey,
    tableName,
    rowId,
    autoSync,
    setAutoSync,
    status,
    errorMsg,
    lastSynced,
    isPushing,
    isPulling,
    pushToSupabase,
    pullFromSupabase,
    client,
  };
}
