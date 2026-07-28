import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, X, Image as ImageIcon, PackageX, RefreshCw,
  Tent, Truck, MessageCircle,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import logoImg from '../assets/images/logo_1782269852938.jpg';
import { isSupabaseConfigured } from './supabaseClient';
import { useStorefrontCatalog } from './useStorefrontCatalog';
import { ModelCard } from './types';
import {
  STORE, FacebookButton, formatBaht, colorHex, tintFor, stockBadge,
} from './shared';
import { ProductDetailModal } from './ProductDetailModal';

/* ── Layout note ───────────────────────────────────────────────────────────
   The shop is one 440px paper column centred on a sand surround. Nearly all
   traffic arrives from the Facebook page on a phone, so the phone width *is*
   the design: full-bleed cards, 46–56px touch targets, one product per row,
   and no second breakpoint to keep in sync. */

const ProductCard: React.FC<{
  card: ModelCard;
  onOpenDetail: (modelId: string, variantId?: string) => void;
}> = ({ card, onOpenDetail }) => {
  const reduce = useReducedMotion();

  // Default the selected colour to the first one still in stock, so customers
  // land on something they can actually buy; fall back to the first colour.
  const defaultVariant = card.variants.find(v => v.qty_in_stock > 0) || card.variants[0];
  const [selectedId, setSelectedId] = useState(defaultVariant?.id);
  const selected = card.variants.find(v => v.id === selectedId) || defaultVariant;

  const displayImage = selected?.image || card.image;
  const selectedOut = !selected || selected.qty_in_stock === 0;
  const badge = stockBadge(card.totalStock, selectedOut);

  const openDetail = () => onOpenDetail(card.modelId, selected?.id);

  return (
    <motion.article
      variants={{ hidden: { opacity: 0, y: reduce ? 0 : 14 }, show: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="rounded-[26px] bg-paper border border-bark/10 overflow-hidden shadow-[0_2px_4px_rgba(54,36,15,0.05),0_18px_34px_-26px_rgba(54,36,15,0.4)]"
    >
      {/* Image — opens the detail sheet; the tinted backdrop tracks the
          selected colour, so switching colour shifts the whole frame even
          for products that have no photo yet. */}
      <button
        type="button"
        onClick={openDetail}
        aria-label={`ดูรายละเอียด ${card.modelName}`}
        className="group block w-full cursor-pointer bg-panel"
      >
        <div className="relative w-full aspect-[25/18] overflow-hidden">
          <div
            className="absolute inset-0 transition-[background] duration-[350ms] ease-out"
            style={{ background: tintFor(selected?.color || '') }}
          />
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
                className={`absolute inset-0 w-full h-full object-cover ${
                  selectedOut
                    ? 'grayscale-[35%] opacity-70'
                    : 'transition-transform duration-500 ease-out group-hover:scale-[1.04]'
                }`}
              />
            </AnimatePresence>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-ink/35">
              <ImageIcon className="w-7 h-7" />
              <span className="text-xs tracking-[0.08em]">รูปสินค้า</span>
            </div>
          )}

          <span
            className={`absolute top-3.5 left-3.5 inline-flex items-center gap-1.5 h-[30px] px-3.5 rounded-full text-[13px] font-bold shadow-[0_2px_8px_rgba(54,36,15,0.18)] ${badge.className}`}
          >
            {badge.soldOut && <PackageX className="w-3.5 h-3.5" />}
            {badge.label}
          </span>
        </div>
      </button>

      {/* Body */}
      <div className="px-[18px] pt-[18px] pb-4">
        {card.brandName && (
          <p className="text-xs font-bold text-copper uppercase tracking-[0.12em]">{card.brandName}</p>
        )}
        <h3 className="mt-1.5">
          <button
            type="button"
            onClick={openDetail}
            className="sf-display text-[22px] leading-[1.35] text-bark text-left hover:text-copper transition-colors cursor-pointer"
          >
            {card.modelName}
          </button>
        </h3>
        {card.description && (
          <p className="mt-2 text-sm leading-[1.65] text-muted whitespace-pre-line line-clamp-2 text-pretty">
            {card.description}
          </p>
        )}

        {/* Selected colour: price + remaining stock */}
        <div className="mt-3.5 flex items-end justify-between gap-3">
          <span className="text-[30px] font-bold leading-none text-bark tabular-nums">
            {selected && selected.standard_sale_price > 0 ? formatBaht(selected.standard_sale_price) : 'สอบถามราคา'}
          </span>
          <span className={`pb-0.5 text-[13px] whitespace-nowrap ${selectedOut ? 'text-clay' : 'text-stone'}`}>
            {selectedOut ? 'สีนี้หมดชั่วคราว' : `เหลือ ${selected!.qty_in_stock} ชิ้น`}
          </span>
        </div>

        {/* Colour selector — a scrollable rail of full-name pills, so the
            colour and its remaining count are both readable at a glance. */}
        <div className="mt-4 border-t border-bark/10 pt-3.5">
          <p className="mb-2.5 text-[13px] text-muted">
            {card.variants.length > 1 ? 'เลือกสี' : 'สี'}
            {selected && <> — <span className="font-bold text-bark">{selected.color}</span></>}
          </p>
          <div className="sf-no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
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
                  className={`shrink-0 inline-flex items-center gap-2.5 h-[46px] pl-2 pr-4 rounded-full border-2 text-sm font-medium cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-shell border-copper text-bark'
                      : 'bg-paper border-bark/12 text-bister hover:border-tan'
                  } ${vOut ? 'opacity-55' : ''}`}
                >
                  <span
                    className="w-[26px] h-[26px] rounded-full shrink-0 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]"
                    style={{ background: colorHex(v.color) }}
                  />
                  <span className="whitespace-nowrap">{v.color}</span>
                  <span className={`text-xs whitespace-nowrap ${vOut ? 'text-clay' : 'text-stone'}`}>
                    {vOut ? 'หมด' : v.qty_in_stock}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CTA row — ordering happens in Facebook chat, so the page button is
            the primary action and "รายละเอียด" sits beside it. */}
        <div className="mt-4 flex gap-2.5">
          <FacebookButton
            className="flex-1 h-[52px] text-base"
            muted={selectedOut}
            label={selectedOut ? 'ถามสีอื่น' : 'ทักเพจสั่งสีนี้'}
          />
          <button
            type="button"
            onClick={openDetail}
            className="shrink-0 h-[52px] px-4.5 rounded-full bg-cream border-[1.5px] border-bark/15 text-[15px] font-semibold text-bark hover:border-copper cursor-pointer transition-colors"
          >
            รายละเอียด
          </button>
        </div>
      </div>
    </motion.article>
  );
};

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
  const [detail, setDetail] = useState<{ modelId: string; variantId?: string } | null>(null);

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
      if (!q) return true;
      return (
        card.modelName.toLowerCase().includes(q) ||
        card.brandName.toLowerCase().includes(q) ||
        (card.description || '').toLowerCase().includes(q) ||
        card.variants.some(v => v.color.toLowerCase().includes(q))
      );
    });
  }, [modelCards, searchQuery, selectedBrandId]);

  const detailCard = detail ? modelCards.find(c => c.modelId === detail.modelId) : undefined;

  const hasFilter = searchQuery.trim() !== '' || selectedBrandId !== 'all';
  const clearFilters = () => { setSearchQuery(''); setSelectedBrandId('all'); };

  const chipBase = 'shrink-0 h-10 px-4 rounded-full border-[1.5px] text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer';
  const chipActive = 'bg-bark text-paper border-bark';
  const chipIdle = 'bg-transparent text-muted border-bark/15 hover:border-copper hover:text-bark';

  // Everything except the card list shares this shape: a full-width notice
  // card in the column, matching the product cards' radius.
  const notice = 'rounded-[26px] border p-8 text-center';

  return (
    <div className="sf min-h-screen flex justify-center">
      <div className="relative w-full max-w-[440px] min-h-screen bg-paper shadow-[0_0_60px_rgba(54,36,15,0.18)]">
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <header
          className="relative overflow-hidden px-5 pt-5 pb-6.5 text-paper"
          style={{ background: 'radial-gradient(130% 100% at 15% 0%, #4a3316 0%, #36240f 60%, #2a1b0b 100%)' }}
        >
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="flex items-center gap-3"
          >
            <div className="w-[46px] h-[46px] shrink-0 rounded-[14px] overflow-hidden bg-white/12 ring-1 ring-white/25">
              <img src={logoImg} alt={STORE.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div>
              <p className="sf-display text-xl leading-[1.1]">{STORE.name}</p>
              <p className="mt-1 text-[13px] text-dune">{STORE.tagline}</p>
            </div>
          </motion.div>

          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: 'easeOut' }}
            className="sf-display mt-5.5 max-w-[300px] text-[30px] leading-[1.25] text-pretty"
          >
            {STORE.heroLead}
          </motion.h1>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16, ease: 'easeOut' }}
            className="mt-2.5 max-w-[320px] text-[15px] leading-[1.6] text-white/80"
          >
            {STORE.heroSub}
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24, ease: 'easeOut' }}
            className="mt-4.5 flex flex-wrap gap-2.5 text-[13px] text-white/75"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5">
              <Truck className="w-3.5 h-3.5 text-dune" /> ส่งไว 1–2 วัน
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-dune" /> ทักถามได้ก่อนสั่ง
            </span>
          </motion.div>
        </header>

        {/* ── Sticky toolbar: search + brand filter ──────────────────────── */}
        <div className="sticky top-0 z-30 border-b border-bark/10 bg-paper/95 px-4 pt-3 pb-2.5 backdrop-blur-md">
          <div className="flex h-[52px] items-center gap-2.5 rounded-full border-[1.5px] border-bark/15 bg-cream px-4 focus-within:border-copper transition-colors">
            <Search className="w-[18px] h-[18px] shrink-0 text-tan" />
            <input
              type="text"
              placeholder="ค้นหารุ่น ยี่ห้อ หรือสี"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="ค้นหาสินค้า"
              className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-hidden placeholder:text-tan"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="ล้างคำค้นหา"
                className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-bark/8 text-muted hover:bg-bark/15 hover:text-bark cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {brandsWithProducts.length > 0 && (
            <div className="sf-no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-0.5">
              <button
                onClick={() => setSelectedBrandId('all')}
                aria-pressed={selectedBrandId === 'all'}
                className={`${chipBase} ${selectedBrandId === 'all' ? chipActive : chipIdle}`}
              >
                ทั้งหมด
              </button>
              {brandsWithProducts.map(brand => (
                <button
                  key={brand.id}
                  onClick={() => setSelectedBrandId(brand.id)}
                  aria-pressed={selectedBrandId === brand.id}
                  className={`${chipBase} ${selectedBrandId === brand.id ? chipActive : chipIdle}`}
                >
                  {brand.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Catalog ────────────────────────────────────────────────────── */}
        <main className="px-4 pt-4 pb-7">
          {!isSupabaseConfigured ? (
            <div className={`${notice} border-tan/40 bg-cream`}>
              <h2 className="sf-display text-lg text-bark">ยังไม่ได้ตั้งค่าระบบ</h2>
              <p className="mt-2 text-sm text-muted">ไม่พบการตั้งค่า Supabase กรุณาติดต่อผู้ดูแลระบบ</p>
            </div>
          ) : loading ? (
            <div className="flex flex-col gap-[18px]">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-[26px] border border-bark/10 bg-paper">
                  <div className="w-full aspect-[25/18] sf-shimmer" />
                  <div className="space-y-3 p-[18px]">
                    <div className="h-2.5 w-1/4 rounded sf-shimmer" />
                    <div className="h-5 w-2/3 rounded sf-shimmer" />
                    <div className="h-7 w-1/3 rounded sf-shimmer" />
                    <div className="h-[46px] w-3/5 rounded-full sf-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className={`${notice} border-clay/30 bg-cream`}>
              <h2 className="sf-display text-lg text-bark">โหลดข้อมูลสินค้าไม่สำเร็จ</h2>
              <p className="mt-2 text-sm text-muted">กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง</p>
              <button
                onClick={retry}
                className="mt-4 inline-flex h-12 items-center gap-2 rounded-full bg-copper px-5 text-sm font-bold text-white hover:bg-bark2 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> ลองใหม่
              </button>
            </div>
          ) : (
            <>
              <div className="mx-0.5 mt-1 mb-3.5 flex items-baseline justify-between gap-3">
                <h2 className="sf-display text-[19px] text-bark">
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
                      className="text-[13px] text-muted tabular-nums"
                    >
                      {filteredCards.length} รายการ
                    </motion.span>
                  </AnimatePresence>
                  {hasFilter && (
                    <button
                      onClick={clearFilters}
                      className="text-[13px] font-bold text-copper underline underline-offset-[3px] hover:text-bark cursor-pointer"
                    >
                      ล้างตัวกรอง
                    </button>
                  )}
                </div>
              </div>

              {filteredCards.length === 0 ? (
                <div className="rounded-[26px] bg-bark px-6 py-9 text-center text-paper">
                  <Tent className="mx-auto w-9 h-9 text-dune" />
                  <p className="mt-3 text-base leading-[1.6] text-white/85">
                    {modelCards.length === 0
                      ? 'ยังไม่มีสินค้าในร้านตอนนี้ ทักเพจมาถามได้เลย'
                      : 'ไม่เจอสินค้าที่ค้นหา ลองคำอื่น หรือดูสินค้าทั้งหมดก็ได้'}
                  </p>
                  {modelCards.length > 0 && (
                    <button
                      onClick={clearFilters}
                      className="mt-4 h-12 rounded-full bg-paper px-5.5 text-[15px] font-bold text-bark hover:bg-white cursor-pointer transition-colors"
                    >
                      ดูสินค้าทั้งหมด
                    </button>
                  )}
                </div>
              ) : (
                <motion.div
                  initial="hidden"
                  animate="show"
                  variants={{ show: { transition: { staggerChildren: reduce ? 0 : 0.05 } } }}
                  className="flex flex-col gap-[18px]"
                >
                  {filteredCards.map(card => (
                    <ProductCard key={card.modelId} card={card} onOpenDetail={openDetail} />
                  ))}
                </motion.div>
              )}
            </>
          )}
        </main>

        {/* ── Contact footer ─────────────────────────────────────────────── */}
        <footer
          className="px-6 pt-8.5 pb-10 text-center text-paper"
          style={{ background: 'radial-gradient(120% 100% at 20% 0%, #432e13 0%, #36240f 60%, #2a1b0b 100%)' }}
        >
          <h2 className="sf-display text-2xl leading-[1.35]">สนใจรุ่นไหน ทักมาเลย</h2>
          <p className="mx-auto mt-2.5 max-w-[300px] text-sm leading-[1.7] text-white/72">
            ยังสั่งผ่านเว็บไม่ได้นะ ทักเข้าเพจมา เดี๋ยวเราช่วยจัดของและสรุปยอดให้
          </p>
          <FacebookButton
            onDark
            className="mt-4.5 h-[54px] px-6.5 text-base"
            label={`ทักเพจ ${STORE.name}`}
          />
          <p className="mt-5.5 text-xs text-[#b9986f]">© {STORE.name}</p>
        </footer>

        {/* ── Product detail sheet ───────────────────────────────────────── */}
        <AnimatePresence>
          {detail && detailCard && (
            <ProductDetailModal
              key={detailCard.modelId}
              card={detailCard}
              initialVariantId={detail.variantId}
              onClose={closeDetail}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
