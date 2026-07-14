import React from 'react';
import { Facebook, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

// --- STORE CONTACT CONFIG ---
// TODO: แทนที่ด้วยข้อมูลจริงของร้าน (ลิงก์เพจ Facebook ที่ถูกต้อง)
export const STORE = {
  name: 'Buddy Camp',
  tagline: 'อุปกรณ์แคมป์ปิ้งพร้อมส่ง',
  heroLead: 'พร้อมออกเดินทางได้',
  heroSub: 'เลือกดูสินค้าและราคาล่าสุด เจอที่ถูกใจแล้วทักเพจสั่งได้เลย',
  facebookUrl: 'https://www.facebook.com/buddycampingstore',
};

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

export const FacebookButton: React.FC<{ className?: string; onDark?: boolean }> = ({ className = '', onDark = false }) => (
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
    <Facebook className="w-4 h-4" />
    ทักเพจเพื่อสั่งซื้อ
    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
  </motion.a>
);
