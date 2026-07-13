import { useCallback, useEffect, useState } from 'react';
import { supabaseShop } from './supabaseClient';
import { PublicBrand, PublicModel, PublicVariant, StorefrontCatalog } from './types';

const EMPTY: StorefrontCatalog = { brands: [], models: [], variants: [] };

const mapBrand = (b: any): PublicBrand => ({ id: b.id, name: b.name });

const mapModel = (m: any): PublicModel => ({
  id: m.id,
  brand_id: m.brand_id,
  name: m.name,
  image: m.image || undefined,
  description: m.description || undefined
});

const mapVariant = (v: any): PublicVariant => ({
  id: v.id,
  model_id: v.model_id,
  color: v.color,
  image: v.image || undefined,
  qty_in_stock: Number(v.qty_in_stock || 0),
  standard_sale_price: Number(v.standard_sale_price || 0)
});

const mapCatalog = (payload: any): StorefrontCatalog => ({
  brands: Array.isArray(payload?.brands) ? payload.brands.map(mapBrand) : [],
  models: Array.isArray(payload?.models) ? payload.models.map(mapModel) : [],
  variants: Array.isArray(payload?.variants) ? payload.variants.map(mapVariant) : []
});

export function useStorefrontCatalog() {
  const [catalog, setCatalog] = useState<StorefrontCatalog>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => setReloadKey(k => k + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    supabaseShop
      .rpc('get_storefront_catalog')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setError(error.message);
          setCatalog(EMPTY);
        } else {
          setCatalog(mapCatalog(data));
        }
      })
      .then(undefined, (err: any) => {
        if (!active) return;
        setError(err?.message || 'โหลดข้อมูลสินค้าไม่สำเร็จ');
        setCatalog(EMPTY);
      })
      .then(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  return { ...catalog, loading, error, retry };
}
