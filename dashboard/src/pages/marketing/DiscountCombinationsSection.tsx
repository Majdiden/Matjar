import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import type { FormState, TranslateFn } from "./discount-form-types";

export function DiscountCombinationsSection({
  form,
  setCombines,
  t,
}: {
  form: FormState;
  setCombines: (k: keyof FormState["combinesWith"], v: boolean) => void;
  t: TranslateFn;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('marketing.discount.form.section.combinations')}</CardTitle>
        <CardDescription>
          {t('marketing.discount.form.section.combinations_desc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(["product", "order", "shipping"] as const).map((k) => (
          <label key={k} className="flex items-center justify-between gap-3 text-sm">
            <span className="capitalize">{t('marketing.discount.form.field.combines_with', { kind: k })}</span>
            <Switch
              checked={form.combinesWith[k]}
              onCheckedChange={(v) => setCombines(k, v)}
            />
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
