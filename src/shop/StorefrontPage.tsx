import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, RefreshCw, Tent, Truck, MessageCircle, Heart } from 'lucide-react';
import {
  motion, AnimatePresence, useReducedMotion, useScroll, useMotionValueEvent,
} from 'motion/react';
import logoImg from '../assets/images/logo_1782269852938.jpg';
import { isSupabaseConfigured } from './supabaseClient';
import { useStorefrontCatalog } from './useStorefrontCatalog';
import { useFavorites } from './useFavorites';
import { ModelCard } from './types';
import { STORE, FacebookButton, chipClass } from './shared';
import { ContourField, ScrollProgress, TrustMarquee, ScrollTopButton, Toast } from './chrome';
import { ProductCard } from './ProductCard';
import { ProductDetailModal } from './ProductDetailModal';

// Detail-view deep link: shop.html#p=<modelId>
const hashModelId = () => {
  const m = window.location.hash.match(/^#p=(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
};

export const StorefrontPage: React.FC = () => {
  const { brands, models, variants, loading, error, retry } = useStorefrontCatalog();
  const reduce = useReducedMotion();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('all');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [detail, setDetail] = useState<{ modelId: string; variantId?: string } | null>(null);
  const { favorites, toggle: toggleFavorite, isFavorite } = useFavorites();

  // Transient confirmations for actions with no other visible result.
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number>(0);
  const flash = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2200);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const onToggleFavorite = useCallback((modelId: string) => {
    flash(toggleFavorite(modelId) ? 'เพิ่มในรายการโปรดแล้ว' : 'เอาออกจากรายการโปรดแล้ว');
  }, [toggleFavorite, flash]);

  // Condense the sticky bar (reveal the compact logo) once the hero scrolls
  // away, and offer a way back up once the catalog is deep.
  const { scrollY } = useScroll();
  const [condensed, setCondensed] = useState(false);
  const [showTop, setShowTop] = useState(false);
  useMotionValueEvent(scrollY, 'change', v => {
    setCondensed(v > 180);
    setShowTop(v > 700);
  });

  // Opening pushes a #p=<modelId> history entry so the browser back button
  // closes the detail view and product links are shareable.
  const openDetail = useCallback((modelId: string, variantId?: string) => {
    setDetail({ modelId, variantId });
    if (hashModelId() !== modelId) {
      history.pushState(null, '', `#p=${encodeURIComponent(modelId)}`);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setDetail(null);
    // Drop the #p= entry we pushed so "back" afterwards leaves the page,
    // not reopens the modal.
    if (hashModelId()) history.back();
  }, []);

  // Browser back/forward drives the modal state.
  useEffect(() => {
    const onPop = () => {
      const id = hashModelId();
      if (!id) setDetail(null);
      else setDetail(d => (d?.modelId === id ? d : { modelId: id }));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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

  // Shared links: once the catalog is loaded, honour a #p=<modelId> hash that
  // was present on page load.
  useEffect(() => {
    if (loading) return;
    const id = hashModelId();
    if (id && modelCards.some(c => c.modelId === id)) {
      setDetail(d => d || { modelId: id });
    }
  }, [loading, modelCards]);

  // Only show brand chips for brands that actually have a model with variants.
  const brandsWithProducts = useMemo(() => {
    const ids = new Set(modelCards.map(c => c.brandId));
    return brands.filter(b => ids.has(b.id));
  }, [brands, modelCards]);

  const filteredCards = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return modelCards.filter(card => {
      if (selectedBrandId !== 'all' && card.brandId !== selectedBrandId) return false;
      if (inStockOnly && card.totalStock === 0) return false;
      if (favOnly && !favorites.includes(card.modelId)) return false;
      if (!q) return true;
      return (
        card.modelName.toLowerCase().includes(q) ||
        card.brandName.toLowerCase().includes(q) ||
        (card.description || '').toLowerCase().includes(q) ||
        card.variants.some(v => v.color.toLowerCase().includes(q))
      );
    });
  }, [modelCards, searchQuery, selectedBrandId, inStockOnly, favOnly, favorites]);

  const detailCard = detail ? modelCards.find(c => c.modelId === detail.modelId) : undefined;

  const hasFilter = searchQuery.trim() !== '' || selectedBrandId !== 'all' || inStockOnly || favOnly;
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedBrandId('all');
    setInStockOnly(false);
    setFavOnly(false);
  }, []);

  const gridClass = 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(46%,250px),1fr))]';

  return (
    <div className="sf min-h-screen">
      <ScrollProgress />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden text-paper bg-bark">
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(130% 100% at 12% 0%, #55391a 0%, #36240f 52%, #251808 100%)' }}
        />
        <motion.div
          className="absolute inset-0 text-dune"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 0.55 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        >
          <ContourField height={620} lines={7} className="w-full h-full" />
        </motion.div>
        {/* soft fade into the marquee below */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-b from-transparent to-bark/85" />

        <div className="relative max-w-5xl mx-auto px-5 pt-7 pb-14 sm:pt-8 sm:pb-16">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="flex items-center gap-3"
          >
            <div className="w-13 h-13 rounded-[18px] overflow-hidden ring-1 ring-white/25 bg-white/10 backdrop-blur shrink-0">
              <img src={logoImg} alt={STORE.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div>
              <p className="sf-display text-[21px] leading-none text-paper">{STORE.name}</p>
              <p className="text-[11.5px] text-sand mt-1.5 flex items-center gap-1">
                <Tent className="w-3 h-3 shrink-0" /> {STORE.tagline}
              </p>
            </div>
          </motion.div>

          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: 'easeOut' }}
            className="sf-display text-3xl sm:text-5xl leading-[1.15] mt-10 max-w-[15ch] text-pretty"
          >
            {STORE.heroLead}
          </motion.h1>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16, ease: 'easeOut' }}
            className="text-sm sm:text-[17px] text-white/78 mt-3.5 max-w-[42ch] leading-[1.75]"
          >
            {STORE.heroSub}
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24, ease: 'easeOut' }}
            className="mt-6.5 flex flex-wrap items-center gap-3"
          >
            <FacebookButton onDark className="text-[15px] min-h-11.5 py-3 px-6 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)]" />
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-white/72 px-3.5 py-2 rounded-full bg-white/7 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
              <span className="w-1.5 h-1.5 rounded-full bg-moss shadow-[0_0_0_3px_rgba(143,191,90,0.25)]" />
              <Truck className="w-3.5 h-3.5 text-sand" /> พร้อมส่งใน 1–2 วัน
            </span>
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-white/72 px-3.5 py-2 rounded-full bg-white/7 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
              <MessageCircle className="w-3.5 h-3.5 text-sand" /> ทักถามได้ก่อนสั่ง
            </span>
          </motion.div>
        </div>
      </header>

      <TrustMarquee />

      {/* ── Sticky toolbar: search + filters (compact logo appears on scroll) ── */}
      <div className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md border-b border-bark/10">
        <div className="max-w-5xl mx-auto px-5 py-3 space-y-3">
          <div className="flex items-center gap-2.5">
            <AnimatePresence>
              {condensed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-2 shrink-0 overflow-hidden"
                >
                  <div className="w-8.5 h-8.5 rounded-xl overflow-hidden ring-1 ring-bark/15 shrink-0">
                    <img src={logoImg} alt={STORE.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <span className="sf-display text-base text-bark whitespace-nowrap hidden sm:block">{STORE.name}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search */}
            <div className="flex-1 flex items-center gap-2 min-h-11.5 rounded-full bg-cream border border-bark/14 px-4 focus-within:border-copper transition-colors">
              <Search className="w-4 h-4 text-tan shrink-0" />
              <input
                type="text"
                placeholder="ค้นหา เช่น เต็นท์ เก้าอี้ หรือสี…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-sm text-ink outline-hidden w-full bg-transparent placeholder:text-tan py-3"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="ล้างคำค้นหา"
                  className="w-6.5 h-6.5 rounded-full bg-bark/8 text-muted hover:bg-bark/15 hover:text-bark flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <FacebookButton className="hidden md:inline-flex text-xs py-2.5 px-4 shrink-0" />
          </div>

          {/* Brand filter + stock / favourites toggles */}
          <div className="flex flex-wrap items-center gap-2">
            {brandsWithProducts.length > 0 && (
              <>
                <button onClick={() => setSelectedBrandId('all')} className={chipClass(selectedBrandId === 'all')}>
                  ทั้งหมด
                </button>
                {brandsWithProducts.map(brand => (
                  <button
                    key={brand.id}
                    onClick={() => setSelectedBrandId(brand.id)}
                    className={chipClass(selectedBrandId === brand.id)}
                  >
                    {brand.name}
                  </button>
                ))}
              </>
            )}

            <span className="flex-1 min-w-2" />

            <button
              onClick={() => setInStockOnly(v => !v)}
              aria-pressed={inStockOnly}
              className={chipClass(inStockOnly)}
            >
              <span
                className={`w-1.75 h-1.75 rounded-full transition-[background-color,box-shadow] ${
                  inStockOnly ? 'bg-moss shadow-[0_0_0_3px_rgba(143,191,90,0.28)]' : 'bg-tan/60'
                }`}
              />
              มีของพร้อมส่ง
            </button>
            <button
              onClick={() => setFavOnly(v => !v)}
              aria-pressed={favOnly}
              className={chipClass(favOnly)}
            >
              <Heart className="w-3.5 h-3.5" fill={favOnly ? 'currentColor' : 'none'} />
              รายการโปรด{favorites.length > 0 && ` (${favorites.length})`}
            </button>
          </div>
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
          <div className={gridClass}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-cream rounded-3xl border border-bark/10 overflow-hidden">
                <div className="w-full aspect-square sf-shimmer" />
                <div className="p-4 space-y-2.5">
                  <div className="h-2.5 sf-shimmer rounded w-1/3" />
                  <div className="h-4 sf-shimmer rounded w-2/3" />
                  <div className="h-5 sf-shimmer rounded w-1/2 mt-3" />
                  <div className="h-[5px] sf-shimmer rounded-full" />
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
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2.5 mb-4">
              <h2 className="sf-eyebrow sf-display text-xl text-bark">
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
                    className="text-[12.5px] text-muted tabular-nums"
                  >
                    {filteredCards.length} รายการ
                  </motion.span>
                </AnimatePresence>
                {hasFilter && (
                  <button
                    onClick={clearFilters}
                    className="text-[12.5px] font-semibold text-copper hover:text-bark cursor-pointer py-1.5"
                  >
                    ล้างตัวกรอง
                  </button>
                )}
              </div>
            </div>

            {filteredCards.length === 0 ? (
              <div className="relative bg-bark text-paper rounded-[26px] p-10 text-center max-w-md mx-auto my-8 overflow-hidden">
                <div className="absolute inset-0 text-dune opacity-40">
                  <ContourField height={320} lines={4} className="w-full h-full" />
                </div>
                <div className="relative flex flex-col items-center gap-3">
                  <div className="w-11.5 h-11.5 rounded-full bg-white/10 flex items-center justify-center sf-bob">
                    <Tent className="w-5.5 h-5.5 text-sand" />
                  </div>
                  <p className="text-[15px] text-white/85">
                    {modelCards.length === 0 ? 'ยังไม่มีสินค้าในร้านตอนนี้' : 'ไม่พบสินค้าตามที่เลือก ลองล้างตัวกรองดูนะ'}
                  </p>
                  {hasFilter && (
                    <button
                      onClick={clearFilters}
                      className="bg-paper text-bark text-sm font-semibold min-h-11 px-5.5 rounded-full cursor-pointer transition-transform hover:-translate-y-0.5"
                    >
                      ล้างตัวกรอง
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <motion.div
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: reduce ? 0 : 0.04 } } }}
                className={gridClass}
              >
                {filteredCards.map(card => (
                  <ProductCard
                    key={card.modelId}
                    card={card}
                    isFavorite={isFavorite(card.modelId)}
                    onToggleFavorite={onToggleFavorite}
                    onOpenDetail={openDetail}
                  />
                ))}
              </motion.div>
            )}
          </>
        )}
      </main>

      {/* ── Contact footer ───────────────────────────────────────────────── */}
      <footer className="relative overflow-hidden bg-bark text-paper mt-13">
        <div className="absolute inset-0 text-dune opacity-35">
          <ContourField height={320} lines={4} className="w-full h-full" />
        </div>
        <div className="relative max-w-xl mx-auto px-5 py-14 text-center flex flex-col items-center gap-4">
          <h2 className="sf-display text-2xl sm:text-[32px]">สนใจสั่งซื้อ ทักเราได้เลย</h2>
          <p className="text-sm text-white/72 max-w-[34ch] leading-[1.8]">
            ตอนนี้ยังสั่งซื้อผ่านเว็บไม่ได้ — ทักเข้ามาที่เพจ เดี๋ยวเราช่วยจัดของและสรุปยอดให้
          </p>
          <FacebookButton onDark className="text-[15px] min-h-11.5 py-3.5 px-6.5" />
          <p className="text-[11.5px] text-dune pt-3">© {STORE.name}</p>
        </div>
      </footer>

      <ScrollTopButton show={showTop} onClick={() => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })} />
      <Toast message={toast} />

      {/* ── Product detail modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {detail && detailCard && (
          <ProductDetailModal
            key={detailCard.modelId}
            card={detailCard}
            initialVariantId={detail.variantId}
            onClose={closeDetail}
            onToast={flash}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
