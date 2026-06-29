# Buddy ERP

React + Vite backoffice for Buddy Camping inventory, orders, deliveries, reports, and Supabase cloud sync.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in:
   ```bash
   VITE_SUPABASE_URL="https://your-project-id.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
   ```
3. Start the app:
   ```bash
   npm run dev
   ```

## Supabase Setup

1. Create or open your Supabase project.
2. Create admin users in Supabase Auth.
3. In the app, open `ตั้งค่า / สำรองข้อมูล`.
4. Copy the SQL shown in the Supabase panel and run it in Supabase SQL Editor.
5. Return to the app and press `อัปโหลดขึ้นคลาวด์`.

The Vercel frontend uses the public Supabase anon key. Data access is protected by Supabase Auth and RLS policies, so do not disable RLS in production.

## Vercel Setup

Set these Environment Variables in Vercel for Production, Preview, and Development as needed:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Then deploy normally with Vercel's Vite preset.
