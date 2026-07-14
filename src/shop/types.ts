// Storefront-only types. Deliberately separate from src/types.ts so that
// cost/profit fields (e.g. current_wac) can never leak into public storefront
// code through the shared domain types. These mirror exactly the columns
// returned by the public get_storefront_catalog() RPC.

export interface PublicBrand {
  id: string;
  name: string;
}

export interface PublicModel {
  id: string;
  brand_id: string;
  name: string;
  image?: string;
  description?: string;
}

export interface PublicVariant {
  id: string;
  model_id: string;
  color: string;
  image?: string;
  qty_in_stock: number;
  standard_sale_price: number;
}

export interface StorefrontCatalog {
  brands: PublicBrand[];
  models: PublicModel[];
  variants: PublicVariant[];
}

// One storefront product card: a model with its brand resolved and all of its
// colour variants grouped together (built client-side in StorefrontPage).
export interface ModelCard {
  modelId: string;
  modelName: string;
  brandId: string;
  brandName: string;
  description?: string;
  image?: string;
  variants: PublicVariant[];
  totalStock: number;
}
