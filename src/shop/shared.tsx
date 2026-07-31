import React from 'react';
import { Facebook, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { ModelCard, PublicVariant } from './types';

// --- STORE CONTACT CONFIG ---
// TODO: แทนที่ด้วยข้อมูลจริงของร้าน (ลิงก์เพจ Facebook ที่ถูกต้อง)
export const STORE = {
  name: 'Buddy Camp',
  tagline: 'อุปกรณ์แคมป์ปิ้งพร้อมส่ง · ส่งจากเชียงใหม่',
  heroLead: 'พร้อมออกเดินทางได้ทุกสุดสัปดาห์',
  heroSub: 'เลือกดูสินค้าและราคาล่าสุด กดเลือกสีเพื่อดูของจริง เจอที่ถูกใจแล้วทักเพจสั่งได้เลย',
  facebookUrl: 'https://www.facebook.com/buddycampingstore',
};

// Service promises scrolled in the marquee under the hero.
// TODO: ตรวจสอบให้ตรงกับนโยบายจริงของร้านก่อนเผยแพร่
export const TRUST_ITEMS = [
  'ส่งไว 1–2 วันทำการ',
  'เปลี่ยนคืนภายใน 7 วัน',
  'ทักถามก่อนสั่งได้ตลอด',
  'ของแท้ พร้อมส่งจากสต็อกจริง',
];

// Same colour mapping as the ERP catalog (ProductsView.getDynamicColorStyles),
// copied here to keep the storefront fully decoupled from ERP components.
export const getDynamicColorStyles = (colorName: string) => {
  const low = colorName.toLowerCase();
  if (low.includes('khaki') || low.includes('กากี')) return 'bg-[#C3B091]';
  if (low.includes('cream') || low.includes('ครีม') || low.includes('ขาว')) return 'bg-[#FDFBF7] border border-black/15';
  if (low.includes('black') || low.includes('ดำ')) return 'bg-[#1C1C1E]';
  if (low.includes('green') || low.includes('เขียว') || low.includes('olive')) return 'bg-[#556B2F]';
  if (low.includes('red') || low.includes('แดง')) return 'bg-[#C0392B]';
  if (low.includes('blue') || low.includes('น้ำเงิน') || low.includes('ฟ้า')) return 'bg-[#2980B9]';
  if (low.includes('gray') || low.includes('เทา')) return 'bg-[#7F8C8D]';
  if (low.includes('brown') || low.includes('น้ำตาล')) return 'bg-[#8B4513]';
  if (low.includes('yellow') || low.includes('เหลือง')) return 'bg-[#F1C40F]';
  return 'bg-linear-to-tr from-[#d8c7ad] to-caramel';
};

export const formatBaht = (value: number) => `฿${value.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;

/* The photo shown for a colour: its own shot when it has one, else the model's.
   Variants that share a fallback resolve to the same URL by design. */
export const variantImage = (card: ModelCard, variant?: PublicVariant) => variant?.image || card.image;

/* Every distinct photo across a model's colours. The card and the detail sheet
   stack these as cross-fading layers, so switching colour fades between images
   the browser has already decoded instead of swapping one <img src>, which
   flashes empty on a slow connection. Duplicate URLs collapse to one layer. */
export const imageLayers = (card: ModelCard): string[] =>
  Array.from(new Set(card.variants.map(v => variantImage(card, v)).filter((url): url is string => !!url)));

/* Stock level a full bar represents. Above this the bar simply reads "full" —
   customers only need "plenty / getting low", not an exact scale. */
export const SHELF_FULL = 15;

export const stockBarPct = (qty: number) => Math.max(4, Math.min(100, (qty / SHELF_FULL) * 100));

/* The public catalog carries no editorial badge field, so the corner ribbon is
   derived from live stock. Claims we cannot verify from the data (bestseller,
   new arrival) are deliberately not invented here. */
export const stockBadge = (totalStock: number): { text: string; out: boolean } | null => {
  if (totalStock === 0) return { text: 'สินค้าหมด', out: true };
  if (totalStock <= 3) return { text: 'เหลือน้อย', out: false };
  return null;
};

/* Filter pill shared by the brand rail and the in-stock / favourites toggles. */
export const chipClass = (active: boolean) =>
  `inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-full border text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-[background-color,color,border-color,transform,box-shadow] duration-300 ${
    active
      ? 'bg-bark text-paper border-bark -translate-y-px shadow-[0_8px_18px_-10px_rgba(54,36,15,0.9)]'
      : 'bg-transparent text-muted border-bark/15 hover:border-copper hover:text-bark'
  }`;

export const FacebookButton: React.FC<{
  className?: string;
  onDark?: boolean;
  label?: string;
  showIcon?: boolean;
}> = ({ className = '', onDark = false, label = 'ทักเพจเพื่อสั่งซื้อ', showIcon = true }) => (
  <motion.a
    href={STORE.facebookUrl}
    target="_blank"
    rel="noopener noreferrer"
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.97 }}
    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
    className={`group inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-colors ${
      onDark
        ? 'bg-paper text-bark hover:bg-white'
        : 'bg-copper text-white hover:bg-bark2 shadow-sm'
    } ${className}`}
  >
    {showIcon && <Facebook className="w-4 h-4" />}
    {label}
    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
  </motion.a>
);
