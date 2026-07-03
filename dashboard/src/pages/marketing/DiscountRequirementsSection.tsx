import type React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import type { FormState, TranslateFn } from "./discount-form-types";

export function DiscountRequirementsSection({
  form,
  setForm,
  t,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  t: TranslateFn;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('marketing.discount.form.section.requirements')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('marketing.discount.form.field.min_order_amount.label')}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.minOrderAmount}
              onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
              placeholder={t('marketing.discount.form.field.min_order_amount.placeholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('marketing.discount.form.field.usage_limit.label')}</Label>
            <Input
              type="number"
              min="1"
              value={form.usageLimit}
              onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
              placeholder={t('marketing.discount.form.field.usage_limit.placeholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('marketing.discount.form.field.per_user_limit.label')}</Label>
            <Input
              type="number"
              min="1"
              value={form.perUserLimit}
              onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
              placeholder={t('marketing.discount.form.field.per_user_limit.placeholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('marketing.discount.form.field.expires_at.label')}</Label>
            <Input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
