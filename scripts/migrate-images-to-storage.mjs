/**
 * One-time migration: move base64 images embedded in the variants/models
 * image columns into the product-images Storage bucket, then replace the
 * column value with the public URL.
 *
 * Why: pasted data: URIs bloated variants to 29 MB / models to 12 MB, making
 * get_products_payload build a ~38 MB jsonb that hit the statement timeout.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_URL = "https://<project-ref>.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "<service role key from Dashboard > Settings > API>"
 *   node scripts/migrate-images-to-storage.mjs
 *
 * The service role key bypasses RLS — never commit it or put it in .env.local.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('ตั้งค่า SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ก่อนรัน (ดูวิธีในคอมเมนต์หัวไฟล์)');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const BUCKET = 'product-images';

const parseDataUri = (dataUri) => {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is.exec(dataUri);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1].replace(/[^a-z0-9]/g, '') || 'bin';
  return { mime, ext, buffer: Buffer.from(match[2], 'base64') };
};

const migrateTable = async (table) => {
  const { data: rows, error } = await supabase
    .from(table)
    .select('id, image')
    .like('image', 'data:%');
  if (error) throw new Error(`${table}: อ่านข้อมูลไม่สำเร็จ - ${error.message}`);

  console.log(`\n== ${table}: พบรูป base64 จำนวน ${rows.length} รูป ==`);
  let ok = 0;
  for (const row of rows) {
    const parsed = parseDataUri(row.image);
    if (!parsed) {
      console.warn(`  [ข้าม] ${row.id}: ไม่ใช่ data URI รูปภาพที่รู้จัก`);
      continue;
    }
    const path = `${table}/${row.id}-migrated.${parsed.ext}`;
    const sizeKb = Math.round(parsed.buffer.length / 1024);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, parsed.buffer, { contentType: parsed.mime, cacheControl: '31536000', upsert: true });
    if (uploadError) {
      console.error(`  [พลาด] ${row.id}: อัปโหลดไม่สำเร็จ - ${uploadError.message}`);
      continue;
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const { error: updateError } = await supabase
      .from(table)
      .update({ image: publicUrlData.publicUrl })
      .eq('id', row.id);
    if (updateError) {
      console.error(`  [พลาด] ${row.id}: อัปเดตแถวไม่สำเร็จ - ${updateError.message}`);
      continue;
    }

    ok += 1;
    console.log(`  [สำเร็จ] ${row.id} (${sizeKb} KB) -> ${path}`);
  }
  console.log(`== ${table}: ย้ายสำเร็จ ${ok}/${rows.length} รูป ==`);
  return { total: rows.length, ok };
};

const main = async () => {
  const variants = await migrateTable('variants');
  const models = await migrateTable('models');
  const total = variants.total + models.total;
  const ok = variants.ok + models.ok;
  console.log(`\nสรุป: ย้ายรูปขึ้น Storage สำเร็จ ${ok}/${total} รูป`);
  if (ok === total && total > 0) {
    console.log('เสร็จแล้ว! เปิดแอปแล้ว refresh รูปทั้งหมดจะกลับมาแสดงจาก Storage (โหลดเร็วขึ้นมาก)');
  }
};

main().catch((err) => {
  console.error('เกิดข้อผิดพลาด:', err.message || err);
  process.exit(1);
});
