# Buddy ERP

Backoffice สำหรับจัดการสินค้า สต็อก WAC ลูกค้า ออเดอร์ การจัดส่ง และรายงาน โดยซิงค์ข้อมูลผ่าน Supabase

## Run Locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` and set your current Supabase project values:

   ```bash
   VITE_SUPABASE_URL="https://your-project.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-current-anon-public-key"
   VITE_SUPABASE_TABLE="buddy_erp_backoffice"
   ```

3. Run the app:

   ```bash
   npm run dev
   ```

## Supabase Setup

Run [database.sql](database.sql) in Supabase SQL Editor. The current app-compatible table is:

```sql
create table if not exists public.buddy_erp_backoffice (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.buddy_erp_backoffice disable row level security;
```

After login, open "ตั้งค่า / สำรองข้อมูล" to set the table name, upload local data, or pull data from Supabase.
