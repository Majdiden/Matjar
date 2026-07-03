import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { PickerField } from "./DiscountPickerField";
import type { BxgyState, FormState, PickerItem, TranslateFn } from "./discount-form-types";

export function DiscountBxgySections({
  form,
  setBxgy,
  allProducts,
  allCategories,
  t,
}: {
  form: FormState;
  setBxgy: <K extends keyof BxgyState>(k: K, v: BxgyState[K]) => void;
  allProducts: PickerItem[];
  allCategories: PickerItem[];
  t: TranslateFn;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('marketing.discount.form.section.customer_buys')}</CardTitle>
          <CardDescription>{t('marketing.discount.form.section.customer_buys_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('marketing.discount.form.field.bxgy_buy_quantity.label')}</Label>
            <Input
              type="number"
              min="1"
              value={form.bxgy.buyQuantity}
              onChange={(e) => setBxgy("buyQuantity", e.target.value)}
            />
          </div>
          <PickerField
            label={t('marketing.discount.form.field.bxgy_buy_products.label')}
            placeholder={t('marketing.discount.form.field.products_picker.placeholder')}
            options={allProducts}
            selected={form.bxgy.buyProducts}
            onChange={(next) => setBxgy("buyProducts", next)}
            noMatchesText={t('marketing.discount.form.picker_no_matches')}
          />
          <PickerField
            label={t('marketing.discount.form.field.bxgy_buy_categories.label')}
            placeholder={t('marketing.discount.form.field.categories_picker.placeholder')}
            options={allCategories}
            selected={form.bxgy.buyCategories}
            onChange={(next) => setBxgy("buyCategories", next)}
            noMatchesText={t('marketing.discount.form.picker_no_matches')}
          />
          <p className="text-xs text-muted-foreground">
            {t('marketing.discount.form.field.bxgy_buy_any_hint')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('marketing.discount.form.section.customer_gets')}</CardTitle>
          <CardDescription>{t('marketing.discount.form.section.customer_gets_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('marketing.discount.form.field.bxgy_get_quantity.label')}</Label>
              <Input
                type="number"
                min="1"
                value={form.bxgy.getQuantity}
                onChange={(e) => setBxgy("getQuantity", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('marketing.discount.form.field.bxgy_max_uses.label')}</Label>
              <Input
                type="number"
                min="1"
                value={form.bxgy.maxUsesPerOrder}
                onChange={(e) => setBxgy("maxUsesPerOrder", e.target.value)}
                placeholder={t('marketing.discount.form.field.bxgy_max_uses.placeholder')}
              />
            </div>
          </div>
          <PickerField
            label={t('marketing.discount.form.field.bxgy_get_products.label')}
            placeholder={t('marketing.discount.form.field.products_picker.placeholder')}
            options={allProducts}
            selected={form.bxgy.getProducts}
            onChange={(next) => setBxgy("getProducts", next)}
            noMatchesText={t('marketing.discount.form.picker_no_matches')}
          />
          <PickerField
            label={t('marketing.discount.form.field.bxgy_get_categories.label')}
            placeholder={t('marketing.discount.form.field.categories_picker.placeholder')}
            options={allCategories}
            selected={form.bxgy.getCategories}
            onChange={(next) => setBxgy("getCategories", next)}
            noMatchesText={t('marketing.discount.form.picker_no_matches')}
          />
          <div className="space-y-2">
            <Label>{t('marketing.discount.form.field.bxgy_discount_type.label')}</Label>
            <div className="grid grid-cols-2 gap-4">
              <Select
                value={form.bxgy.getDiscountType}
                onChange={(e) => setBxgy("getDiscountType", e.target.value as "percentage" | "fixed")}
                options={[
                  { value: "percentage", label: t('marketing.discount.form.type_option.percentage') },
                  { value: "fixed", label: t('marketing.discount.form.type_option.fixed') },
                ]}
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.bxgy.getDiscountValue}
                onChange={(e) => setBxgy("getDiscountValue", e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('marketing.discount.form.field.bxgy_free_hint')}
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
