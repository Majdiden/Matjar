import type React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { PickerField } from "./DiscountPickerField";
import type { FormState, PickerItem, TranslateFn } from "./discount-form-types";

export function DiscountAppliesToSection({
  form,
  setForm,
  allProducts,
  allCategories,
  t,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  allProducts: PickerItem[];
  allCategories: PickerItem[];
  t: TranslateFn;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('marketing.discount.form.section.applies_to')}</CardTitle>
        <CardDescription>
          {t('marketing.discount.form.section.applies_to_desc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PickerField
          label={t('marketing.discount.form.field.products_picker.label')}
          placeholder={t('marketing.discount.form.field.products_picker.placeholder')}
          options={allProducts}
          selected={form.applicableProducts}
          onChange={(next) => setForm({ ...form, applicableProducts: next })}
          noMatchesText={t('marketing.discount.form.picker_no_matches')}
        />
        <PickerField
          label={t('marketing.discount.form.field.categories_picker.label')}
          placeholder={t('marketing.discount.form.field.categories_picker.placeholder')}
          options={allCategories}
          selected={form.applicableCategories}
          onChange={(next) => setForm({ ...form, applicableCategories: next })}
          noMatchesText={t('marketing.discount.form.picker_no_matches')}
        />
      </CardContent>
    </Card>
  );
}
