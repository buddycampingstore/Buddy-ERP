import { useState, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppDatabase } from '../types';

const URL_LS_KEY = 'campchair_supabase_url';
const KEY_LS_KEY = 'campchair_supabase_anon_key';
const AUTO_SYNC_LS_KEY = 'campchair_supabase_auto_sync';
const ROW_ID_LS_KEY = 'campchair_supabase_row_id';

const isValidDatabaseShape = (value: unknown): value is AppDatabase => {
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
};

const TABLE_MISSING_MESSAGE = 'ตาราง "campchair_backoffice" ยังไม่ถูกสร้างใน Supabase กรุณารัน SQL ในหน้า ตั้งค่า / สำรองข้อมูล แล้วกดอัปโหลดขึ้นคลาวด์อีกครั้ง';

export function useSupabase(db: AppDatabase, setDb: (db: AppDatabase) => void) {
  const [url, setUrl] = useState(() => localStorage.getItem(URL_LS_KEY) || (import.meta.env.VITE_SUPABASE_URL || ''));
  const [anonKey, setAnonKey] = useState(() => localStorage.getItem(KEY_LS_KEY) || (import.meta.env.VITE_SUPABASE_ANON_KEY || ''));
  const [rowId, setRowId] = useState(() => localStorage.getItem(ROW_ID_LS_KEY) || 'default');
  const [autoSync, setAutoSync] = useState(() => localStorage.getItem(AUTO_SYNC_LS_KEY) !== 'false');
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastSynced, setLastSynced] = useState<string>('');
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isTableReady, setIsTableReady] = useState(false);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);

  // Save config to LS
  useEffect(() => {
    localStorage.setItem(URL_LS_KEY, url);
  }, [url]);

  useEffect(() => {
    localStorage.setItem(KEY_LS_KEY, anonKey);
  }, [anonKey]);

  useEffect(() => {
    localStorage.setItem(ROW_ID_LS_KEY, rowId);
    setHasBootstrapped(false);
  }, [rowId]);

  useEffect(() => {
    localStorage.setItem(AUTO_SYNC_LS_KEY, String(autoSync));
  }, [autoSync]);

  // Re-initialize client when url or key changes
  useEffect(() => {
    setHasBootstrapped(false);
    setIsTableReady(false);

    if (url.trim() && anonKey.trim()) {
      try {
        setStatus('connecting');
        const supabase = createClient(url.trim(), anonKey.trim(), {
          auth: { persistSession: false }
        });
        setClient(supabase);
        
        // Test connection
        const testConnection = async () => {
          try {
            const { error } = await supabase
              .from('campchair_backoffice')
              .select('id')
              .limit(1);

            if (error) {
              if (error.code === '42P01') {
                setStatus('connected'); // Connected to supabase, but table needs creation
                setIsTableReady(false);
                setErrorMsg(TABLE_MISSING_MESSAGE);
              } else {
                setStatus('error');
                setIsTableReady(false);
                setErrorMsg(`เชื่อมต่อล้มเหลว: ${error.message}`);
              }
            } else {
              setStatus('connected');
              setIsTableReady(true);
              setErrorMsg('');
            }
          } catch (err: any) {
            setStatus('error');
            setIsTableReady(false);
            setErrorMsg(err?.message || 'ไม่สามารถเชื่อมต่อได้ (กรุณาเช็คอินเทอร์เน็ตหรือความถูกต้องของ URL)');
          }
        };
        testConnection();
      } catch (err: any) {
        setClient(null);
        setStatus('error');
        setIsTableReady(false);
        setErrorMsg(err?.message || 'URL หรือ API Key ไม่ถูกต้อง');
      }
    } else {
      setClient(null);
      setStatus('disconnected');
      setIsTableReady(false);
      setErrorMsg('');
    }
  }, [url, anonKey]);

  // Push to Supabase
  const pushToSupabase = async (currentDb: AppDatabase = db): Promise<{ success: boolean; error?: string }> => {
    if (!client) {
      return { success: false, error: 'ไม่ได้กำหนดค่าการเชื่อมต่อ Supabase' };
    }
    setIsPushing(true);
    try {
      const { error } = await client
        .from('campchair_backoffice')
        .upsert({
          id: rowId,
          data: currentDb,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) {
        if (error.code === '42P01') {
          setIsTableReady(false);
          setErrorMsg(TABLE_MISSING_MESSAGE);
          return { success: false, error: TABLE_MISSING_MESSAGE };
        }
        setErrorMsg(`อัปโหลดล้มเหลว: ${error.message}`);
        return { success: false, error: error.message };
      }
      setIsTableReady(true);
      setHasBootstrapped(true);
      setErrorMsg('');
      setLastSynced(new Date().toLocaleTimeString('th-TH'));
      return { success: true };
    } catch (err: any) {
      const message = err?.message || 'เกิดข้อผิดพลาดในการอัปโหลดข้อมูล';
      setErrorMsg(message);
      return { success: false, error: message };
    } finally {
      setIsPushing(false);
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
        .from('campchair_backoffice')
        .select('data, updated_at')
        .eq('id', rowId)
        .maybeSingle();

      if (error) {
        if (error.code === '42P01') {
          setIsTableReady(false);
          setErrorMsg(TABLE_MISSING_MESSAGE);
          return { success: false, error: TABLE_MISSING_MESSAGE };
        }
        setErrorMsg(`ดาวน์โหลดล้มเหลว: ${error.message}`);
        return { success: false, error: error.message };
      }

      if (data && data.data) {
        const remoteDb = data.data as AppDatabase;
        
        // Basic schema checking to avoid corruption
        if (isValidDatabaseShape(remoteDb)) {
          setDb(remoteDb);
          setIsTableReady(true);
          setHasBootstrapped(true);
          setErrorMsg('');
          setLastSynced(new Date().toLocaleTimeString('th-TH'));
          return { success: true, data: remoteDb };
        } else {
          const message = 'รูปแบบข้อมูลใน Supabase ไม่ถูกต้องหรือเสียหาย';
          setErrorMsg(message);
          return { success: false, error: message };
        }
      } else {
        const message = 'ยังไม่มีข้อมูลสำรองในคีย์นี้บน Supabase (กรุณากด "อัปโหลดข้อมูล" เพื่อตั้งต้น)';
        setErrorMsg(message);
        return { success: false, error: message };
      }
    } catch (err: any) {
      const message = err?.message || 'เกิดข้อผิดพลาดในการดาวน์โหลดข้อมูล';
      setErrorMsg(message);
      return { success: false, error: message };
    } finally {
      setIsPulling(false);
    }
  };

  // On first successful connection, pull existing cloud data.
  // If this Row ID has no cloud data yet, create it from the current local database.
  useEffect(() => {
    if (!autoSync || status !== 'connected' || !client || !isTableReady || hasBootstrapped) return;

    let cancelled = false;

    const bootstrapRemoteRow = async () => {
      setIsPulling(true);
      try {
        const { data, error } = await client
          .from('campchair_backoffice')
          .select('data, updated_at')
          .eq('id', rowId)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          if (error.code === '42P01') {
            setIsTableReady(false);
            setErrorMsg(TABLE_MISSING_MESSAGE);
          } else {
            setErrorMsg(`ซิงค์เริ่มต้นล้มเหลว: ${error.message}`);
          }
          return;
        }

        if (data?.data) {
          if (isValidDatabaseShape(data.data)) {
            setDb(data.data as AppDatabase);
            setErrorMsg('');
            setLastSynced(new Date().toLocaleTimeString('th-TH'));
            setHasBootstrapped(true);
          } else {
            setErrorMsg('รูปแบบข้อมูลใน Supabase ไม่ถูกต้องหรือเสียหาย');
          }
          return;
        }

        const pushResult = await pushToSupabase(db);
        if (!cancelled && !pushResult.success) {
          setErrorMsg(`สร้างข้อมูลบน Supabase ไม่สำเร็จ: ${pushResult.error}`);
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err?.message || 'เกิดข้อผิดพลาดในการซิงค์เริ่มต้น');
        }
      } finally {
        if (!cancelled) {
          setIsPulling(false);
        }
      }
    };

    bootstrapRemoteRow();

    return () => {
      cancelled = true;
    };
  }, [autoSync, status, client, isTableReady, hasBootstrapped, rowId]);

  // Debounced Auto Sync on database changes
  useEffect(() => {
    if (!autoSync || status !== 'connected' || !client || !isTableReady || !hasBootstrapped) return;

    const timer = setTimeout(() => {
      pushToSupabase();
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [db, autoSync, status, client, isTableReady, hasBootstrapped, rowId]);

  return {
    url,
    setUrl,
    anonKey,
    setAnonKey,
    rowId,
    setRowId,
    autoSync,
    setAutoSync,
    status,
    errorMsg,
    lastSynced,
    isPushing,
    isPulling,
    isTableReady,
    hasBootstrapped,
    pushToSupabase,
    pullFromSupabase,
    client,
  };
}
