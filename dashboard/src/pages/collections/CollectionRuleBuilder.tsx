import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { Plus, X, Eye } from 'lucide-react';
import type { Product } from './CollectionProductPicker';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Rule {
  field: string;
  operator: string;
  value: string;
}

// ─── Constants (values only — labels built from t() inside component) ─────────

const RULE_FIELDS_VALUES = [
  { value: 'title',     type: 'string' },
  { value: 'tag',       type: 'string' },
  { value: 'price',     type: 'number' },
  { value: 'inventory', type: 'number' },
  { value: 'category',  type: 'string' },
];

const STRING_OPERATOR_VALUES = ['equals', 'not_equals', 'contains', 'starts_with', 'ends_with', 'in'];
const NUMBER_OPERATOR_VALUES = ['equals', 'not_equals', 'greater_than', 'less_than'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fieldType(fieldValue: string): 'string' | 'number' {
  const f = RULE_FIELDS_VALUES.find((r) => r.value === fieldValue);
  return (f?.type as 'string' | 'number') || 'string';
}

export function defaultOperatorFor(fieldValue: string): string {
  return fieldType(fieldValue) === 'number' ? NUMBER_OPERATOR_VALUES[0] : STRING_OPERATOR_VALUES[0];
}

// ─── Rule builder card (smart collections) ────────────────────────────────────

interface CollectionRuleBuilderProps {
  rules: Rule[];
  rulesMatch: 'all' | 'any';
  isEdit: boolean;
  onRulesMatchChange: (value: 'all' | 'any') => void;
  onAddRule: () => void;
  onUpdateRule: (index: number, patch: Partial<Rule>) => void;
  onRemoveRule: (index: number) => void;
  onPreview: () => void;
}

export const CollectionRuleBuilder: React.FC<CollectionRuleBuilderProps> = ({
  rules,
  rulesMatch,
  isEdit,
  onRulesMatchChange,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  onPreview,
}) => {
  const { t } = useTranslation(['products', 'common']);

  // Build translated label arrays inside the component so t() is available
  const RULE_FIELDS = RULE_FIELDS_VALUES.map((f) => ({
    ...f,
    label: t(`products.collections.form.rules.field.${f.value}`),
  }));

  const STRING_OPERATORS = STRING_OPERATOR_VALUES.map((v) => ({
    value: v,
    label: t(`products.collections.form.rules.operator.${v}`),
  }));

  const NUMBER_OPERATORS = NUMBER_OPERATOR_VALUES.map((v) => ({
    value: v,
    label: t(`products.collections.form.rules.operator.${v}`),
  }));

  function operatorsFor(fieldValue: string) {
    return fieldType(fieldValue) === 'number' ? NUMBER_OPERATORS : STRING_OPERATORS;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('products.collections.form.section.rules')}</CardTitle>
          {isEdit && (
            <Button size="sm" variant="outline" onClick={onPreview}>
              <Eye className="h-4 w-4 me-1" />{t('products.collections.form.preview.button')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Match toggle */}
        <div className="flex items-center gap-3 text-sm">
          <span>{t('products.collections.form.rules.match_prefix')}</span>
          <Select
            value={rulesMatch}
            onValueChange={(v: 'all' | 'any') => onRulesMatchChange(v)}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ALL</SelectItem>
              <SelectItem value="any">ANY</SelectItem>
            </SelectContent>
          </Select>
          <span>of the conditions</span>
        </div>

        {/* Rule rows */}
        {rules.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('products.collections.form.rules.no_rules')}</p>
        )}
        {rules.map((rule, i) => {
          const ops = operatorsFor(rule.field);
          return (
            <div key={i} className="flex gap-2 items-center flex-wrap">
              {/* Field */}
              <Select value={rule.field} onValueChange={(v) => onUpdateRule(i, { field: v })}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_FIELDS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Operator */}
              <Select value={rule.operator} onValueChange={(v) => onUpdateRule(i, { operator: v })}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ops.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Value */}
              <Input
                className="w-44"
                value={rule.value}
                onChange={(e) => onUpdateRule(i, { value: e.target.value })}
                placeholder={fieldType(rule.field) === 'number' ? '0' : 'value'}
                type={fieldType(rule.field) === 'number' ? 'number' : 'text'}
              />

              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onRemoveRule(i)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}

        <Button variant="secondary" size="sm" onClick={onAddRule}>
          <Plus className="h-4 w-4 me-1" />Add condition
        </Button>
      </CardContent>
    </Card>
  );
};

// ─── Smart preview dialog ─────────────────────────────────────────────────────

interface CollectionPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  loading: boolean;
}

export const CollectionPreviewDialog: React.FC<CollectionPreviewDialogProps> = ({
  open,
  onOpenChange,
  products,
  loading,
}) => {
  const { t } = useTranslation(['products', 'common']);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('products.collections.preview.title')}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('products.collections.preview.no_products')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('products.collections.preview.column.product')}</TableHead>
                  <TableHead>{t('products.collections.preview.column.price')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p.images?.[0] && (
                          <img src={p.images[0]} alt={p.name} className="h-8 w-8 rounded object-cover" />
                        )}
                        <span className="text-sm">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">${p.price?.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t('common:action.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
