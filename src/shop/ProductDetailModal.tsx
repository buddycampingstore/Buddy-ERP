import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Image as ImageIcon, MessageCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import {
  FacebookButton, formatBaht, getDynamicColorStyles,
  imageLayers, variantImage, stockBadge,
} from './shared';
import { ModelCard } from './types';

/* Product detail overlay: a bottom sheet at every width, capped at 860px so it
   reads as a two-column dialog on desktop without losing the "slides up from
   the thumb" feel. Closes via the X button, backdrop click, Escape, or browser
   back (hash-driven — the parent owns open/close state and history). */
export const ProductDetailModal: React.FC<{
  card: ModelCard;
  initialVariantId?: string;
  onClose: () => void;
  onToast: (message: string) => void;
}> = ({ card, initialVariantId, onClose, onToast }) => {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Start from the colour the customer had selected on the card; otherwise
  // the first colour still in stock, matching the card's own default.
  const fallback = card.variants.find(v => v.qty_in_stock > 0) || card.variants[0];
  const initial = card.variants.find(v => v.id === initialVariantId) || fallback;
  const [selectedId, setSelectedId] = useState(initial?.id);
  const selected = card.variants.find(v => v.id === selectedId) || fallback;

  const layers = useMemo(() => imageLayers(card), [card]);
  const activeImage = variantImage(card, selected);
  const selectedOut = !selected || selected.qty_in_stock === 0;
  const badge = stockBadge(card.totalStock);
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

  // Ordering by message is easier than by product code, so hand the customer
  // the exact model + colour string to paste into the chat.
  const copyModelAndColor = async () => {
    const text = `${card.modelName} · สี${selected?.color || ''}`;
    try {
      await navigator.clipboard.writeText(text);
      onToast(`คัดลอกแล้ว: ${text}`);
    } catch {
      onToast('คัดลอกไม่สำเร็จ พิมพ์ชื่อรุ่นในแชทได้เลย');
    }
  };

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
        className="absolute inset-0 bg-bark/60 backdrop-blur-sm"
      />

      <motion.div
        initial={reduce ? { opacity: 0 } : { y: '100%' }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        exit={reduce ? { opacity: 0 } : { y: '100%' }}
        transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 380, damping: 36 }}
        className="relative w-full max-w-[860px] bg-paper rounded-t-[26px] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.5)] overflow-hidden max-h-[92dvh] flex flex-col"
      >
        {/* Grab handle (sheet affordance) */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-bark/15 z-10 sm:hidden" />

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="ปิดหน้าต่างรายละเอียดสินค้า"
          className="absolute top-3.5 right-3.5 z-10 w-10 h-10 rounded-full bg-paper/90 backdrop-blur border border-bark/12 text-muted flex items-center justify-center cursor-pointer transition-[color,border-color,transform] duration-300 hover:text-bark hover:border-bark/30 hover:rotate-90"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="overflow-y-auto overscroll-contain">
          <div className="grid sm:grid-cols-2">
            {/* Image — cross-fades between colours, same layered stack as the card */}
            <div className="relative aspect-square bg-panel overflow-hidden">
              {layers.length > 0 ? (
                layers.map(url => {
                  const active = url === activeImage;
                  return (
                    <img
                      key={url}
                      src={url}
                      alt={active ? `${card.modelName} ${selected?.color || ''}` : ''}
                      aria-hidden={!active}
                      referrerPolicy="no-referrer"
                      className={`absolute inset-0 w-full h-full object-cover transition-[opacity,transform,filter] duration-500 ease-out ${
                        active ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
                      } ${selectedOut ? 'grayscale-[45%]' : ''}`}
                    />
                  );
                })
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-tan" />
                </div>
              )}
              {badge && (
                <span
                  className={`absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold text-white pointer-events-none shadow-[0_6px_14px_-8px_rgba(0,0,0,0.7)] ${
                    badge.out ? 'bg-clay' : 'bg-bark'
                  }`}
                >
                  {badge.text}
                </span>
              )}
            </div>

            {/* Details */}
            <div className="flex flex-col p-6 sm:p-7">
              {card.brandName && (
                <span className="self-start text-[11px] font-bold text-copper uppercase tracking-[0.14em]">
                  {card.brandName}
                </span>
              )}
              <h2 className="sf-display text-[25px] leading-snug text-bark mt-1.5">{card.modelName}</h2>

              <div className="mt-3 flex items-end gap-3">
                <span className="text-[32px] font-bold text-bark tabular-nums tracking-tight leading-none">
                  {selected && selected.standard_sale_price > 0 ? formatBaht(selected.standard_sale_price) : 'สอบถามราคา'}
                </span>
                {selectedOut ? (
                  <span className="text-sm font-semibold text-clay">สินค้าหมด</span>
                ) : (
                  <span className="text-sm font-medium text-muted">
                    เหลือ <span className="font-bold text-copper">{selected!.qty_in_stock}</span> ชิ้น
                  </span>
                )}
              </div>

              {card.description && (
                <p className="text-sm text-muted mt-4 whitespace-pre-line leading-relaxed">
                  {card.description}
                </p>
              )}

              {/* Colour selector — larger than on the card, with remaining stock
                  and per-colour price when prices differ between colours */}
              <div className="mt-5 border-t border-bark/10 pt-4">
                <p className="text-[11px] font-bold text-muted uppercase tracking-[0.1em] mb-2.5">
                  เลือกสี
                  {selected && <span className="normal-case tracking-normal text-bark font-semibold ml-1.5">· {selected.color}</span>}
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
                        aria-label={`เลือกสี ${v.color}`}
                        className={`relative flex items-center gap-2 min-h-10 pl-2 pr-3.5 py-2 rounded-full border text-[13px] font-medium cursor-pointer transition-[color,border-color,transform] ${
                          isSelected ? 'border-transparent text-bark -translate-y-px' : 'border-bark/12 text-muted hover:border-tan'
                        } ${vOut ? 'opacity-55' : ''}`}
                      >
                        {isSelected && (
                          <motion.span
                            layoutId={`detail-swatch-${card.modelId}`}
                            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                            className="absolute inset-0 rounded-full bg-panel ring-[1.5px] ring-copper"
                          />
                        )}
                        <span
                          className={`relative w-5 h-5 rounded-full shadow-inner shrink-0 transition-transform ${
                            isSelected ? 'scale-110' : ''
                          } ${getDynamicColorStyles(v.color)}`}
                        />
                        <span className="relative">{v.color}</span>
                        {pricesVary && v.standard_sale_price > 0 && (
                          <span className="relative text-copper font-semibold tabular-nums">{formatBaht(v.standard_sale_price)}</span>
                        )}
                        <span className={`relative whitespace-nowrap text-xs font-semibold ${vOut ? 'text-clay' : 'text-tan'}`}>
                          {vOut ? 'หมด' : `เหลือ ${v.qty_in_stock}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CTA */}
              <div className="mt-6 sm:mt-auto sm:pt-6 flex flex-col gap-2.5 pb-1">
                <FacebookButton className="w-full min-h-12.5 text-[15px]" />
                <button
                  type="button"
                  onClick={copyModelAndColor}
                  className="w-full min-h-11 rounded-full border border-bark/15 bg-paper text-bark text-[13.5px] font-semibold cursor-pointer transition-[background-color,border-color] hover:bg-panel hover:border-copper"
                >
                  คัดลอกชื่อรุ่นและสี
                </button>
                <p className="text-[11.5px] text-muted text-center leading-relaxed flex items-center justify-center gap-1 mt-1">
                  <MessageCircle className="w-3 h-3 text-tan shrink-0" />
                  ทักพร้อมแจ้งรุ่น "{card.modelName}" และสี{selected?.color || ''} ได้เลย
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
