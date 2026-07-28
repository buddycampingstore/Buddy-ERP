import React from 'react';
import { MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';

// --- STORE CONTACT CONFIG ---
// TODO: แทนที่ด้วยข้อมูลจริงของร้าน (ลิงก์เพจ Facebook ที่ถูกต้อง)
export const STORE = {
  name: 'Buddy Camp',
  tagline: 'อุปกรณ์แคมป์ปิ้งพร้อมส่ง',
  heroLead: 'เลือกของ ทักเพจ แล้วออกเดินทาง',
  heroSub: 'ดูราคาและสีที่มีของจริงตรงนี้ ถูกใจรุ่นไหนกดปุ่มทักเพจ เดี๋ยวเราจัดให้',
  facebookUrl: 'https://www.facebook.com/buddycampingstore',
};

// Colour-name → swatch hex. Same mapping the ERP catalog uses
// (ProductsView.getDynamicColorStyles), kept here as a plain hex so the shop
// can reuse it for both the swatch fill and the derived image tint, and stays
// fully decoupled from ERP components.
export const colorHex = (colorName: string): string => {
  const low = colorName.toLowerCase();
  if (low.includes('khaki') || low.includes('กากี')) return '#C3B091';
  if (low.includes('cream') || low.includes('ครีม') || low.includes('ขาว')) return '#FDFBF7';
  if (low.includes('black') || low.includes('ดำ')) return '#1C1C1E';
  if (low.includes('olive') || low.includes('โอลีฟ')) return '#556B2F';
  if (low.includes('green') || low.includes('เขียว')) return '#3E6B2F';
  if (low.includes('red') || low.includes('แดง')) return '#C0392B';
  if (low.includes('orange') || low.includes('ส้ม')) return '#B4472E';
  if (low.includes('blue') || low.includes('น้ำเงิน') || low.includes('ฟ้า')) return '#2980B9';
  if (low.includes('gray') || low.includes('grey') || low.includes('เทา')) return '#7F8C8D';
  if (low.includes('brown') || low.includes('น้ำตาล')) return '#8B4513';
  if (low.includes('yellow') || low.includes('เหลือง')) return '#F1C40F';
  return '#c9ab84';
};

// Product-image backdrop, tinted by the selected colour so switching colours
// shifts the whole frame — and so a product with no photo still reads as that
// colour rather than as an empty grey box.
export const tintFor = (colorName: string): string => {
  const hex = colorHex(colorName);
  return `linear-gradient(150deg, ${hex}26 0%, #f3ebdf 55%, ${hex}1f 100%)`;
};

// Availability pill shown over the product image. Three states, because "this
// colour is out" and "the whole model is out" are very different to a customer.
export const stockBadge = (totalStock: number, selectedOut: boolean) => {
  if (totalStock === 0) return { label: 'สินค้าหมด', className: 'bg-clay text-white', soldOut: true };
  if (selectedOut) return { label: 'สีอื่นยังมีของ', className: 'bg-paper/95 text-bark', soldOut: false };
  return { label: 'พร้อมส่ง', className: 'bg-forest text-white', soldOut: false };
};

export const formatBaht = (value: number) => `฿${value.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;

/* The one way to buy: every CTA opens the Facebook page. `muted` is the
   out-of-stock tone (asking about another colour, not ordering this one),
   `onDark` the paper-on-bark variant used on the hero/footer gradients. */
export const FacebookButton: React.FC<{
  className?: string;
  onDark?: boolean;
  muted?: boolean;
  label?: string;
}> = ({ className = '', onDark = false, muted = false, label = 'ทักเพจเพื่อสั่งซื้อ' }) => (
  <motion.a
    href={STORE.facebookUrl}
    target="_blank"
    rel="noopener noreferrer"
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.97 }}
    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
    className={`inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors ${
      onDark
        ? 'bg-paper text-bark hover:bg-white'
        : muted
          ? 'bg-muted text-white hover:bg-bark shadow-[0_8px_18px_-10px_rgba(54,36,15,0.7)]'
          : 'bg-copper text-white hover:bg-bark2 shadow-[0_8px_18px_-10px_rgba(158,108,59,0.9)]'
    } ${className}`}
  >
    <MessageCircle className="w-[18px] h-[18px] shrink-0" />
    {label}
  </motion.a>
);
