import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { Plus, Trash2, RefreshCw, Layers, X } from 'lucide-react';
import type { ProductOption, ProductVariant } from '../../types';

interface VariantEditorProps {
  hasVariants: boolean;
  options: ProductOption[];
  variants: ProductVariant[];
  basePrice: number;
  onChange: (next: {
    hasVariants: boolean;
    options: ProductOption[];
    variants: ProductVariant[];
  }) => void;
}

/**
 * Cartesian product of every option's values. Used to materialise the
 * full variant matrix when the merchant clicks "Generate variants".
 */
function cartesian(options: ProductOption[]): { name: string; value: string }[][] {
  if (!options.length) return [];
  return options.reduce<{ name: string; value: string }[][]>(
    (acc, opt) => {
      const cleanValues = opt.values.map((v) => v.trim()).filter(Boolean);
      if (!cleanValues.length) return acc;
      const next: { name: string; value: string }[][] = [];
      for (const row of acc) {
        for (const value of cleanValues) {
          next.push([...row, { name: opt.name, value }]);
        }
      }
      return next;
    },
    [[]],
  );
}

/** Stable string key for a variant's option values, used for matrix de-dup. */
function variantKey(optionValues: { name: string; value: string }[]) {
  return optionValues.map((o) => `${o.name}=${o.value}`).join('|');
}

export const VariantEditor: React.FC<VariantEditorProps> = ({
  hasVariants,
  options,
  variants,
  basePrice,
  onChange,
}) => {
  const { t } = useTranslation(['products', 'common']);
  const generatedRows = useMemo(() => cartesian(options), [options]);

  const update = (patch: Partial<{ hasVariants: boolean; options: ProductOption[]; variants: ProductVariant[] }>) => {
    onChange({
      hasVariants: patch.hasVariants ?? hasVariants,
      options: patch.options ?? options,
      variants: patch.variants ?? variants,
    });
  };

  const toggleVariants = (next: boolean) => {
    if (next) {
      // Seed with one option axis so the merchant has somewhere to type.
      const seedOptions = options.length ? options : [{ name: 'Size', values: [] }];
      update({ hasVariants: true, options: seedOptions });
    } else {
      // Wipe option/variant state when turning the feature off so we
      // don't ship phantom data on the next save.
      update({ hasVariants: false, options: [], variants: [] });
    }
  };

  const addOption = () => {
    update({ options: [...options, { name: '', values: [] }] });
  };

  const removeOption = (idx: number) => {
    const nextOptions = options.filter((_, i) => i !== idx);
    update({ options: nextOptions });
  };

  const updateOptionName = (idx: number, name: string) => {
    const next = options.map((o, i) => (i === idx ? { ...o, name } : o));
    update({ options: next });
  };

  const addOptionValue = (idx: number, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const next = options.map((o, i) =>
      i === idx && !o.values.includes(trimmed) ? { ...o, values: [...o.values, trimmed] } : o,
    );
    update({ options: next });
  };

  const removeOptionValue = (idx: number, value: string) => {
    const next = options.map((o, i) =>
      i === idx ? { ...o, values: o.values.filter((v) => v !== value) } : o,
    );
    update({ options: next });
  };

  /**
   * Materialise (or refresh) the variant matrix from the current option
   * axes. Existing variants are preserved by their option-value key, so
   * the merchant doesn't lose stock/SKU when they add a new size.
   */
  const generateMatrix = () => {
    const cleanedOptions = options
      .map((o) => ({ name: o.name.trim(), values: o.values.map((v) => v.trim()).filter(Boolean) }))
      .filter((o) => o.name && o.values.length);
    if (!cleanedOptions.length) {
      update({ variants: [] });
      return;
    }
    const rows = cartesian(cleanedOptions);
    const existingByKey = new Map(variants.map((v) => [variantKey(v.optionValues || []), v]));
    const next: ProductVariant[] = rows.map((row, position) => {
      const key = variantKey(row);
      const existing = existingByKey.get(key);
      if (existing) return { ...existing, optionValues: row, position };
      return {
        optionValues: row,
        sku: '',
        stock: 0,
        position,
      };
    });
    update({ options: cleanedOptions, variants: next });
  };

  const updateVariant = (idx: number, patch: Partial<ProductVariant>) => {
    const next = variants.map((v, i) => (i === idx ? { ...v, ...patch } : v));
    update({ variants: next });
  };

  const removeVariant = (idx: number) => {
    const next = variants.filter((_, i) => i !== idx);
    update({ variants: next });
  };

  const totalVariantStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" /> {t('products.variants.title')}
            </CardTitle>
            <CardDescription>
              {t('products.variants.description')}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="hasVariants" className="text-sm cursor-pointer">
              {hasVariants ? t('products.variants.enabled') : t('products.variants.disabled')}
            </Label>
            <Switch id="hasVariants" checked={hasVariants} onCheckedChange={toggleVariants} />
          </div>
        </div>
      </CardHeader>

      {hasVariants && (
        <CardContent className="space-y-6">
          {/* Option axes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {t('products.variants.option_axes_label')}
              </Label>
              <Button type="button" variant="ghost" size="sm" onClick={addOption}>
                <Plus className="h-3.5 w-3.5 me-1" /> {t('products.variants.add_option')}
              </Button>
            </div>
            {options.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                {t('products.variants.first_option_hint')}
              </p>
            )}
            {options.map((opt, idx) => (
              <OptionRow
                key={idx}
                option={opt}
                onNameChange={(name) => updateOptionName(idx, name)}
                onAddValue={(value) => addOptionValue(idx, value)}
                onRemoveValue={(value) => removeOptionValue(idx, value)}
                onRemove={() => removeOption(idx)}
              />
            ))}
          </div>

          {/* Generate matrix */}
          <div className="flex items-center justify-between rounded-md border border-dashed bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">
              {generatedRows.length > 0
                ? t('products.variants.combinations', { count: generatedRows.length })
                : t('products.variants.add_values_hint')}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={generatedRows.length === 0}
              onClick={generateMatrix}
            >
              <RefreshCw className="h-3.5 w-3.5 me-1" />
              {variants.length ? t('products.variants.refresh') : t('products.variants.generate')}
            </Button>
          </div>

          {/* Variant matrix */}
          {variants.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t('products.variants.variants_label', { count: variants.length })}
                </Label>
                <span className="text-xs text-muted-foreground">
                  {t('products.variants.total_stock')}: <span className="font-semibold text-foreground">{totalVariantStock}</span>
                </span>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="p-2 text-start font-medium">{t('products.variants.column.variant')}</th>
                      <th className="p-2 text-start font-medium">{t('products.variants.column.sku')}</th>
                      <th className="p-2 text-start font-medium">{t('products.variants.column.price')}</th>
                      <th className="p-2 text-start font-medium">{t('products.variants.column.stock')}</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((variant, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {variant.optionValues.map((ov) => (
                              <Badge key={`${ov.name}-${ov.value}`} variant="secondary" className="text-[10px]">
                                {ov.name}: {ov.value}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-2">
                          <Input
                            placeholder="SKU"
                            value={variant.sku || ''}
                            onChange={(e) => updateVariant(idx, { sku: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={basePrice ? String(basePrice) : '—'}
                            value={variant.price ?? ''}
                            onChange={(e) =>
                              updateVariant(idx, {
                                price: e.target.value === '' ? undefined : parseFloat(e.target.value),
                              })
                            }
                            className="h-8 text-xs w-24"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            value={variant.stock}
                            onChange={(e) => updateVariant(idx, { stock: parseInt(e.target.value) || 0 })}
                            className="h-8 text-xs w-20"
                          />
                        </td>
                        <td className="p-2 text-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeVariant(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('products.variants.price_inherit_help')}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

// ─── Inline option row ───────────────────────────────────────────────

const OptionRow: React.FC<{
  option: ProductOption;
  onNameChange: (name: string) => void;
  onAddValue: (value: string) => void;
  onRemoveValue: (value: string) => void;
  onRemove: () => void;
}> = ({ option, onNameChange, onAddValue, onRemoveValue, onRemove }) => {
  const { t } = useTranslation(['products']);
  const [draft, setDraft] = React.useState('');

  const commit = () => {
    if (!draft.trim()) return;
    onAddValue(draft);
    setDraft('');
  };

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder={t('products.variants.option_name_placeholder')}
          value={option.name}
          onChange={(e) => onNameChange(e.target.value)}
          className="h-8 text-sm flex-1"
        />
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {option.values.map((value) => (
          <Badge key={value} variant="secondary" className="gap-1 text-xs">
            {value}
            <button type="button" onClick={() => onRemoveValue(value)} className="opacity-60 hover:opacity-100">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          placeholder={t('products.variants.add_value_placeholder')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          className="h-7 text-xs w-40"
        />
      </div>
    </div>
  );
};
