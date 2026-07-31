import React, { useMemo, useState } from 'react';
import { Image as ImageIcon, Heart } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { ModelCard } from './types';
import {
  FacebookButton, formatBaht, getDynamicColorStyles,
  imageLayers, variantImage, stockBadge, stockBarPct,
} from './shared';

export const ProductCard: React.FC<{
  card: ModelCard;
  isFavorite: boolean;
  onToggleFavorite: (modelId: string) => void;
  onOpenDetail: (modelId: string, variantId?: string) => void;
}> = ({ card, isFavorite, onToggleFavorite, onOpenDetail }) => {
  const reduce = useReducedMotion();

  // Default the selected colour to the first one still in stock, so customers
  // land on something they can actually buy; fall back to the first colour.
  const defaultVariant = card.variants.find(v => v.qty_in_stock > 0) || card.variants[0];
  const [selectedId, setSelectedId] = useState(defaultVariant?.id);
  const selected = card.variants.find(v => v.id === selectedId) || defaultVariant;

  const layers = useMemo(() => imageLayers(card), [card]);
  const activeImage = variantImage(card, selected);
  const selectedOut = !selected || selected.qty_in_stock === 0;
  const badge = stockBadge(card.totalStock);
  const hasMultipleColors = card.variants.length > 1;

  const openDetail = () => onOpenDetail(card.modelId, selected?.id);

  return (
    <motion.article
      variants={{ hidden: { opacity: 0, y: reduce ? 0 : 22 }, show: { opacity: 1, y: 0 } }}
      whileHover={reduce ? undefined : { y: -8 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="group relative flex flex-col h-full rounded-3xl bg-cream border border-bark/10 overflow-hidden shadow-[0_1px_2px_rgba(54,36,15,0.05)] hover:shadow-[0_26px_48px_-28px_rgba(54,36,15,0.6)] hover:border-copper/35 transition-[box-shadow,border-color]"
    >
      {/* Image — every colour's photo is stacked so switching cross-fades
          between decoded images instead of reloading one <img>. */}
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
                loading="lazy"
                referrerPolicy="no-referrer"
                className={`absolute inset-0 w-full h-full object-cover transition-[opacity,transform,filter] duration-500 ease-out ${
                  active ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
                } ${selectedOut ? 'grayscale-[45%]' : 'group-hover:scale-[1.04]'}`}
              />
            );
          })
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="w-10 h-10 text-tan" />
          </div>
        )}

        {badge && (
          <span
            className={`absolute top-3 left-3 z-[2] inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold text-white pointer-events-none shadow-[0_6px_14px_-8px_rgba(0,0,0,0.7)] ${
              badge.out ? 'bg-clay' : 'bg-bark'
            }`}
          >
            {badge.text}
          </span>
        )}

        <motion.button
          type="button"
          onClick={() => onToggleFavorite(card.modelId)}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `เอา ${card.modelName} ออกจากรายการโปรด` : `เพิ่ม ${card.modelName} ในรายการโปรด`}
          animate={{ scale: isFavorite && !reduce ? 1.08 : 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 24 }}
          className={`absolute top-2.5 right-2.5 z-[3] w-9.5 h-9.5 rounded-full flex items-center justify-center border border-bark/10 bg-paper/90 backdrop-blur cursor-pointer transition-colors ${
            isFavorite ? 'text-clay' : 'text-muted hover:text-bark'
          }`}
        >
          <Heart className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
        </motion.button>

        {/* Whole photo opens the detail view; sits under the badge and heart. */}
        <button
          type="button"
          onClick={openDetail}
          aria-label={`ดูรายละเอียด ${card.modelName}`}
          className="absolute inset-0 w-full h-full cursor-pointer"
        />
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 gap-2.5 p-4">
        {card.brandName && (
          <span className="self-start text-[10px] font-bold text-copper uppercase tracking-[0.14em]">
            {card.brandName}
          </span>
        )}
        <h3>
          <button
            type="button"
            onClick={openDetail}
            className="sf-display text-left text-[16.5px] leading-snug text-bark hover:text-copper transition-colors cursor-pointer"
          >
            {card.modelName}
          </button>
        </h3>
        {card.description && (
          <p className="text-xs text-muted leading-relaxed line-clamp-2">{card.description}</p>
        )}

        {/* Selected colour: price + remaining stock */}
        <div className="flex items-end justify-between gap-2">
          <span className="text-xl font-bold text-bark tabular-nums tracking-tight">
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

        {/* Stock level of the selected colour, at a glance */}
        <div className="h-[5px] rounded-full bg-bark/10 overflow-hidden">
          <motion.div
            initial={false}
            animate={{ width: `${stockBarPct(selected?.qty_in_stock ?? 0)}%` }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 180, damping: 28 }}
            className={`h-full rounded-full ${selectedOut ? 'bg-clay/40' : 'bg-linear-to-r from-copper to-dune'}`}
          />
        </div>

        {/* Colour selector */}
        <div className="flex flex-wrap gap-1.5">
          {card.variants.map(v => {
            const vOut = v.qty_in_stock === 0;
            const isSelected = v.id === selected?.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                title={vOut ? `${v.color} (สินค้าหมด)` : `${v.color} · เหลือ ${v.qty_in_stock} ชิ้น`}
                aria-pressed={isSelected}
                aria-label={hasMultipleColors ? `เลือกสี ${v.color}` : undefined}
                className={`relative flex items-center gap-1.5 min-h-8 pl-1 pr-2.5 py-1 rounded-full border text-[11.5px] font-medium cursor-pointer transition-[color,border-color,transform] ${
                  isSelected ? 'border-transparent text-bark -translate-y-px' : 'border-bark/12 text-muted hover:border-tan'
                } ${vOut ? 'opacity-55' : ''}`}
              >
                {isSelected && (
                  <motion.span
                    layoutId={`swatch-${card.modelId}`}
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                    className="absolute inset-0 rounded-full bg-panel ring-[1.5px] ring-copper"
                  />
                )}
                <span
                  className={`relative w-4 h-4 rounded-full shadow-inner shrink-0 transition-transform ${
                    isSelected ? 'scale-110' : ''
                  } ${getDynamicColorStyles(v.color)}`}
                />
                <span className="relative truncate max-w-[7rem]">{v.color}</span>
                <span className={`relative whitespace-nowrap ${vOut ? 'text-clay' : 'text-tan'}`}>
                  {vOut ? 'หมด' : v.qty_in_stock}
                </span>
              </button>
            );
          })}
        </div>

        {/* Actions — details, or straight to the page to order */}
        <div className="flex gap-1.5 mt-auto pt-3">
          <button
            type="button"
            onClick={openDetail}
            className="flex-1 min-h-10.5 rounded-full border border-bark/15 bg-paper text-bark text-[13px] font-semibold cursor-pointer transition-[background-color,border-color,transform] hover:bg-panel hover:border-copper hover:-translate-y-0.5"
          >
            ดูรายละเอียด
          </button>
          <FacebookButton label="ทักสั่ง" showIcon={false} className="flex-1 min-h-10.5 text-[13px]" />
        </div>
      </div>
    </motion.article>
  );
};
