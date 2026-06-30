# Buddy ERP

Backoffice สำหรับจัดการสินค้า สต็อก WAC ลูกค้า ออเดอร์ การจัดส่ง และรายงาน โดยซิงค์ข้อมูลผ่าน Supabase

ระบบนี้ใช้ Supabase SQL เป็นแหล่งข้อมูลหลักเท่านั้น ถ้าเชื่อมต่อ SQL ไม่สำเร็จ แอปจะไม่เปิดหน้า ERP ให้ใช้งาน

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
   VITE_SUPABASE_ROW_ID="default"
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

alter table public.buddy_erp_backoffice enable row level security;

create policy "buddy_erp_backoffice_app_read"
  on public.buddy_erp_backoffice
  for select
  to anon, authenticated
  using (true);

create policy "buddy_erp_backoffice_app_write"
  on public.buddy_erp_backoffice
  for all
  to anon, authenticated
  using (true)
  with check (true);
```

Open "ตั้งค่า / สำรองข้อมูล" to upload local data or pull data from Supabase. Supabase URL, anon key, table name, and row ID are read from `.env.local` only.
When the configured row does not exist yet, the app creates an empty row in Supabase before opening the ERP screen.
