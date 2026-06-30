import { useState, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppDatabase } from '../types';

const AUTO_SYNC_LS_KEY = 'buddy_erp_supabase_auto_sync';
const DEFAULT_TABLE = 'buddy_erp_backoffice';
type SupabaseStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const LEGACY_LS_KEYS = [
  'campchair_supabase_url',
  'campchair_supabase_anon_key',
  'campchair_supabase_auto_sync',
  'campchair_supabase_row_id',
  'campchair_supabase_table',
  'buddy_erp_supabase_url',
  'buddy_erp_supabase_anon_key',
  'buddy_erp_supabase_table',
  'buddy_erp_supabase_row_id',
  'buddy_erp_database'
];

function clearLegacySupabaseConfig() {
  LEGACY_LS_KEYS.forEach((key) => localStorage.removeItem(key));
}

function isValidAppDatabase(value: unknown): value is AppDatabase {
  const db = value as AppDatabase;
  return Boolean(
    db &&
    Array.isArray(db.brands) &&
    Array.isArray(db.models) &&
    Array.isArray(db.variants) &&
    Array.isArray(db.purchaseBatches) &&
    Array.isArray(db.stockItems) &&
    Array.isArray(db.customers) &&
    Array.isArray(db.orders) &&
    Array.isArray(db.deliveries)
  );
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
  const [status, setStatus] = useState<SupabaseStatus>('disconnected');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastSynced, setLastSynced] = useState<string>('');
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);

  useEffect(() => {
    clearLegacySupabaseConfig();
  }, []);

  useEffect(() => {
    localStorage.setItem(AUTO_SYNC_LS_KEY, String(autoSync));
  }, [autoSync]);

  useEffect(() => {
    let cancelled = false;

    if (url.trim() && anonKey.trim()) {
      try {
        setStatus('connecting');
        setErrorMsg('');
        setHasLoadedRemote(false);
        const supabase = createClient(url.trim(), anonKey.trim(), {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        });
        setClient(supabase);

        const connectSql = async () => {
          const { data, error } = await supabase
            .from(tableName)
            .select('data, updated_at')
            .eq('id', rowId)
            .maybeSingle();

          if (cancelled) return;

          if (error) {
            setClient(null);
            setStatus('error');
            if (error.code === '42P01') {
              setErrorMsg(`ไม่พบตาราง "${tableName}" ใน Supabase กรุณารัน SQL จากหน้า README หรือ database.sql ก่อน`);
            } else {
              setErrorMsg(`เชื่อม SQL ไม่สำเร็จ: ${error.message}`);
            }
            return;
          }

          if (data?.data) {
            if (!isValidAppDatabase(data.data)) {
              setClient(null);
              setStatus('error');
              setErrorMsg(`ข้อมูลใน row "${rowId}" ของตาราง "${tableName}" ไม่ตรงรูปแบบระบบ Buddy ERP`);
              return;
            }
            setDb(data.data);
          } else {
            const emptyDb: AppDatabase = {
              brands: [],
              models: [],
              variants: [],
              purchaseBatches: [],
              stockItems: [],
              customers: [],
              orders: [],
              deliveries: []
            };
            const { error: insertError } = await supabase
              .from(tableName)
              .upsert({
                id: rowId,
                data: emptyDb,
                updated_at: new Date().toISOString()
              }, { onConflict: 'id' });

            if (cancelled) return;

            if (insertError) {
              setClient(null);
              setStatus('error');
              setErrorMsg(`สร้าง row เริ่มต้นใน SQL ไม่สำเร็จ: ${insertError.message}`);
              return;
            }
            setDb(emptyDb);
          }

          setHasLoadedRemote(true);
          setStatus('connected');
          setLastSynced(new Date().toLocaleTimeString('th-TH'));
        };

        connectSql();
      } catch (err: any) {
        if (cancelled) return;
        setClient(null);
        setHasLoadedRemote(false);
        setStatus('error');
        setErrorMsg(err?.message || 'URL หรือ API Key ไม่ถูกต้อง');
      }
    } else {
      setClient(null);
      setHasLoadedRemote(false);
      setStatus('disconnected');
      setErrorMsg('ต้องตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ใน .env.local ก่อนใช้งาน');
    }

    return () => {
      cancelled = true;
    };
  }, [url, anonKey, tableName, rowId, setDb]);

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
        if (isValidAppDatabase(data.data)) {
          setDb(data.data);
          setHasLoadedRemote(true);
          setLastSynced(new Date().toLocaleTimeString('th-TH'));
          return { success: true, data: data.data };
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
    if (!autoSync || status !== 'connected' || !client || !hasLoadedRemote) return;

    const timer = setTimeout(() => {
      pushToSupabase();
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [db, autoSync, status]);

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
    hasLoadedRemote,
    pushToSupabase,
    pullFromSupabase,
    client,
  };
}
