export type DiscountMethod =
  | "amount_off_products"
  | "amount_off_order"
  | "buy_x_get_y"
  | "free_shipping";

export interface PickerItem {
  _id: string;
  name: string;
}

export interface BxgyState {
  buyProducts: PickerItem[];
  buyCategories: PickerItem[];
  buyQuantity: string;
  getProducts: PickerItem[];
  getCategories: PickerItem[];
  getQuantity: string;
  getDiscountType: "percentage" | "fixed";
  getDiscountValue: string;
  maxUsesPerOrder: string;
}

export interface FormState {
  code: string;
  method: DiscountMethod;
  type: "percentage" | "fixed";
  value: string;
  minOrderAmount: string;
  usageLimit: string;
  perUserLimit: string;
  expiresAt: string;
  isActive: boolean;
  combinesWith: { product: boolean; order: boolean; shipping: boolean };
  applicableProducts: PickerItem[];
  applicableCategories: PickerItem[];
  bxgy: BxgyState;
}

export type TranslateFn = (key: string, opts?: Record<string, unknown>) => string;
