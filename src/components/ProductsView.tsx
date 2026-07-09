/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  AppData, 
  Brand, 
  Model, 
  Variant 
} from '../types';
import { getVariantStockQty } from '../lib/finance';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  HelpCircle, 
  Package, 
  BookOpen, 
  Tag, 
  ExternalLink,
  Palette,
  Image
} from 'lucide-react';

interface ProductsViewProps {
  data: AppData;
  addBrand: (name: string) => Promise<Brand>;
  updateBrand: (id: string, name: string) => Promise<void>;
  archiveBrand: (id: string) => Promise<void>;
  addModel: (brand_id: string, name: string, image?: string) => Promise<Model>;
  updateModel: (id: string, name: string, brand_id: string, image?: string) => Promise<void>;
  archiveModel: (id: string) => Promise<void>;
  uploadVariantImage: (file: File) => Promise<string>;
  addVariant: (model_id: string, color: string, standard_sale_price?: number, image?: string) => Promise<Variant>;
  updateVariant: (id: string, color: string, model_id: string, standard_sale_price?: number, image?: string) => Promise<void>;
  archiveVariant: (id: string) => Promise<void>;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  data,
  addBrand,
  updateBrand,
  archiveBrand,
  addModel,
  updateModel,
  archiveModel,
  uploadVariantImage,
  addVariant,
  updateVariant,
  archiveVariant
}) => {
  const [subTab, setSubTab] = useState<'variants' | 'brands_models'>('variants');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('all');
  
  // --- IMAGE LIGHTBOX STATE ---
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');

  // --- BRAND FORM STATE ---
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [brandEditId, setBrandEditId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState('');

  // --- MODEL FORM STATE ---
  const [showModelForm, setShowModelForm] = useState(false);
  const [modelEditId, setModelEditId] = useState<string | null>(null);
  const [modelName, setModelName] = useState('');
  const [modelBrandId, setModelBrandId] = useState('');
  const [modelImage, setModelImage] = useState('');

  // --- VARIANT FORM STATE ---
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variantEditId, setVariantEditId] = useState<string | null>(null);
  const [variantColor, setVariantColor] = useState('');
  const [variantModelId, setVariantModelId] = useState('');
  const [variantStandardSalePrice, setVariantStandardSalePrice] = useState<string>('');
  const [variantImage, setVariantImage] = useState('');
  const [savingForm, setSavingForm] = useState<'brand' | 'model' | 'variant' | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Duplicate names fragment the catalog (two "Naturehike" trees, two SKUs of
  // the same physical colour) — warn before creating a same-name sibling.
  const isDuplicateName = (existing: { id: string; name: string }[], name: string, editingId: string | null) =>
    existing.some(item => item.id !== editingId && item.name.trim().toLowerCase() === name.toLowerCase());

  // --- FORM HANDLERS ---
  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = brandName.trim();
    if (!name) return;
    if (isDuplicateName(data.brands, name, brandEditId)) {
      alert(`มีแบรนด์ชื่อ "${name}" อยู่แล้ว กรุณาใช้ชื่ออื่นหรือแก้ไขแบรนด์เดิม`);
      return;
    }
    setSavingForm('brand');
    try {
      if (brandEditId) {
        await updateBrand(brandEditId, name);
        alert('แก้ไขแบรนด์เรียบร้อยแล้ว');
      } else {
        await addBrand(name);
        alert('เพิ่มแบรนด์เรียบร้อยแล้ว');
      }
      setBrandName('');
      setBrandEditId(null);
      setShowBrandForm(false);
    } catch (err: any) {
      alert(`บันทึกแบรนด์ไม่สำเร็จ: ${err.message || err}`);
    } finally {
      setSavingForm(null);
    }
  };

  // Pasting a base64 data URI into the image URL field embeds megabytes of
  // image data in the DB row and blew the products payload up to ~38 MB
  // (statement timeouts). Only real links are allowed; uploads go to Storage.
  const isInlineImageData = (value: string) => value.trim().toLowerCase().startsWith('data:');
  const isInvalidImageUrl = (value: string) => {
    const trimmed = value.trim();
    return trimmed !== '' && !/^https?:\/\/\S+$/i.test(trimmed);
  };

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = modelName.trim();
    if (!name || !modelBrandId) return;
    if (modelImage && isInlineImageData(modelImage)) {
      alert('ห้ามวางรูปแบบ base64 (data:...) ในช่องลิงก์ กรุณาใช้ปุ่ม "อัปโหลด" แทน ไม่งั้นระบบจะช้ามาก');
      return;
    }
    if (modelImage && isInvalidImageUrl(modelImage)) {
      alert('ลิงก์รูปภาพไม่ถูกต้อง ต้องขึ้นต้นด้วย http:// หรือ https:// เท่านั้น');
      return;
    }
    const siblingModels = data.models.filter(m => m.brand_id === modelBrandId);
    if (isDuplicateName(siblingModels, name, modelEditId)) {
      alert(`แบรนด์นี้มีรุ่นชื่อ "${name}" อยู่แล้ว กรุณาใช้ชื่ออื่นหรือแก้ไขรุ่นเดิม`);
      return;
    }
    setSavingForm('model');
    try {
      if (modelEditId) {
        await updateModel(modelEditId, name, modelBrandId, modelImage);
        alert('แก้ไขรุ่นสินค้าเรียบร้อยแล้ว');
      } else {
        await addModel(modelBrandId, name, modelImage);
        alert('เพิ่มรุ่นสินค้าเรียบร้อยแล้ว');
      }
      setModelName('');
      setModelBrandId('');
      setModelImage('');
      setModelEditId(null);
      setShowModelForm(false);
    } catch (err: any) {
      alert(`บันทึกรุ่นสินค้าไม่สำเร็จ: ${err.message || err}`);
    } finally {
      setSavingForm(null);
    }
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    const color = variantColor.trim();
    if (!color || !variantModelId) return;
    if (variantImage && isInlineImageData(variantImage)) {
      alert('ห้ามวางรูปแบบ base64 (data:...) ในช่องลิงก์ กรุณาใช้ปุ่ม "อัปโหลดรูปสีนี้" แทน ไม่งั้นระบบจะช้ามาก');
      return;
    }
    if (variantImage && isInvalidImageUrl(variantImage)) {
      alert('ลิงก์รูปภาพไม่ถูกต้อง ต้องขึ้นต้นด้วย http:// หรือ https:// เท่านั้น');
      return;
    }
    const siblingColors = data.variants
      .filter(v => v.model_id === variantModelId)
      .map(v => ({ id: v.id, name: v.color }));
    if (isDuplicateName(siblingColors, color, variantEditId)) {
      alert(`รุ่นนี้มีสี "${color}" อยู่แล้ว กรุณาใช้ชื่อสีอื่นหรือแก้ไขสีเดิม`);
      return;
    }
    const priceNum = variantStandardSalePrice ? parseFloat(variantStandardSalePrice) : 0;
    setSavingForm('variant');
    try {
      if (variantEditId) {
        await updateVariant(variantEditId, color, variantModelId, priceNum, variantImage);
        alert('แก้ไขข้อมูลสีเรียบร้อยแล้ว');
      } else {
        await addVariant(variantModelId, color, priceNum, variantImage);
        alert('เพิ่มสีสินค้าเรียบร้อยแล้ว');
      }
      setVariantColor('');
      setVariantModelId('');
      setVariantStandardSalePrice('');
      setVariantImage('');
      setVariantEditId(null);
      setShowVariantForm(false);
    } catch (err: any) {
      alert(`บันทึกตัวเลือกสินค้าไม่สำเร็จ: ${err.message || err}`);
    } finally {
      setSavingForm(null);
    }
  };

  const handleConfirmDeleteBrand = (id: string, name: string) => {
    const isUsed = data.models.some(m => m.brand_id === id);
    const msg = isUsed 
      ? `แบรนด์ "${name}" มีรุ่นและสีผูกอยู่ ต้องการซ่อนแบรนด์นี้หรือไม่?`
      : `ต้องการซ่อนแบรนด์ "${name}" หรือไม่?`;
    if (!window.confirm(msg)) return;
    archiveBrand(id)
      .then(() => alert('ซ่อนแบรนด์เรียบร้อยแล้ว'))
      .catch((err: any) => alert(`ซ่อนแบรนด์ไม่สำเร็จ: ${err.message || err}`));
  };

  const handleConfirmDeleteModel = (id: string, name: string) => {
    const isUsed = data.variants.some(v => v.model_id === id);
    const msg = isUsed 
      ? `รุ่น "${name}" มีสีผูกอยู่ ต้องการซ่อนรุ่นและสีทั้งหมดหรือไม่?`
      : `ต้องการซ่อนรุ่น "${name}" หรือไม่?`;
    if (!window.confirm(msg)) return;
    archiveModel(id)
      .then(() => alert('ซ่อนรุ่นสินค้าเรียบร้อยแล้ว'))
      .catch((err: any) => alert(`ซ่อนรุ่นสินค้าไม่สำเร็จ: ${err.message || err}`));
  };

  const handleConfirmDeleteVariant = (id: string, color: string, name: string) => {
    const count = getVariantStockQty(data.stockSummary, id);
    const msg = count > 0 
      ? `สี "${color}" ของ ${name} ยังมีสต็อก ${count} ตัว ต้องการซ่อนสีนี้หรือไม่?`
      : `ต้องการซ่อนสี "${color}" ของ ${name} หรือไม่?`;
    if (!window.confirm(msg)) return;
    archiveVariant(id)
      .then(() => alert('ซ่อนสีสินค้าเรียบร้อยแล้ว'))
      .catch((err: any) => alert(`ซ่อนสีสินค้าไม่สำเร็จ: ${err.message || err}`));
  };

  const brandById = React.useMemo(() => new Map(data.brands.map((b) => [b.id, b])), [data.brands]);
  const modelById = React.useMemo(() => new Map(data.models.map((m) => [m.id, m])), [data.models]);

  const activeBrands = React.useMemo(
    () => data.brands.filter((brand) => brand.is_active !== false),
    [data.brands]
  );
  const activeModels = React.useMemo(
    () => data.models.filter((model) => {
      const brand = brandById.get(model.brand_id);
      return model.is_active !== false && brand?.is_active !== false;
    }),
    [brandById, data.models]
  );
  const activeVariants = React.useMemo(
    () => data.variants.filter((variant) => {
      const model = modelById.get(variant.model_id);
      const brand = model ? brandById.get(model.brand_id) : null;
      return variant.is_active !== false && model?.is_active !== false && brand?.is_active !== false;
    }),
    [brandById, data.variants, modelById]
  );

  // Precompute the model count per brand once so the filter chips don't
  // re-filter the whole model list for every button on every render.
  const modelCountByBrand = React.useMemo(() => {
    const counts = new Map<string, number>();
    activeModels.forEach(m => counts.set(m.brand_id, (counts.get(m.brand_id) || 0) + 1));
    return counts;
  }, [activeModels]);

  // Count active variants per model once for the model-management tab.
  const variantCountByModel = React.useMemo(() => {
    const counts = new Map<string, number>();
    activeVariants.forEach(v => counts.set(v.model_id, (counts.get(v.model_id) || 0) + 1));
    return counts;
  }, [activeVariants]);

  // --- FILTERED VARIANTS ---
  const filteredVariants = React.useMemo(() => {
    return data.variants.map(v => {
      const model = modelById.get(v.model_id);
      const brand = model ? brandById.get(model.brand_id) : null;
      return {
        ...v,
        modelName: model?.name || 'ไม่มีรุ่น',
        brandName: brand?.name || 'ไม่มีแบรนด์',
        brandId: brand?.id || ''
      };
    }).filter(item => {
      if (item.is_active === false) {
        return false;
      }
      if (selectedBrandId !== 'all' && item.brandId !== selectedBrandId) {
        return false;
      }
      const searchLow = searchQuery.toLowerCase().trim();
      if (!searchLow) return true;
      return (
        item.color.toLowerCase().includes(searchLow) ||
        item.modelName.toLowerCase().includes(searchLow) ||
        item.brandName.toLowerCase().includes(searchLow) ||
        item.id.toLowerCase().includes(searchLow)
      );
    });
  }, [brandById, data.variants, modelById, searchQuery, selectedBrandId]);

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

  const groupedModels = React.useMemo(() => {
    const groups: {
      modelId: string;
      modelName: string;
      brandName: string;
      brandId: string;
      modelImage?: string;
      variants: typeof filteredVariants;
    }[] = [];

    // Index groups by modelId so this is O(variants) instead of O(variants²)
    // — this memo re-runs on every search keystroke.
    const groupByModelId = new Map<string, (typeof groups)[number]>();
    filteredVariants.forEach(v => {
      let existingGroup = groupByModelId.get(v.model_id);
      if (!existingGroup) {
        const modelObj = modelById.get(v.model_id);
        existingGroup = {
          modelId: v.model_id,
          modelName: v.modelName,
          brandName: v.brandName,
          brandId: modelObj?.brand_id || '',
          modelImage: v.image || modelObj?.image,
          variants: []
        };
        groupByModelId.set(v.model_id, existingGroup);
        groups.push(existingGroup);
      }
      existingGroup.variants.push(v);
    });

    return groups;
  }, [filteredVariants, modelById]);

  const groupedBrands = React.useMemo(() => {
    const brandGroups: {
      brandId: string;
      brandName: string;
      models: typeof groupedModels;
    }[] = [];

    const brandGroupById = new Map<string, (typeof brandGroups)[number]>();
    groupedModels.forEach(modelGroup => {
      const bId = modelGroup.brandId || 'none';
      const bName = modelGroup.brandName || 'ไม่ระบุแบรนด์';
      let existingBrand = brandGroupById.get(bId);
      if (!existingBrand) {
        existingBrand = {
          brandId: bId,
          brandName: bName,
          models: []
        };
        brandGroupById.set(bId, existingBrand);
        brandGroups.push(existingBrand);
      }
      existingBrand.models.push(modelGroup);
    });

    return brandGroups.sort((a, b) => {
      if (a.brandId === 'none') return 1;
      if (b.brandId === 'none') return -1;
      return a.brandName.localeCompare(b.brandName, 'th');
    });
  }, [groupedModels]);

  const groupedModelsByBrand = React.useMemo(() => {
    const brandGroups: {
      brandId: string;
      brandName: string;
      models: typeof activeModels;
    }[] = [];

    // Bucket models by brand in a single pass instead of filtering the whole
    // model list once per brand.
    const activeBrandIds = new Set(activeBrands.map(b => b.id));
    const modelsByBrandId = new Map<string, typeof activeModels>();
    const unbrandedModels: typeof activeModels = [];
    activeModels.forEach(m => {
      if (m.brand_id && activeBrandIds.has(m.brand_id)) {
        const list = modelsByBrandId.get(m.brand_id) || [];
        list.push(m);
        modelsByBrandId.set(m.brand_id, list);
      } else {
        unbrandedModels.push(m);
      }
    });

    activeBrands.forEach(brand => {
      brandGroups.push({
        brandId: brand.id,
        brandName: brand.name,
        models: modelsByBrandId.get(brand.id) || []
      });
    });

    if (unbrandedModels.length > 0) {
      brandGroups.push({
        brandId: 'unbranded',
        brandName: 'ไม่ระบุแบรนด์',
        models: unbrandedModels
      });
    }

    return brandGroups.sort((a, b) => {
      if (a.brandId === 'unbranded') return 1;
      if (b.brandId === 'unbranded') return -1;
      return a.brandName.localeCompare(b.brandName, 'th');
    });
  }, [activeBrands, activeModels]);

  return (
    <div className="space-y-6" id="products-view-container">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between py-2 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight" id="products-view-title">
            ระบบจัดทำคลังและรายละเอียดสินค้า
          </h1>
          <p className="text-slate-500 text-sm">กำหนดรายละเอียดแบรนด์ รุ่น สี ขนาด และดูมูลค่าเสื่อมถอยคลัง WAC</p>
        </div>
        <div className="mt-2 md:mt-0 flex flex-wrap gap-2">
          <button
            onClick={() => {
              setBrandEditId(null);
              setBrandName('');
              setShowBrandForm(true);
            }}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold py-2 px-3 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> แบรนด์
          </button>
          <button
            onClick={() => {
              if (activeBrands.length === 0) {
                alert('เพิ่มแบรนด์ก่อนอย่างน้อย 1 แบรนด์');
                return;
              }
              setModelEditId(null);
              setModelName('');
              setModelBrandId(activeBrands[0].id);
              setModelImage('');
              setShowModelForm(true);
            }}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold py-2 px-3 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> รุ่น
          </button>
          <button
            onClick={() => {
              setVariantEditId(null);
              setVariantColor('');
              setVariantStandardSalePrice('');
              setVariantImage('');
              if (activeModels.length > 0) setVariantModelId(activeModels[0].id);
              setShowVariantForm(true);
            }}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold py-2 px-3 rounded-xl flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
            id="add-variant-btn"
          >
            <Plus className="w-4 h-4" /> เพิ่มสินค้า/สี
          </button>
        </div>
      </div>

      {/* Sub-tab switcher */}
      <div className="inline-flex bg-slate-100 p-1 rounded-xl gap-1" id="products-subtab-switcher">
        <button
          type="button"
          onClick={() => setSubTab('variants')}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            subTab === 'variants'
              ? 'bg-white text-emerald-700 shadow-xs'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Palette className="w-3.5 h-3.5" /> คลังสี/สินค้า
        </button>
        <button
          type="button"
          onClick={() => setSubTab('brands_models')}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            subTab === 'brands_models'
              ? 'bg-white text-emerald-700 shadow-xs'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" /> โมเดลรุ่นสินค้า
        </button>
      </div>

      {subTab === 'variants' ? (
        // ================== TAB: VARIANTS ==================
        <div className="space-y-4" id="variants-layout">
          {/* Search bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
            <Search className="w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาแบรนด์, รุ่น, สินค้าย่อย หรือ รหัสสี..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-sm text-slate-700 outline-hidden w-full placeholder:text-slate-400"
              id="variants-search-input"
            />
          </div>

          {/* Brand Quick Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-2" id="brand-filters-container">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ฟิลเตอร์เลือกดูตามแบรนด์เก้าอี้</label>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none snap-x">
              <button
                onClick={() => setSelectedBrandId('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap snap-start transition-all cursor-pointer border ${
                  selectedBrandId === 'all'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                ทั้งหมด ({activeModels.length} รุ่น)
              </button>
              {activeBrands.map(brand => {
                const modelCount = modelCountByBrand.get(brand.id) || 0;
                return (
                  <button
                    key={brand.id}
                    onClick={() => setSelectedBrandId(brand.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap snap-start transition-all cursor-pointer border ${
                      selectedBrandId === brand.id
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {brand.name} ({modelCount} รุ่น)
                  </button>
                );
              })}
            </div>
          </div>

          {/* Variants Grouped Board (Grouped by Brand) */}
          <div className="space-y-8" id="grouped-variants-container">
            {groupedBrands.length > 0 ? (
              groupedBrands.map(brandGroup => (
                <div key={brandGroup.brandId} className="space-y-4" id={`brand-section-${brandGroup.brandId}`}>
                  {/* Brand Section Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-5 bg-emerald-700 rounded-full" />
                      <h2 className="text-base font-extrabold text-slate-800 tracking-tight">
                        แบรนด์ {brandGroup.brandName}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/40">
                        {brandGroup.models.length} รุ่นย่อย
                      </span>
                      {brandGroup.brandId !== 'none' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const brand = activeBrands.find(item => item.id === brandGroup.brandId);
                              if (!brand) return;
                              setBrandEditId(brand.id);
                              setBrandName(brand.name);
                              setShowBrandForm(true);
                            }}
                            className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 bg-white border border-slate-200 rounded-lg px-2 py-1"
                          >
                            แก้แบรนด์
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmDeleteBrand(brandGroup.brandId, brandGroup.brandName)}
                            className="text-[10px] font-bold text-rose-500 hover:text-rose-700 bg-white border border-rose-100 rounded-lg px-2 py-1"
                          >
                            ซ่อน
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Models belonging to this brand */}
                  <div className="space-y-4">
                    {brandGroup.models.map(group => {
                      const totalQty = group.variants.reduce((sum, v) => sum + v.qty_in_stock, 0);
                      const totalWacValue = group.variants.reduce((sum, v) => sum + (v.qty_in_stock * v.current_wac), 0);
                      
                      return (
                        <div 
                          key={group.modelId} 
                          className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200" 
                          id={`model-group-${group.modelId}`}
                        >
                          {/* Header: Model title & compact stats */}
                            <div className="bg-slate-50/70 p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {group.modelImage ? (
                                <img 
                                  src={group.modelImage} 
                                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 cursor-zoom-in hover:scale-110 active:scale-95 transition-transform duration-200" 
                                  referrerPolicy="no-referrer" 
                                  title="คลิกเพื่อขยายดูรูปภาพ"
                                  onClick={() => {
                                    setPreviewImage(group.modelImage || null);
                                    setPreviewTitle(`${group.brandName} ${group.modelName}`);
                                  }}
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                  <Image className="w-6 h-6 text-slate-400" />
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-md uppercase font-mono tracking-tight">
                                    {group.brandName}
                                  </span>
                                  <h3 className="font-extrabold text-slate-800 text-[14px] md:text-[15px] tracking-tight">
                                    {group.modelName}
                                  </h3>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                                  <span>มีตัวเลือกสีทั้งหมด:</span>
                                  <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-sm">{group.variants.length} สี</span>
                                </p>
                              </div>
                            </div>

                            {/* Right: Aggregated numbers (Clean Grid) */}
                            <div className="flex flex-col md:flex-row md:items-center gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6">
                              <div className="grid grid-cols-2 gap-4 text-xs font-semibold min-w-[200px]">
                                <div>
                                  <span className="text-slate-400 block text-[9px] uppercase font-bold">สต็อกรวมทุกสี</span>
                                  <span className={`font-extrabold text-slate-800 text-sm ${totalQty === 0 ? 'text-rose-500' : 'text-slate-800'}`}>
                                    {totalQty} <span className="text-[10px] text-slate-400 font-normal">ตัว</span>
                                  </span>
                                </div>
                                <div>
                                  <span className="text-emerald-800 block text-[9px] uppercase font-bold">มูลค่ารวมคลังรุ่นนี้</span>
                                  <span className="font-extrabold text-emerald-700 text-sm font-mono">
                                    ฿{totalWacValue.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModelEditId(group.modelId);
                                    setModelName(group.modelName);
                                    setModelBrandId(group.brandId);
                                    setModelImage(group.modelImage || '');
                                    setShowModelForm(true);
                                  }}
                                  className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 bg-white border border-slate-200 rounded-lg px-2 py-1"
                                >
                                  แก้รุ่น
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDeleteModel(group.modelId, group.modelName)}
                                  className="text-[10px] font-bold text-rose-500 hover:text-rose-700 bg-white border border-rose-100 rounded-lg px-2 py-1"
                                >
                                  ซ่อนรุ่น
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Table View (Desktop) */}
                          <div className="overflow-x-auto hidden md:block">
                            <table className="w-full text-left text-xs text-slate-600 border-collapse">
                              <thead>
                                <tr className="bg-slate-50/20 text-slate-400 font-semibold border-b border-slate-100 text-[10px] uppercase tracking-wider">
                                  <th className="py-2.5 px-4 w-[12%]">รหัส SKU</th>
                                  <th className="py-2.5 px-4 w-[28%]">สีเก้าอี้ (Color Option)</th>
                                  <th className="py-2.5 px-4 text-center w-[12%]">สัญลักษณ์สี</th>
                                  <th className="py-2.5 px-4 text-right w-[12%]">จำนวนค้างสต็อก</th>
                                  <th className="py-2.5 px-4 text-right w-[15%]">ต้นทุนเฉลี่ย WAC</th>
                                  <th className="py-2.5 px-4 text-right text-emerald-800 font-bold bg-emerald-50/10 w-[15%]">ราคาตั้งขายจริง</th>
                                  <th className="py-2.5 px-4 text-right w-[15%]">มูลค่ารวมคลัง</th>
                                  <th className="py-2.5 px-4 text-center w-[10%]">จัดการ</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {group.variants.map(v => (
                                  <tr key={v.id} className="hover:bg-slate-50/40 transition-colors">
                                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                                      {v.id}
                                    </td>
                                    <td className="py-3 px-4 font-bold text-slate-800 text-[13px]">
                                      <div className="flex items-center gap-2">
                                        {(v.image || group.modelImage) ? (
                                          <img
                                            src={v.image || group.modelImage}
                                            className="w-9 h-9 rounded-lg object-cover border border-slate-200 cursor-zoom-in"
                                            referrerPolicy="no-referrer"
                                            onClick={() => {
                                              setPreviewImage(v.image || group.modelImage || null);
                                              setPreviewTitle(`${group.brandName} ${group.modelName} ${v.color}`);
                                            }}
                                          />
                                        ) : (
                                          <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                                            <Image className="w-4 h-4 text-slate-300" />
                                          </div>
                                        )}
                                        <span>{v.color}</span>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <span className="inline-flex items-center justify-center">
                                        <span className={`w-4 h-4 rounded-full shadow-inner ${getDynamicColorStyles(v.color)}`} />
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <span className={`font-semibold text-[13px] ${v.qty_in_stock === 0 ? 'text-rose-500 font-bold' : v.qty_in_stock <= 3 ? 'text-amber-500' : 'text-slate-800'}`}>
                                        {v.qty_in_stock}
                                      </span>
                                      <span className="text-[10px] text-slate-400 ml-1">ตัว</span>
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700">
                                      ฿{v.current_wac.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 bg-emerald-50/5">
                                      ฿{(v.standard_sale_price || 0).toLocaleString('th-TH', { minimumFractionDigits: 0 })}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                                      ฿{(v.qty_in_stock * v.current_wac).toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          onClick={() => {
                                            setVariantEditId(v.id);
                                            setVariantColor(v.color);
                                            setVariantModelId(v.model_id);
                                            setVariantStandardSalePrice(v.standard_sale_price ? String(v.standard_sale_price) : '');
                                            setVariantImage(v.image || '');
                                            setShowVariantForm(true);
                                          }}
                                          className="p-1 px-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                                          title="แก้ไขข้อมูลสี"
                                        >
                                          <Edit2 className="w-3 h-3" /> <span>แก้</span>
                                        </button>
                                        <button
                                          onClick={() => handleConfirmDeleteVariant(v.id, v.color, `${v.brandName} ${v.modelName}`)}
                                          className="p-1 px-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                                          title="ลบตัวเลือกนี้"
                                        >
                                          <Trash2 className="w-3 h-3" /> <span>ลบ</span>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Mobile Card Layout: High readability, touch targets, no horizontal scrolling */}
                          <div className="block md:hidden divide-y divide-slate-100 bg-white">
                            {group.variants.map(v => (
                              <div key={v.id} className="p-3.5 space-y-2.5 active:bg-slate-50/50 transition-colors">
                                {/* Top row: Color and Actions */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    {(v.image || group.modelImage) ? (
                                      <img
                                        src={v.image || group.modelImage}
                                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                                        referrerPolicy="no-referrer"
                                        onClick={() => {
                                          setPreviewImage(v.image || group.modelImage || null);
                                          setPreviewTitle(`${group.brandName} ${group.modelName} ${v.color}`);
                                        }}
                                      />
                                    ) : (
                                      <span className={`w-4 h-4 rounded-full shadow-inner ${getDynamicColorStyles(v.color)} shrink-0`} />
                                    )}
                                    <div>
                                      <span className="font-extrabold text-slate-800 text-[13px]">{v.color}</span>
                                      <span className="block text-[9px] font-mono text-slate-400">SKU: {v.id}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => {
                                        setVariantEditId(v.id);
                                        setVariantColor(v.color);
                                        setVariantModelId(v.model_id);
                                        setVariantStandardSalePrice(v.standard_sale_price ? String(v.standard_sale_price) : '');
                                        setVariantImage(v.image || group.modelImage || '');
                                        setShowVariantForm(true);
                                      }}
                                      className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                      title="แก้ไข"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleConfirmDeleteVariant(v.id, v.color, `${v.brandName} ${v.modelName}`)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                      title="ลบ"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Info Grid (Stock, Cost, Sale) */}
                                <div className="grid grid-cols-3 gap-2 bg-slate-50/60 p-2 rounded-xl border border-slate-100/70 text-center">
                                  <div>
                                    <span className="text-[9px] text-slate-400 block mb-0.5">คงคลัง</span>
                                    <span className={`text-[12px] font-bold ${v.qty_in_stock === 0 ? 'text-rose-500' : v.qty_in_stock <= 3 ? 'text-amber-500' : 'text-slate-800'}`}>
                                      {v.qty_in_stock} <span className="text-[9px] text-slate-400 font-normal">ตัว</span>
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-slate-400 block mb-0.5">ทุนเฉลี่ย WAC</span>
                                    <span className="text-[11px] font-semibold text-slate-600 font-mono">
                                      ฿{Math.round(v.current_wac).toLocaleString()}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-emerald-800 block mb-0.5">ราคาขายจริง</span>
                                    <span className="text-[12px] font-bold text-emerald-700 font-mono">
                                      ฿{(v.standard_sale_price || 0).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400 text-xs">
                ไม่พบข้อมูลสินค้าที่ค้นหา หรือคลังว่างเปล่า
              </div>
            )}

            {/* Total Global Summary */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center text-xs gap-3">
              <div>
                แสดงทั้งหมด <strong className="text-emerald-400">{filteredVariants.length}</strong> รายการสีพ่วง จากรุ่นที่กางคลัง
              </div>
              <div className="font-bold flex items-center gap-1">
                <span>มูลค่าสต็อกสะสมรวมที่ค้นพบ:</span>
                <span className="text-emerald-400 text-sm font-mono font-extrabold">
                  ฿{filteredVariants.reduce((sum, v) => sum + (v.qty_in_stock * v.current_wac), 0).toLocaleString('th-TH', { minimumFractionDigits: 1 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ================== TAB: BRANDS & MODELS ==================
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="brands-models-layout">
          {/* Brand Card Column */}
          <div className="space-y-4" id="brand-column">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-xs">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">รายชื่อแบรนด์เก้าอี้แคมป์ปิ้ง</h3>
                <p className="text-slate-400 text-xs">แบรนด์หลักที่ผูกอยู่ในคลังทั้งหมด</p>
              </div>
              <button
                onClick={() => {
                  setBrandEditId(null);
                  setBrandName('');
                  setShowBrandForm(true);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer"
                id="add-brand-btn"
              >
                <Plus className="w-3.5 h-3.5" /> เพิ่มแบรนด์
              </button>
            </div>

            {/* Desktop Table View for Brands */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hidden md:block">
              <table className="w-full text-left text-xs text-slate-600">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-indigo-50/20 font-semibold text-slate-400">
                    <th className="py-2.5 px-4">ชื่อแบรนด์</th>
                    <th className="py-2.5 px-4 text-center">รหัสอ้างอิง</th>
                    <th className="py-2.5 px-4 text-center">จำนวนรุ่นย่อย</th>
                    <th className="py-2.5 px-4 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeBrands.length > 0 ? (
                    activeBrands.map(brand => {
                      const counts = modelCountByBrand.get(brand.id) || 0;
                      return (
                        <tr key={brand.id} className="hover:bg-slate-50/20">
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            {brand.name}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-[10px] text-slate-400">
                            {brand.id}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-700 font-semibold text-xs">
                            {counts} รุ่นย่อย
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setBrandEditId(brand.id);
                                  setBrandName(brand.name);
                                  setShowBrandForm(true);
                                }}
                                className="p-1 px-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleConfirmDeleteBrand(brand.id, brand.name)}
                                className="p-1 px-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-slate-400">ยังไม่มีแบรนด์สินค้า</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout for Brands */}
            <div className="block md:hidden space-y-2.5">
              {activeBrands.length > 0 ? (
                activeBrands.map(brand => {
                  const counts = modelCountByBrand.get(brand.id) || 0;
                  return (
                    <div key={brand.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-xs">
                      <div className="space-y-1">
                        <span className="font-extrabold text-slate-800 text-[14px] block">{brand.name}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">ID: {brand.id}</span>
                          <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">{counts} รุ่นย่อย</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setBrandEditId(brand.id);
                            setBrandName(brand.name);
                            setShowBrandForm(true);
                          }}
                          className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl border border-slate-100 cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleConfirmDeleteBrand(brand.id, brand.name)}
                          className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-slate-100 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400 text-xs">
                  ยังไม่มีแบรนด์สินค้า
                </div>
              )}
            </div>
          </div>

          {/* Model Card Column */}
          <div className="space-y-4" id="model-column">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-xs">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">โมเดลรุ่นสินค้า</h3>
                <p className="text-slate-400 text-xs">รุ่นโมเดลและรูปสินค้าที่จัดเรียงสีสินค้าพ่วงไว้</p>
              </div>
              <button
                onClick={() => {
                  if (activeBrands.length === 0) {
                    alert('กรุณาสร้างแบรนด์สินค้าก่อนอย่างน้อย 1 แบรนด์ จึงจะเพิ่มรุ่นสินค้าได้');
                    return;
                  }
                  setModelEditId(null);
                  setModelName('');
                  setModelBrandId(activeBrands[0].id);
                  setModelImage('');
                  setShowModelForm(true);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer"
                id="add-model-btn"
              >
                <Plus className="w-3.5 h-3.5" /> เพิ่มโมเดลรุ่น
              </button>
            </div>

            {/* Grouped Models list */}
            <div className="space-y-4" id="grouped-models-list">
              {groupedModelsByBrand.length > 0 ? (
                groupedModelsByBrand.map(brandGroup => {
                  const hasModels = brandGroup.models.length > 0;
                  return (
                    <div 
                      key={brandGroup.brandId} 
                      className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/80 space-y-3"
                      id={`model-brand-group-${brandGroup.brandId}`}
                    >
                      {/* Brand Group Title & Stats */}
                      <div className="flex items-center justify-between pb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-4 bg-emerald-700 rounded-full shrink-0" />
                          <h4 className="font-extrabold text-slate-800 text-[13px] tracking-tight">
                            แบรนด์ {brandGroup.brandName}
                          </h4>
                        </div>
                        <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100/30">
                          มีทั้งหมด {brandGroup.models.length} รุ่น
                        </span>
                      </div>

                      {/* Models List */}
                      {hasModels ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {brandGroup.models.map(model => {
                            const activeVariantsForModel = variantCountByModel.get(model.id) || 0;
                            return (
                              <div 
                                key={model.id} 
                                className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-3 shadow-xs hover:shadow-xs hover:border-slate-200 transition-all duration-150"
                                id={`model-item-${model.id}`}
                              >
                                <div className="flex items-center gap-3 overflow-hidden">
                                  {model.image ? (
                                    <img 
                                      src={model.image} 
                                      className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0 cursor-zoom-in hover:scale-110 active:scale-95 transition-transform duration-200" 
                                      referrerPolicy="no-referrer" 
                                      title="คลิกเพื่อขยายดูรูปภาพ"
                                      onClick={() => {
                                        const brand = activeBrands.find(b => b.id === model.brand_id);
                                        setPreviewImage(model.image || null);
                                        setPreviewTitle(`${brand?.name || 'เก้าอี้'} ${model.name}`);
                                      }}
                                    />
                                  ) : (
                                    <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-150 flex items-center justify-center shrink-0">
                                      <Image className="w-5 h-5 text-slate-400" />
                                    </div>
                                  )}
                                  <div className="space-y-1 overflow-hidden">
                                    <span className="font-extrabold text-slate-800 text-[13px] block truncate">
                                      {model.name}
                                    </span>
                                    <div className="flex items-center gap-1.5 text-[9px] text-slate-400 flex-wrap">
                                      <span className="font-mono bg-slate-50 border border-slate-100 rounded-md px-1 py-0.2">
                                        ID: {model.id}
                                      </span>
                                      <span className="bg-emerald-50/70 text-emerald-800 px-1 py-0.2 rounded font-bold">
                                        {activeVariantsForModel} สีพ่วง
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => {
                                      setModelEditId(model.id);
                                      setModelName(model.name);
                                      setModelBrandId(model.brand_id);
                                      setModelImage(model.image || '');
                                      setShowModelForm(true);
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-100 transition-colors cursor-pointer"
                                    title="แก้ไขโมเดล"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleConfirmDeleteModel(model.id, model.name)}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-slate-100 transition-colors cursor-pointer"
                                    title="ลบโมเดล"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-5 bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                          ยังไม่มีโมเดลรุ่นเก้าอี้ของแบรนด์นี้
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400 text-xs">
                  ยังไม่มีข้อมูลรุ่นโมเดลสินค้า
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================== DIALOGS MODALS ================== */}

      {/* 1. BRAND DIALOG */}
      {showBrandForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="brand-modal">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-slide-up border border-slate-100">
            <div className="bg-slate-900 text-white p-4 px-6 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <Tag className="w-4 h-4" /> {brandEditId ? 'แก้ไขข้อมูลแบรนด์เก้าอี้' : 'เพิ่มแบรนด์เก้าอี้ใหม่'}
              </h3>
              <button 
                onClick={() => setShowBrandForm(false)}
                className="text-white/60 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveBrand} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">ชื่อแบรนด์สินค้า</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น Naturehike, DOD, Helinox"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full text-xs p-3 bg-slate-50 outline-hidden border border-slate-200 rounded-xl focus:border-emerald-700 focus:bg-white text-slate-800"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowBrandForm(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={savingForm === 'brand'}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl"
                >
                  บันทึกแบรนด์
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MODEL DIALOG */}
      {showModelForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50" id="model-modal">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-100">
            <div className="bg-slate-900 text-white p-4 px-6 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" /> {modelEditId ? 'แก้ไขข้อมูลโมเดลรุ่น' : 'เพิ่มโมเดลรุ่นสินค้าใหม่'}
              </h3>
              <button
                onClick={() => setShowModelForm(false)}
                className="text-white/60 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveModel} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">เลือกแบรนด์เก้าอี้</label>
                <select
                  value={modelBrandId}
                  onChange={(e) => setModelBrandId(e.target.value)}
                  className="w-full text-xs p-3 bg-slate-50 outline-hidden border border-slate-200 rounded-xl text-slate-800"
                  required
                >
                  {activeBrands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">ชื่อรุ่นโมเดลสินค้า</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น Folding Wooden Chair, Sugoi Chair"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full text-xs p-3 bg-slate-50 outline-hidden border border-slate-200 rounded-xl focus:border-emerald-700 focus:bg-white text-slate-800"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowModelForm(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={savingForm === 'model' || uploadingImage}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl"
                >
                  บันทึกรุ่นสินค้า
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. VARIANT DIALOG */}
      {showVariantForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50" id="variant-modal">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-100 animate-slide-up">
            <div className="bg-slate-900 text-white p-4 px-6 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <Package className="w-4 h-4" /> {variantEditId ? 'แก้ไขตัวเลือกสี/สินค้า' : 'เพิ่มตัวเลือกสีสินค้าใหม่'}
              </h3>
              <button
                onClick={() => setShowVariantForm(false)}
                className="text-white/60 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveVariant} className="p-6 space-y-4">
              {activeModels.length === 0 ? (
                <div className="text-rose-500 text-xs font-medium bg-rose-50 p-3 rounded-lg">
                  ไม่พบรหัสรุ่นสินค้ารายการใดๆ พลิกลุกสร้างรหัสรุ่นย่อยก่อนนะ!
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">เลือกแบรนด์และรุ่น</label>
                    <select
                      value={variantModelId}
                      onChange={(e) => setVariantModelId(e.target.value)}
                      className="w-full text-xs p-3 bg-slate-50 outline-hidden border border-slate-200 rounded-xl text-slate-800"
                      required
                    >
                      {activeModels.map(m => {
                        const brand = activeBrands.find(b => b.id === m.brand_id);
                        return (
                          <option key={m.id} value={m.id}>
                            [{brand?.name || 'ไม่มีแบรนด์'}] - {m.name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">สียางเก้าอี้ / ตัวเลือกสี</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น สีกากี (Khaki), สีครีม, แดงสด (Scarlet)"
                      value={variantColor}
                      onChange={(e) => setVariantColor(e.target.value)}
                      className="w-full text-xs p-3 bg-slate-50 outline-hidden border border-slate-200 rounded-xl focus:border-emerald-700 focus:bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">ราคาขายตั้งต้น (บาท)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      placeholder="เช่น 2400"
                      value={variantStandardSalePrice}
                      onChange={(e) => setVariantStandardSalePrice(e.target.value)}
                      className="w-full text-xs p-3 bg-slate-50 outline-hidden border border-slate-200 rounded-xl focus:border-emerald-700 focus:bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">รูปของสีนี้</label>
                    {variantImage ? (
                      <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-slate-200 mb-3 bg-slate-50 flex items-center justify-center">
                        <img src={variantImage} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => setVariantImage('')}
                          className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-full text-[10px] cursor-pointer shadow-md"
                          title="ลบรูปภาพ"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="w-32 h-32 rounded-xl border border-dashed border-slate-300 mb-3 bg-slate-50 flex flex-col items-center justify-center text-slate-400 gap-1">
                        <Image className="w-6 h-6 text-slate-400" />
                        <span className="text-[10px]">ไม่มีรูปภาพ</span>
                      </div>
                    )}
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="วางลิงก์รูปภาพของสีนี้ (URL)"
                        value={variantImage}
                        onChange={(e) => setVariantImage(e.target.value)}
                        className="w-full text-xs p-3 bg-slate-50 outline-hidden border border-slate-200 rounded-xl focus:border-emerald-700 focus:bg-white text-slate-800"
                      />
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          id="variant-image-file"
                          className="hidden"
                          disabled={uploadingImage}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 2 * 1024 * 1024) {
                              alert('ขนาดไฟล์ภาพใหญ่เกินไป กรุณาเลือกไม่เกิน 2MB');
                              return;
                            }
                            setUploadingImage(true);
                            try {
                              const url = await uploadVariantImage(file);
                              setVariantImage(url);
                            } catch (err: any) {
                              alert(`อัปโหลดรูปสินค้าไม่สำเร็จ: ${err.message || err}`);
                            } finally {
                              setUploadingImage(false);
                            }
                          }}
                        />
                        <label
                          htmlFor="variant-image-file"
                          className="block text-center cursor-pointer border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold py-2 px-3 text-xs rounded-xl"
                        >
                          อัปโหลดรูปสีนี้
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-50/55 rounded-xl border border-emerald-100 text-[11px] text-slate-600 leading-relaxed">
                    💡 <strong>คำแนะนำ:</strong> เมื่อเพิ่มสีหลักใหม่เป็น SKU ตัวนี้ ระบบหลังบ้านจะบันทึกราคาขายเริ่มต้นและคำนวณ WAC ทันทีเมื่อสินค้าเข้าระบบ
                  </div>
                </>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowVariantForm(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={activeModels.length === 0 || savingForm === 'variant' || uploadingImage}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white rounded-xl"
                >
                  บันทึกข้อมูลสินค้า
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. IMAGE LIGHTBOX MODAL */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-4 z-50 animate-fade-in"
          id="image-lightbox-modal"
          onClick={() => setPreviewImage(null)}
        >
          {/* Top panel: Title & Close Button */}
          <div className="w-full max-w-2xl flex justify-between items-center text-white mb-3 px-1 animate-slide-up">
            <span className="text-xs font-bold bg-emerald-700 text-white px-2.5 py-1 rounded-full uppercase tracking-tight shadow-sm">
              {previewTitle || 'ขยายรูปภาพ'}
            </span>
            <button
              onClick={() => setPreviewImage(null)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center font-bold text-sm transition-all shadow-md cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              ✕
            </button>
          </div>

          {/* Interactive Zoomable Image container */}
          <div 
            className="relative w-full max-w-2xl max-h-[75vh] flex items-center justify-center bg-slate-900/50 rounded-2xl overflow-hidden border border-white/10 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={previewImage} 
              alt={previewTitle}
              className="max-w-full max-h-[75vh] object-contain rounded-2xl select-none"
              referrerPolicy="no-referrer"
            />
          </div>

          <p className="text-[11px] text-white/50 mt-4 animate-slide-up select-none">
            คลิกพื้นที่สีดำรอบนอกเพื่อกลับเข้าสู่หน้าหลัก
          </p>
        </div>
      )}
    </div>
  );
};
