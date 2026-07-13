import React, { useMemo, useState } from 'react';
import {
  Search, X, Image as ImageIcon, Facebook, PackageX, RefreshCw,
  Tent, ArrowRight, Truck, MessageCircle,
} from 'lucide-react';
import {
  motion, AnimatePresence, useReducedMotion, useScroll, useMotionValueEvent,
} from 'motion/react';
import logoImg from '../assets/images/logo_1782269852938.jpg';
import { isSupabaseConfigured } from './supabaseClient';
import { useStorefrontCatalog } from './useStorefrontCatalog';
import { PublicVariant } from './types';

// --- STORE CONTACT CONFIG ---
// TODO: แทนที่ด้วยข้อมูลจริงของร้าน (ลิงก์เพจ Facebook ที่ถูกต้อง)
const STORE = {
  name: 'Buddy Camp',
  tagline: 'อุปกรณ์แคมป์ปิ้งพร้อมส่ง',
  heroLead: 'ของครบ พร้อมออกเดินทาง',
  heroSub: 'เลือกดูสินค้าและราคาล่าสุด เจอที่ถูกใจแล้วทักเพจสั่งได้เลย',
  facebookUrl: 'https://www.facebook.com/buddycampingstore',
};

// Same colour mapping as the ERP catalog (ProductsView.getDynamicColorStyles),
// copied here to keep the storefront fully decoupled from ERP components.
const getDynamicColorStyles = (colorName: string) => {
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

const formatBaht = (value: number) => `฿${value.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;

interface ModelCard {
  modelId: string;
  modelName: string;
  brandId: string;
  brandName: string;
  description?: string;
  image?: string;
  variants: PublicVariant[];
  totalStock: number;
}

/* ── Signature element ────────────────────────────────────────────────────
   Topographic contour lines — a nod to trail maps / terrain, the world these
   products live in. Deterministic paths (no Math.random), drawn as nested
   flowing bands. Reused in the hero and footer as the page's memory hook. */
const contourPath = (baseY: number, amp: number) => {
  const step = 150;
  let d = `M -60 ${baseY}`;
  let up = true;
  for (let x = 0; x <= 1260; x += step) {
    d += ` Q ${x + step / 2} ${baseY + (up ? -amp : amp)} ${x + step} ${baseY}`;
    up = !up;
  }
  return d;
};

const ContourField: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 1200 640"
    preserveAspectRatio="xMidYMid slice"
    className={className}
    aria-hidden="true"
  >
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      {Array.from({ length: 12 }).map((_, i) => (
        <path key={i} d={contourPath(40 + i * 54, 15 + (i % 3) * 8)} opacity={0.3 + (i % 3) * 0.14} />
      ))}
    </g>
  </svg>
);

const FacebookButton: React.FC<{ className?: string; onDark?: boolean }> = ({ className = '', onDark = false }) => (
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

const ProductCard: React.FC<{ card: ModelCard }> = ({ card }) => {
  const reduce = useReducedMotion();

  // Default the selected colour to the first one still in stock, so customers
  // land on something they can actually buy; fall back to the first colour.
  const defaultVariant = card.variants.find(v => v.qty_in_stock > 0) || card.variants[0];
  const [selectedId, setSelectedId] = useState(defaultVariant?.id);
  const selected = card.variants.find(v => v.id === selectedId) || defaultVariant;

  const displayImage = selected?.image || card.image;
  const selectedOut = !selected || selected.qty_in_stock === 0;
  const hasMultipleColors = card.variants.length > 1;

  return (
    <motion.article
      variants={{ hidden: { opacity: 0, y: reduce ? 0 : 22 }, show: { opacity: 1, y: 0 } }}
      whileHover={reduce ? undefined : { y: -6 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="group relative flex flex-col rounded-3xl bg-cream border border-bark/10 overflow-hidden shadow-[0_1px_2px_rgba(54,36,15,0.05)] hover:shadow-[0_18px_40px_-20px_rgba(54,36,15,0.45)] hover:border-bark/15 transition-shadow"
    >
      {/* Image — cross-fades when the customer switches colour */}
      <div className="relative w-full aspect-square bg-panel overflow-hidden">
        {displayImage ? (
          <AnimatePresence initial={false}>
            <motion.img
              key={displayImage}
              src={displayImage}
              alt={`${card.modelName} ${selected?.color || ''}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              initial={{ opacity: 0, scale: reduce ? 1 : 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out ${
                selectedOut ? 'grayscale-[35%] opacity-70' : 'group-hover:scale-[1.05]'
              }`}
            />
          </AnimatePresence>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="w-10 h-10 text-tan" />
          </div>
        )}

        {selectedOut && (
          <span className="absolute top-3 left-3 bg-clay text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
            <PackageX className="w-3 h-3" /> สินค้าหมด
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        {card.brandName && (
          <span className="self-start text-[10px] font-semibold text-copper uppercase tracking-[0.12em]">
            {card.brandName}
          </span>
        )}
        <h3 className="sf-display text-[17px] leading-snug text-bark mt-1">{card.modelName}</h3>
        {card.description && (
          <p className="text-xs text-muted mt-1.5 whitespace-pre-line leading-relaxed line-clamp-2">
            {card.description}
          </p>
        )}

        {/* Selected colour: price + remaining stock */}
        <div className="mt-3 flex items-end justify-between gap-2">
          <span className="text-xl font-bold text-bark tabular-nums">
            {selected && selected.standard_sale_price > 0 ? formatBaht(selected.standard_sale_price) : 'สอบถามราคา'}
          </span>
          {selectedOut ? (
            <span className="text-xs font-semibold text-clay whitespace-nowrap">สินค้าหมด</span>
          ) : (
            <span className="text-xs font-medium text-muted whitespace-nowrap">
              เหลือ <span className="font-bold text-copper">{selected!.qty_in_stock}</span> ชิ้น
            </span>
          )}
        </div>

        {/* Colour selector */}
        <div className="mt-auto border-t border-bark/10 pt-3">
          <p className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
            {hasMultipleColors ? 'เลือกสี' : 'สี'}
            {selected && <span className="normal-case tracking-normal text-bark ml-1.5">· {selected.color}</span>}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {card.variants.map(v => {
              const vOut = v.qty_in_stock === 0;
              const isSelected = v.id === selected?.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                  title={vOut ? `${v.color} (หมด)` : `${v.color} · เหลือ ${v.qty_in_stock} ชิ้น`}
                  aria-pressed={isSelected}
                  className={`relative flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full border text-[11px] font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-transparent text-bark'
                      : 'border-bark/10 text-muted hover:border-tan'
                  } ${vOut ? 'opacity-50' : ''}`}
                >
                  {isSelected && (
                    <motion.span
                      layoutId={`swatch-${card.modelId}`}
                      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                      className="absolute inset-0 rounded-full bg-panel ring-[1.5px] ring-copper"
                    />
                  )}
                  <span className={`relative w-4 h-4 rounded-full shadow-inner shrink-0 ${getDynamicColorStyles(v.color)}`} />
                  <span className="relative truncate max-w-[7rem]">{v.color}</span>
                  <span className={`relative whitespace-nowrap ${vOut ? 'text-clay' : 'text-tan'}`}>
                    {vOut ? 'หมด' : v.qty_in_stock}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.article>
  );
};

export const StorefrontPage: React.FC = () => {
  const { brands, models, variants, loading, error, retry } = useStorefrontCatalog();
  const reduce = useReducedMotion();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('all');

  // Condense the sticky bar (reveal the compact logo) once the hero scrolls away.
  const { scrollY } = useScroll();
  const [condensed, setCondensed] = useState(false);
  useMotionValueEvent(scrollY, 'change', v => setCondensed(v > 180));

  const brandById = useMemo(() => new Map(brands.map(b => [b.id, b])), [brands]);
  const modelById = useMemo(() => new Map(models.map(m => [m.id, m])), [models]);

  // Group variants under their model, resolve brand, and compute stock totals.
  // Cards with zero total stock are pushed to the end so in-stock items lead.
  const modelCards = useMemo<ModelCard[]>(() => {
    const byModel = new Map<string, ModelCard>();
    variants.forEach(v => {
      const model = modelById.get(v.model_id);
      if (!model) return;
      const brand = brandById.get(model.brand_id);
      let card = byModel.get(v.model_id);
      if (!card) {
        card = {
          modelId: model.id,
          modelName: model.name,
          brandId: model.brand_id,
          brandName: brand?.name || '',
          description: model.description,
          image: model.image,
          variants: [],
          totalStock: 0
        };
        byModel.set(v.model_id, card);
      }
      // Prefer a variant image for the card thumbnail when the model has none.
      if (!card.image && v.image) card.image = v.image;
      card.variants.push(v);
      card.totalStock += v.qty_in_stock;
    });

    return Array.from(byModel.values()).sort((a, b) => {
      const aOut = a.totalStock === 0 ? 1 : 0;
      const bOut = b.totalStock === 0 ? 1 : 0;
      if (aOut !== bOut) return aOut - bOut;
      return `${a.brandName} ${a.modelName}`.localeCompare(`${b.brandName} ${b.modelName}`, 'th');
    });
  }, [variants, modelById, brandById]);

  // Only show brand chips for brands that actually have a model with variants.
  const brandsWithProducts = useMemo(() => {
    const ids = new Set(modelCards.map(c => c.brandId));
    return brands.filter(b => ids.has(b.id));
  }, [brands, modelCards]);

  const filteredCards = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return modelCards.filter(card => {
      if (selectedBrandId !== 'all' && card.brandId !== selectedBrandId) return false;
      if (!q) return true;
      return (
        card.modelName.toLowerCase().includes(q) ||
        card.brandName.toLowerCase().includes(q) ||
        (card.description || '').toLowerCase().includes(q) ||
        card.variants.some(v => v.color.toLowerCase().includes(q))
      );
    });
  }, [modelCards, searchQuery, selectedBrandId]);

  const hasFilter = searchQuery.trim() !== '' || selectedBrandId !== 'all';
  const chipBase = 'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border';
  const chipActive = 'bg-bark text-paper border-bark';
  const chipIdle = 'bg-transparent text-muted border-bark/15 hover:border-copper hover:text-bark';

  return (
    <div className="sf min-h-screen">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden text-paper bg-bark">
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(120% 90% at 15% 0%, #4a3316 0%, #36240f 55%, #2a1b0b 100%)' }}
        />
        <motion.div
          className="absolute inset-0 text-tan"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 0.55 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        >
          <ContourField className="w-full h-full" />
        </motion.div>
        {/* soft fade into the toolbar below */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-b from-transparent to-bark/60" />

        <div className="relative max-w-5xl mx-auto px-5 pt-8 pb-12 sm:pt-12 sm:pb-16">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="flex items-center gap-3"
          >
            <div className="w-12 h-12 rounded-2xl overflow-hidden ring-1 ring-white/25 bg-white/10 backdrop-blur shrink-0">
              <img src={logoImg} alt={STORE.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div>
              <p className="sf-display text-xl leading-none text-paper">{STORE.name}</p>
              <p className="text-[11px] text-tan mt-1 flex items-center gap-1">
                <Tent className="w-3 h-3" /> {STORE.tagline}
              </p>
            </div>
          </motion.div>

          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: 'easeOut' }}
            className="sf-display text-3xl sm:text-5xl leading-[1.1] mt-8 max-w-xl"
          >
            {STORE.heroLead}
          </motion.h1>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16, ease: 'easeOut' }}
            className="text-sm sm:text-base text-white/80 mt-3 max-w-md leading-relaxed"
          >
            {STORE.heroSub}
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24, ease: 'easeOut' }}
            className="mt-6 flex flex-wrap items-center gap-3"
          >
            <FacebookButton onDark className="text-sm py-2.5 px-5" />
            <span className="inline-flex items-center gap-1.5 text-xs text-white/70">
              <Truck className="w-3.5 h-3.5 text-tan" /> พร้อมส่ง
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-white/70">
              <MessageCircle className="w-3.5 h-3.5 text-tan" /> ทักถามได้ก่อนสั่ง
            </span>
          </motion.div>
        </div>
      </header>

      {/* ── Sticky toolbar: search + brand filter (compact logo appears on scroll) ── */}
      <div className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md border-b border-bark/10">
        <div className="max-w-5xl mx-auto px-5 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {condensed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-2 shrink-0 overflow-hidden"
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-bark/15 shrink-0">
                    <img src={logoImg} alt={STORE.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <span className="sf-display text-base text-bark whitespace-nowrap hidden sm:block">{STORE.name}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search */}
            <div className="flex-1 flex items-center gap-2 rounded-full bg-cream border border-bark/15 px-4 py-2.5 focus-within:border-copper transition-colors">
              <Search className="w-4 h-4 text-tan shrink-0" />
              <input
                type="text"
                placeholder="ค้นหาสินค้า เช่น ชื่อรุ่น ยี่ห้อ หรือสี…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-sm text-ink outline-hidden w-full bg-transparent placeholder:text-tan"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="ล้างคำค้นหา"
                  className="text-tan hover:text-bark cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <FacebookButton className="hidden md:inline-flex text-xs py-2.5 px-4 shrink-0" />
          </div>

          {/* Brand filter chips */}
          {brandsWithProducts.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 sf-no-scrollbar">
              <button onClick={() => setSelectedBrandId('all')} className={`${chipBase} ${selectedBrandId === 'all' ? chipActive : chipIdle}`}>
                ทั้งหมด
              </button>
              {brandsWithProducts.map(brand => (
                <button
                  key={brand.id}
                  onClick={() => setSelectedBrandId(brand.id)}
                  className={`${chipBase} ${selectedBrandId === brand.id ? chipActive : chipIdle}`}
                >
                  {brand.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Catalog ──────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-5 py-6">
        {!isSupabaseConfigured ? (
          <div className="bg-cream border border-tan/40 rounded-3xl p-8 text-center max-w-md mx-auto space-y-2">
            <h2 className="sf-display text-lg text-bark">ยังไม่ได้ตั้งค่าระบบ</h2>
            <p className="text-sm text-muted">ไม่พบการตั้งค่า Supabase กรุณาติดต่อผู้ดูแลระบบ</p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-cream rounded-3xl border border-bark/10 overflow-hidden">
                <div className="w-full aspect-square sf-shimmer" />
                <div className="p-4 space-y-2.5">
                  <div className="h-2.5 sf-shimmer rounded w-1/3" />
                  <div className="h-4 sf-shimmer rounded w-2/3" />
                  <div className="h-5 sf-shimmer rounded w-1/2 mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-cream border border-clay/30 rounded-3xl p-8 text-center max-w-md mx-auto space-y-3">
            <h2 className="sf-display text-lg text-bark">โหลดข้อมูลสินค้าไม่สำเร็จ</h2>
            <p className="text-sm text-muted">กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง</p>
            <button
              onClick={retry}
              className="inline-flex items-center gap-2 bg-copper hover:bg-bark2 text-white text-sm font-semibold py-2.5 px-5 rounded-full cursor-pointer transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> ลองใหม่
            </button>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="relative bg-bark text-paper rounded-3xl p-10 text-center max-w-md mx-auto overflow-hidden">
            <div className="absolute inset-0 text-tan opacity-40"><ContourField className="w-full h-full" /></div>
            <div className="relative space-y-3">
              <Tent className="w-10 h-10 text-tan mx-auto" />
              <p className="text-white/85">{modelCards.length === 0 ? 'ยังไม่มีสินค้าในร้านตอนนี้' : 'ไม่พบสินค้าตามที่ค้นหา'}</p>
              {modelCards.length > 0 && (
                <button
                  onClick={() => { setSearchQuery(''); setSelectedBrandId('all'); }}
                  className="text-tan hover:text-paper font-semibold text-sm underline underline-offset-4 cursor-pointer"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="sf-eyebrow sf-display text-lg text-bark">
                {selectedBrandId === 'all'
                  ? 'สินค้าทั้งหมด'
                  : brandsWithProducts.find(b => b.id === selectedBrandId)?.name || 'สินค้า'}
              </h2>
              <div className="flex items-center gap-3">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={filteredCards.length}
                    initial={reduce ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2 }}
                    className="text-xs text-muted tabular-nums"
                  >
                    {filteredCards.length} รายการ
                  </motion.span>
                </AnimatePresence>
                {hasFilter && (
                  <button
                    onClick={() => { setSearchQuery(''); setSelectedBrandId('all'); }}
                    className="text-xs font-semibold text-copper hover:text-bark cursor-pointer"
                  >
                    ล้างตัวกรอง
                  </button>
                )}
              </div>
            </div>

            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: reduce ? 0 : 0.05 } } }}
              className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
            >
              {filteredCards.map(card => (
                <ProductCard key={card.modelId} card={card} />
              ))}
            </motion.div>
          </>
        )}
      </main>

      {/* ── Contact footer ───────────────────────────────────────────────── */}
      <footer className="relative overflow-hidden bg-bark text-paper mt-10">
        <div className="absolute inset-0 text-tan opacity-40"><ContourField className="w-full h-full" /></div>
        <div className="relative max-w-5xl mx-auto px-5 py-12 text-center space-y-4">
          <h2 className="sf-display text-2xl sm:text-3xl">สนใจสั่งซื้อ ทักเราได้เลย</h2>
          <p className="text-sm text-white/70 max-w-sm mx-auto leading-relaxed">
            ตอนนี้ยังสั่งซื้อผ่านเว็บไม่ได้ — ทักเข้ามาที่เพจ เดี๋ยวเราช่วยจัดของและสรุปยอดให้
          </p>
          <div className="pt-1">
            <FacebookButton onDark className="text-sm py-3 px-6" />
          </div>
          <p className="text-[11px] text-tan pt-4">© {STORE.name}</p>
        </div>
      </footer>
    </div>
  );
};
