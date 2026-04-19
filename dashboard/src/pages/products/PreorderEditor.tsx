import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Button } from '../../components/ui/button';
import { ChevronDown } from 'lucide-react';
import type { PreorderConfig } from '../../types';

/**
 * Pre-order configuration card.
 *
 * Lets a merchant turn pre-orders on for a product (or variant) and pin
 * down the customer-facing promise: when units will ship, how many
 * reservations to accept in total, how many per customer, and whether
 * the card is charged immediately or deferred until ship date.
 *
 * `unitsReserved` is server-managed — we render it as a read-only badge
 * so the merchant can see how much capacity has been consumed but cannot
 * tamper with the counter.
 */
interface Props {
  value: PreorderConfig | undefined;
  onChange: (next: PreorderConfig) => void;
  /** Title shown in the card header — defaults to "Pre-orders". */
  title?: string;
  description?: string;
}

export const PreorderEditor: React.FC<Props> = ({
  value,
  onChange,
  title,
  description,
}) => {
  const { t } = useTranslation(['products']);
  const resolvedTitle = title ?? t('products.preorder.title');
  const resolvedDescription = description ?? t('products.preorder.description');
  const POLICY_LABEL: Record<NonNullable<PreorderConfig['chargePolicy']>, string> = {
    now: t('products.preorder.field.charge_policy.now'),
    on_ship: t('products.preorder.field.charge_policy.on_ship'),
  };
  const cfg: PreorderConfig = value || {};
  const enabled = !!cfg.enabled;

  const patch = (changes: Partial<PreorderConfig>) => {
    onChange({ ...cfg, ...changes });
  };

  // Render the date as YYYY-MM-DD for the native input. Anything we
  // can't parse falls back to empty so the input doesn't choke.
  const dateValue = (() => {
    if (!cfg.expectedShipDate) return '';
    const d = new Date(cfg.expectedShipDate);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>{resolvedTitle}</span>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => patch({ enabled: checked })}
          />
        </CardTitle>
        <CardDescription>{resolvedDescription}</CardDescription>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('products.preorder.field.expected_ship_date.label')}</Label>
              <Input
                type="date"
                value={dateValue}
                onChange={(e) =>
                  patch({ expectedShipDate: e.target.value || null })
                }
              />
              <p className="text-xs text-muted-foreground">
                {t('products.preorder.field.expected_ship_date.help')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('products.preorder.field.charge_policy.label')}</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {POLICY_LABEL[cfg.chargePolicy || 'now']}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => patch({ chargePolicy: 'now' })}>
                    {POLICY_LABEL.now}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => patch({ chargePolicy: 'on_ship' })}>
                    {POLICY_LABEL.on_ship}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('products.preorder.field.max_units.label')}</Label>
              <Input
                type="number"
                min={0}
                placeholder={t('products.preorder.field.max_units.placeholder')}
                value={cfg.maxUnits ?? ''}
                onChange={(e) =>
                  patch({
                    maxUnits: e.target.value === '' ? null : parseInt(e.target.value, 10),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                {t('products.preorder.field.max_units.help', { reserved: cfg.unitsReserved || 0 })}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('products.preorder.field.max_per_customer.label')}</Label>
              <Input
                type="number"
                min={1}
                placeholder={t('products.preorder.field.max_per_customer.placeholder')}
                value={cfg.maxPerCustomer ?? ''}
                onChange={(e) =>
                  patch({
                    maxPerCustomer:
                      e.target.value === '' ? null : parseInt(e.target.value, 10),
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
