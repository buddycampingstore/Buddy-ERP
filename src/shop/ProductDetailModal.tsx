import React, { useEffect, useRef, useState } from 'react';
import { X, Image as ImageIcon, PackageX } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { FacebookButton, formatBaht, colorHex, tintFor, stockBadge } from './shared';
import { ModelCard } from './types';

/* Product detail sheet: slides up from the bottom of the 440px column and
   keeps the CTA pinned below the scroll area, so "ทักเพจ" is reachable no
   matter how long the description runs. Closes via the X button, backdrop
   click, Escape, or browser back (hash-driven — the parent owns open/close
   state and history). */
export const ProductDetailModal: React.FC<{
  card: ModelCard;
  initialVariantId?: string;
  onClose: () => void;
}> = ({ card, initialVariantId, onClose }) => {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Start from the colour the customer had selected on the card; otherwise
  // the first colour still in stock, matching the card's own default.
  const fallback = card.variants.find(v => v.qty_in_stock > 0) || card.variants[0];
  const initial = card.variants.find(v => v.id === initialVariantId) || fallback;
  const [selectedId, setSelectedId] = useState(initial?.id);
  const selected = card.variants.find(v => v.id === selectedId) || fallback;

  const displayImage = selected?.image || card.image;
  const selectedOut = !selected || selected.qty_in_stock === 0;
  const badge = stockBadge(card.totalStock, selectedOut);

  // Focus the close button on open, restore focus on close; Escape closes;
  // lock body scroll while the sheet is up.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={card.modelName}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#2a1b0b]/60 backdrop-blur-[3px]"
      />

      <motion.div
        initial={reduce ? { opacity: 0 } : { y: '100%' }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        exit={reduce ? { opacity: 0 } : { y: '100%' }}
        transition={reduce ? { duration: 0.15 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex w-full max-w-[440px] max-h-[94dvh] flex-col overflow-hidden rounded-t-[28px] bg-paper shadow-2xl"
      >
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Image — cross-fades when switching colour, over a tinted backdrop */}
          <div className="relative w-full aspect-[50/39] bg-panel">
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
                  referrerPolicy="no-referrer"
                  initial={{ opacity: 0, scale: reduce ? 1 : 1.03 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className={`absolute inset-0 w-full h-full object-cover ${selectedOut ? 'grayscale-[35%] opacity-70' : ''}`}
                />
              </AnimatePresence>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-ink/35">
                <ImageIcon className="w-8 h-8" />
                <span className="text-xs tracking-[0.08em]">รูปสินค้า</span>
              </div>
            )}

            <span
              className={`absolute top-3.5 left-3.5 inline-flex items-center gap-1.5 h-[30px] px-3.5 rounded-full text-[13px] font-bold shadow-[0_2px_8px_rgba(54,36,15,0.18)] ${badge.className}`}
            >
              {badge.soldOut && <PackageX className="w-3.5 h-3.5" />}
              {badge.label}
            </span>

            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่างรายละเอียดสินค้า"
              className="absolute top-3.5 right-3.5 grid h-11 w-11 place-items-center rounded-full border border-bark/12 bg-paper/92 text-bark backdrop-blur hover:bg-paper hover:border-bark/25 cursor-pointer transition-colors"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>

          <div className="px-5 pt-5 pb-6">
            {card.brandName && (
              <p className="text-xs font-bold text-copper uppercase tracking-[0.12em]">{card.brandName}</p>
            )}
            <h2 className="sf-display mt-1.5 text-[26px] leading-[1.35] text-bark">{card.modelName}</h2>

            <div className="mt-3.5 flex items-end gap-3">
              <span className="text-[34px] font-bold leading-none text-bark tabular-nums">
                {selected && selected.standard_sale_price > 0 ? formatBaht(selected.standard_sale_price) : 'สอบถามราคา'}
              </span>
              <span className={`pb-1 text-sm ${selectedOut ? 'text-clay' : 'text-stone'}`}>
                {selectedOut ? 'สีนี้หมดชั่วคราว' : `เหลือ ${selected!.qty_in_stock} ชิ้น`}
              </span>
            </div>

            {card.description && (
              <p className="mt-4 text-[15px] leading-[1.75] text-bister whitespace-pre-line text-pretty">
                {card.description}
              </p>
            )}

            {/* Colour selector — full-width rows here (not the card's pill
                rail) so every colour shows its own price and stock. */}
            <div className="mt-5 border-t border-bark/10 pt-4">
              <p className="mb-2.5 text-sm text-muted">
                {card.variants.length > 1 ? 'เลือกสี' : 'สี'}
                {selected && <> — <span className="font-bold text-bark">{selected.color}</span></>}
              </p>
              <div className="flex flex-col gap-2">
                {card.variants.map(v => {
                  const vOut = v.qty_in_stock === 0;
                  const isSelected = v.id === selected?.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedId(v.id)}
                      aria-pressed={isSelected}
                      className={`flex h-[58px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left text-[15px] font-medium cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-shell border-copper text-bark'
                          : 'bg-paper border-bark/12 text-bister hover:border-tan'
                      } ${vOut ? 'opacity-55' : ''}`}
                    >
                      <span
                        className="h-[30px] w-[30px] shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]"
                        style={{ background: colorHex(v.color) }}
                      />
                      <span className="flex-1 truncate">{v.color}</span>
                      <span className="font-bold text-bark tabular-nums">
                        {v.standard_sale_price > 0 ? formatBaht(v.standard_sale_price) : 'สอบถาม'}
                      </span>
                      <span className={`text-[13px] whitespace-nowrap ${vOut ? 'text-clay' : 'text-stone'}`}>
                        {vOut ? 'หมด' : `เหลือ ${v.qty_in_stock}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Pinned CTA */}
        <div className="border-t border-bark/10 bg-paper px-5 pt-3.5 pb-5">
          <FacebookButton
            className="h-14 w-full text-[17px]"
            muted={selectedOut}
            label={selectedOut ? 'ถามสีอื่น' : 'ทักเพจสั่งสีนี้'}
          />
          <p className="mt-2.5 text-center text-[13px] leading-[1.6] text-muted">
            แจ้งรุ่นกับสีที่เลือกไว้ให้เราได้เลย เดี๋ยวเช็กของแล้วสรุปยอดให้
          </p>
        </div>
      </motion.div>
    </div>
  );
};
