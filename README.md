# Buddy ERP

Backoffice สำหรับจัดการสินค้า สต็อก WAC ลูกค้า ออเดอร์ การจัดส่ง และรายงาน พร้อมนำเข้าและส่งออกไฟล์สำรอง JSON

## Supabase Setup

1. Create a Supabase project and run the SQL migration in `supabase/migrations/202606300001_initial_buddy_erp.sql`.
2. In Supabase Auth, create the email/password user that will operate the store.
3. Copy `.env.example` to `.env` locally and fill in:

   ```bash
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

4. Add the same two variables in Vercel Project Settings → Environment Variables.

## Run Locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the app:

   ```bash
   npm run dev
   ```
