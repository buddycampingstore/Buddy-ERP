import React, { useMemo, useState } from 'react';
import { Search, Image as ImageIcon, Facebook, PackageX, RefreshCw, Store } from 'lucide-react';
import logoImg from '../assets/images/logo_1782269852938.jpg';
import { isSupabaseConfigured } from './supabaseClient';
import { useStorefrontCatalog } from './useStorefrontCatalog';
import { PublicVariant } from './types';

// --- STORE CONTACT CONFIG ---
// TODO: แทนที่ด้วยข้อมูลจริงของร้าน (ลิงก์เพจ Facebook ที่ถูกต้อง)
const STORE = {
  name: 'Buddy Camp',
  tagline: 'อุปกรณ์แคมป์ปิ้งพร้อมส่ง — ดูสินค้าและราคาล่าสุด แล้วทักสั่งซื้อได้เลย',
  facebookUrl: 'https://www.facebook.com/buddycampingstore',
};

// Same color mapping as the ERP catalog (ProductsView.getDynamicColorStyles),
// copied here to keep the storefront fully decoupled from ERP components.
const getDynamicColorStyles = (colorName: string) => {
  const low = colorName.toLowerCase();
  if (low.includes('khaki') || low.includes('กากี')) return 'bg-[#C3B091]';
  if (low.includes('cream') || low.includes('ครีม') || low.includes('ขาว')) return 'bg-[#FDFBF7] border border-slate-300';
  if (low.includes('black') || low.includes('ดำ')) return 'bg-[#1C1C1E]';
  if (low.includes('green') || low.includes('เขียว') || low.includes('olive')) return 'bg-[#556B2F]';
  if (low.includes('red') || low.includes('แดง')) return 'bg-[#C0392B]';
  if (low.includes('blue') || low.includes('น้ำเงิน') || low.includes('ฟ้า')) return 'bg-[#2980B9]';
  if (low.includes('gray') || low.includes('เทา')) return 'bg-[#7F8C8D]';
  if (low.includes('brown') || low.includes('น้ำตาล')) return 'bg-[#8B4513]';
  if (low.includes('yellow') || low.includes('เหลือง')) return 'bg-[#F1C40F]';
  return 'bg-linear-to-tr from-slate-200 to-slate-400';
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

const FacebookButton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <a
    href={STORE.facebookUrl}
    target="_blank"
    rel="noopener noreferrer"
    className={`inline-flex items-center justify-center gap-2 bg-[#1877F2] hover:bg-[#0f66d0] text-white font-bold rounded-xl transition-colors ${className}`}
  >
    <Facebook className="w-4 h-4" /> ทักเพจเพื่อสั่งซื้อ
  </a>
);

export const StorefrontPage: React.FC = () => {
  const { brands, models, variants, loading, error, retry } = useStorefrontCatalog();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('all');

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-20 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center shrink-0">
              <img src={logoImg} alt={STORE.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight leading-tight">{STORE.name}</h1>
              <p className="text-[11px] text-slate-500 truncate">{STORE.tagline}</p>
            </div>
            <FacebookButton className="hidden sm:inline-flex text-xs py-2 px-3" />
          </div>

          {/* Search */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="ค้นหาสินค้า เช่น ชื่อรุ่น ยี่ห้อ หรือสี..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-sm text-slate-700 outline-hidden w-full bg-transparent placeholder:text-slate-400"
            />
          </div>

          {/* Brand filter chips */}
          {brandsWithProducts.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              <button
                onClick={() => setSelectedBrandId('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                  selectedBrandId === 'all'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                ทั้งหมด
              </button>
              {brandsWithProducts.map(brand => (
                <button
                  key={brand.id}
                  onClick={() => setSelectedBrandId(brand.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                    selectedBrandId === brand.id
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {brand.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">
        {!isSupabaseConfigured ? (
          <div className="bg-white border border-amber-200 rounded-2xl p-6 text-center max-w-md mx-auto space-y-2">
            <h2 className="font-bold text-slate-900">ยังไม่ได้ตั้งค่าระบบ</h2>
            <p className="text-sm text-slate-600">ไม่พบการตั้งค่า Supabase กรุณาติดต่อผู้ดูแลระบบ</p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
                <div className="w-full aspect-square bg-slate-100" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-1/3" />
                  <div className="h-4 bg-slate-100 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white border border-rose-200 rounded-2xl p-6 text-center max-w-md mx-auto space-y-3">
            <h2 className="font-bold text-slate-900">โหลดข้อมูลสินค้าไม่สำเร็จ</h2>
            <p className="text-sm text-slate-600">กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง</p>
            <button
              onClick={retry}
              className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold py-2 px-4 rounded-xl cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> ลองใหม่
            </button>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center max-w-md mx-auto space-y-3 text-slate-500">
            <Store className="w-10 h-10 text-slate-300 mx-auto" />
            <p>{modelCards.length === 0 ? 'ยังไม่มีสินค้าในร้านตอนนี้' : 'ไม่พบสินค้าตามที่ค้นหา'}</p>
            {modelCards.length > 0 && (
              <button
                onClick={() => { setSearchQuery(''); setSelectedBrandId('all'); }}
                className="text-emerald-700 hover:text-emerald-800 font-bold text-sm"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCards.map(card => {
              const soldOut = card.totalStock === 0;
              const prices = card.variants.map(v => v.standard_sale_price).filter(p => p > 0);
              const minPrice = prices.length ? Math.min(...prices) : 0;
              const maxPrice = prices.length ? Math.max(...prices) : 0;
              const priceLabel = prices.length === 0
                ? 'สอบถามราคา'
                : minPrice === maxPrice
                  ? formatBaht(minPrice)
                  : `${formatBaht(minPrice)} - ${formatBaht(maxPrice)}`;

              return (
                <div
                  key={card.modelId}
                  className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* Image */}
                  <div className="relative w-full aspect-square bg-slate-100">
                    {card.image ? (
                      <img
                        src={card.image}
                        alt={card.modelName}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className={`w-full h-full object-cover ${soldOut ? 'opacity-60' : ''}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-slate-300" />
                      </div>
                    )}
                    {soldOut && (
                      <span className="absolute top-2 left-2 bg-rose-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                        <PackageX className="w-3 h-3" /> สินค้าหมด
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4 flex flex-col flex-1">
                    {card.brandName && (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md self-start uppercase tracking-tight">
                        {card.brandName}
                      </span>
                    )}
                    <h3 className="font-extrabold text-slate-900 text-[15px] leading-snug mt-1.5">{card.modelName}</h3>
                    {card.description && (
                      <p className="text-xs text-slate-500 mt-1.5 whitespace-pre-line leading-relaxed">{card.description}</p>
                    )}

                    <div className="mt-2 mb-3">
                      <span className="text-lg font-extrabold text-emerald-700 font-mono">{priceLabel}</span>
                    </div>

                    {/* Variants */}
                    <div className="mt-auto space-y-1.5 border-t border-slate-100 pt-3">
                      {card.variants.map(v => {
                        const vOut = v.qty_in_stock === 0;
                        return (
                          <div key={v.id} className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-3.5 h-3.5 rounded-full shadow-inner shrink-0 ${getDynamicColorStyles(v.color)}`} />
                              <span className="font-semibold text-slate-700 truncate">{v.color}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {v.standard_sale_price > 0 && (
                                <span className="font-mono text-slate-500">{formatBaht(v.standard_sale_price)}</span>
                              )}
                              {vOut ? (
                                <span className="text-rose-500 font-bold whitespace-nowrap">หมด</span>
                              ) : (
                                <span className="text-emerald-700 font-bold whitespace-nowrap">เหลือ {v.qty_in_stock} ชิ้น</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Contact footer */}
      <footer className="border-t border-slate-100 bg-white mt-6">
        <div className="max-w-5xl mx-auto px-4 py-8 text-center space-y-3">
          <h2 className="text-base font-extrabold text-slate-900">สนใจสั่งซื้อ ติดต่อเราได้เลย</h2>
          <p className="text-sm text-slate-500">ยังไม่รองรับการสั่งซื้อผ่านเว็บ — ทักเข้ามาที่เพจเพื่อสอบถามและสั่งซื้อ</p>
          <FacebookButton className="text-sm py-2.5 px-5" />
          <p className="text-[11px] text-slate-400 pt-2">© {STORE.name}</p>
        </div>
      </footer>
    </div>
  );
};
