import { AppData, DashboardSummary } from '../types';

export type SetupStepId = 'brand' | 'model' | 'variant' | 'purchase' | 'sale';
export type SetupStepState = 'done' | 'current' | 'locked';
export type SetupTargetTab = 'products' | 'purchase' | 'orders';

export interface SetupStep {
  id: SetupStepId;
  label: string;
  description: string;
  ctaLabel: string;
  targetTab: SetupTargetTab;
  isComplete: boolean;
  state: SetupStepState;
}

export interface SetupProgress {
  steps: SetupStep[];
  currentStep: SetupStep | null;
  isComplete: boolean;
  activeBrandCount: number;
  activeModelCount: number;
  activeVariantCount: number;
  activeStockQty: number;
  hasPurchaseActivity: boolean;
  hasSalesActivity: boolean;
}

export type SetupProgressInput = Pick<
  AppData,
  'brands' | 'models' | 'variants' | 'stockSummary' | 'purchaseBatches' | 'orders'
> & {
  dashboardSummary?: Pick<DashboardSummary, 'stock_qty' | 'month_sales'> | null;
  purchaseTotalCount?: number;
  ordersTotalCount?: number;
};

const sumNumbers = (values: number[]) =>
  values.reduce((sum, value) => sum + Number(value || 0), 0);

export const getSetupProgress = (input: SetupProgressInput): SetupProgress => {
  const activeBrands = input.brands.filter((brand) => brand.is_active !== false);
  const activeBrandIds = new Set(activeBrands.map((brand) => brand.id));

  const activeModels = input.models.filter(
    (model) => model.is_active !== false && activeBrandIds.has(model.brand_id)
  );
  const activeModelIds = new Set(activeModels.map((model) => model.id));

  const activeVariants = input.variants.filter(
    (variant) => variant.is_active !== false && activeModelIds.has(variant.model_id)
  );

  const stockFromSummary = sumNumbers(input.stockSummary.map((item) => item.in_stock_qty));
  const stockFromVariants = sumNumbers(activeVariants.map((variant) => variant.qty_in_stock));
  const stockFromDashboard = Number(input.dashboardSummary?.stock_qty || 0);
  const activeStockQty = Math.max(stockFromSummary, stockFromVariants, stockFromDashboard);

  const purchaseTotalCount = Number(input.purchaseTotalCount || 0);
  const ordersTotalCount = Number(input.ordersTotalCount || 0);
  const hasPurchaseActivity =
    input.purchaseBatches.length > 0 || purchaseTotalCount > 0 || activeStockQty > 0;
  const hasSalesActivity =
    input.orders.length > 0 || ordersTotalCount > 0 || Number(input.dashboardSummary?.month_sales || 0) > 0;

  const definitions = [
    {
      id: 'brand',
      label: 'สร้างแบรนด์',
      description: 'เช่น Naturehike หรือแบรนด์ที่ร้านขาย',
      ctaLabel: 'สร้างแบรนด์แรก',
      targetTab: 'products',
      isComplete: activeBrands.length > 0
    },
    {
      id: 'model',
      label: 'เพิ่มรุ่น',
      description: 'ผูกรุ่นสินค้าไว้ใต้แบรนด์',
      ctaLabel: 'เพิ่มรุ่นสินค้า',
      targetTab: 'products',
      isComplete: activeModels.length > 0
    },
    {
      id: 'variant',
      label: 'เพิ่มสี/SKU',
      description: 'กำหนดสี รูป และราคาขายตั้งต้น',
      ctaLabel: 'เพิ่มสีหรือ SKU',
      targetTab: 'products',
      isComplete: activeVariants.length > 0
    },
    {
      id: 'purchase',
      label: 'รับเข้า',
      description: 'บันทึกล็อตเพื่อคำนวณ WAC และเพิ่มสต็อก',
      ctaLabel: 'รับสินค้าเข้าคลัง',
      targetTab: 'purchase',
      isComplete: hasPurchaseActivity
    },
    {
      id: 'sale',
      label: 'ขาย',
      description: 'เปิดบิลขายจากสต็อกพร้อมขาย',
      ctaLabel: 'เปิดบิลขาย',
      targetTab: 'orders',
      isComplete: hasSalesActivity
    }
  ] satisfies Omit<SetupStep, 'state'>[];

  const currentIndex = definitions.findIndex((step) => !step.isComplete);
  const steps = definitions.map((step, index): SetupStep => ({
    ...step,
    state: step.isComplete ? 'done' : index === currentIndex ? 'current' : 'locked'
  }));

  return {
    steps,
    currentStep: currentIndex === -1 ? null : steps[currentIndex],
    isComplete: currentIndex === -1,
    activeBrandCount: activeBrands.length,
    activeModelCount: activeModels.length,
    activeVariantCount: activeVariants.length,
    activeStockQty,
    hasPurchaseActivity,
    hasSalesActivity
  };
};
