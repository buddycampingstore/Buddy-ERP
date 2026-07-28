import React, { useEffect, useRef, useState } from 'react';
import { X, Image as ImageIcon, PackageX, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { FacebookButton, formatBaht, getDynamicColorStyles } from './shared';
import { ModelCard } from './types';

/* Product detail overlay: bottom sheet on mobile, centred two-column dialog
   on ≥sm. Closes via the X button, backdrop click, Escape, or browser back
   (hash-driven — the parent owns open/close state and history). */
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
  const pricesVary = new Set(card.variants.map(v => v.standard_sale_price)).size > 1;

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

  // Mobile gets a slide-up sheet, desktop a gentle scale-in; reduced motion
  // collapses both to a plain fade.
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;
  const panelMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : isDesktop
      ? {
          initial: { opacity: 0, scale: 0.96, y: 16 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.97, y: 10 },
        }
      : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6"
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
        className="absolute inset-0 bg-bark/60 backdrop-blur-sm"
      />

      <motion.div
        {...panelMotion}
        transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 380, damping: 34 }}
        className="relative w-full sm:max-w-3xl bg-paper rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] sm:max-h-[85vh] flex flex-col"
      >
        {/* Grab handle (mobile sheet affordance) */}
        <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-bark/15 z-10" />

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="ปิดหน้าต่างรายละเอียดสินค้า"
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-paper/85 backdrop-blur border border-bark/10 text-muted hover:text-bark hover:border-bark/25 flex items-center justify-center cursor-pointer transition-colors"
        >
          <X className="w-4.5 h-4.5" />
        </button>

        <div className="overflow-y-auto overscroll-contain">
          <div className="grid sm:grid-cols-2">
            {/* Image — cross-fades when switching colour */}
            <div className="relative w-full aspect-square bg-panel overflow-hidden">
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
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-tan" />
                </div>
              )}
              {selectedOut && (
                <span className="absolute top-3 left-3 bg-clay text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                  <PackageX className="w-3 h-3" /> สินค้าหมด
                </span>
              )}
            </div>

            {/* Details */}
            <div className="p-5 sm:p-7 flex flex-col">
              {card.brandName && (
                <span className="self-start text-[11px] font-semibold text-copper uppercase tracking-[0.12em]">
                  {card.brandName}
                </span>
              )}
              <h2 className="sf-display text-2xl leading-snug text-bark mt-1">{card.modelName}</h2>

              <div className="mt-3 flex items-end gap-3">
                <span className="text-3xl font-bold text-bark tabular-nums">
                  {selected && selected.standard_sale_price > 0 ? formatBaht(selected.standard_sale_price) : 'สอบถามราคา'}
                </span>
                {selectedOut ? (
                  <span className="text-sm font-semibold text-clay pb-1">สินค้าหมด</span>
                ) : (
                  <span className="text-sm font-medium text-muted pb-1">
                    เหลือ <span className="font-bold text-copper">{selected!.qty_in_stock}</span> ชิ้น
                  </span>
                )}
              </div>

              {card.description && (
                <p className="text-sm text-muted mt-4 whitespace-pre-line leading-relaxed">
                  {card.description}
                </p>
              )}

              {/* Colour selector — larger than on the card, with per-colour
                  price when prices differ between colours */}
              <div className="mt-5 border-t border-bark/10 pt-4">
                <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2.5">
                  เลือกสี
                  {selected && <span className="normal-case tracking-normal text-bark ml-1.5">· {selected.color}</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {card.variants.map(v => {
                    const vOut = v.qty_in_stock === 0;
                    const isSelected = v.id === selected?.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedId(v.id)}
                        aria-pressed={isSelected}
                        className={`relative flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-transparent text-bark'
                            : 'border-bark/10 text-muted hover:border-tan'
                        } ${vOut ? 'opacity-50' : ''}`}
                      >
                        {isSelected && (
                          <motion.span
                            layoutId={`detail-swatch-${card.modelId}`}
                            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                            className="absolute inset-0 rounded-full bg-panel ring-[1.5px] ring-copper"
                          />
                        )}
                        <span className={`relative w-5 h-5 rounded-full shadow-inner shrink-0 ${getDynamicColorStyles(v.color)}`} />
                        <span className="relative">{v.color}</span>
                        {pricesVary && v.standard_sale_price > 0 && (
                          <span className="relative text-copper font-semibold tabular-nums">{formatBaht(v.standard_sale_price)}</span>
                        )}
                        <span className={`relative whitespace-nowrap ${vOut ? 'text-clay' : 'text-tan'}`}>
                          {vOut ? 'หมด' : `เหลือ ${v.qty_in_stock}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CTA */}
              <div className="mt-6 sm:mt-auto sm:pt-6 space-y-2 pb-1">
                <FacebookButton className="w-full text-sm py-3" />
                <p className="text-[11px] text-muted text-center flex items-center justify-center gap-1">
                  <MessageCircle className="w-3 h-3 text-tan" />
                  ทักพร้อมแจ้งรุ่น "{card.modelName}" และสีที่ต้องการได้เลย
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
