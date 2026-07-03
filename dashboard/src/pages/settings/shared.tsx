/**
 * Shared helpers + types for the settings tab components.
 * Extracted from the former monolithic pages/Settings.tsx (audit 3.2) —
 * extraction only, no behaviour change.
 */
import React from 'react';
import { Switch } from '../../components/ui/switch';

// Thrown errors from api-client are opaque (could be the server's JSON
// error body, a plain string message, or anything else). Narrow through
// a tiny helper so we don't have to spray `any` across catch blocks.
export const errorMessage = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  if (typeof err === 'string') return err;
  return fallback;
};

export interface CurrencyConfig {
  base: string;
  rates: Record<string, number>;
  ratesUpdatedAt?: string;
}

/** State shape shared by the General and Regional tabs (single bulk PUT). */
export interface GeneralSettingsState {
  storeName: string;
  storeDescription: string;
  logo: string;
  favicon: string;
  currency: string;
  timezone: string;
  language: string;
}

export type ShippingType = 'flat' | 'weight' | 'zone' | 'free';

export const FlagRow: React.FC<{
  label: string; description: string; checked: boolean;
  onCheckedChange: (v: boolean) => void; disabled?: boolean;
}> = ({ label, description, checked, onCheckedChange, disabled }) => (
  <div className="flex items-start justify-between gap-4 border rounded-md p-3">
    <div className="min-w-0">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </div>
);
