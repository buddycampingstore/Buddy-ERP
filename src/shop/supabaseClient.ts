import { createClient } from '@supabase/supabase-js';

// Dedicated anon-only client for the public storefront. It deliberately does
// NOT persist or refresh a session, so it never touches the ERP's auth token
// in localStorage and never tries to keep an anon session alive. All the shop
// needs is the public get_storefront_catalog() RPC, which the anon key covers.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseShop = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);
