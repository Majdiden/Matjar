import React from 'react';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { toast } from 'sonner';
import type { PaymentMethodField, PaymentFieldValue } from '../../../../types';

// ─── Payment field input ──────────────────────────────────────────────
// Mirrors the shape used by the storefront PaymentMethodPicker so the
// verify dialog (read-only) and the manual-refund dialog (editable) render
// the same schema — text / textarea / number / email / tel / select / file.

export const PaymentFieldInput: React.FC<{
  field: PaymentMethodField;
  value: PaymentFieldValue | undefined;
  onChange: (v: PaymentFieldValue) => void;
}> = ({ field, value, onChange }) => {
  // Narrow the polymorphic field value once per render. The field schema
  // already constrains the type, but the stored value can be any of the
  // unioned shapes depending on `field.type`.
  const stringValue =
    typeof value === 'string' ? value
    : typeof value === 'number' ? String(value)
    : '';
  const fileValue = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as { name?: string; size?: number })
    : null;
  const label = (
    <Label htmlFor={`pf-${field.name}`}>
      {field.label}
      {field.required && <span className="text-destructive ms-0.5">*</span>}
    </Label>
  );
  if (field.type === 'textarea') {
    return (
      <div className="space-y-1.5">
        {label}
        <Textarea
          id={`pf-${field.name}`}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      </div>
    );
  }
  if (field.type === 'select') {
    const opts = Array.isArray(field.options) ? field.options : [];
    return (
      <div className="space-y-1.5">
        {label}
        <select
          id={`pf-${field.name}`}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="">{field.placeholder || 'Select…'}</option>
          {opts.map((o, i) => (
            <option key={i} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    );
  }
  if (field.type === 'file') {
    return (
      <div className="space-y-1.5">
        {label}
        <Input
          id={`pf-${field.name}`}
          type="file"
          accept={field.accept}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return onChange(null);
            const max = Number(field.maxSize) || 5 * 1024 * 1024;
            if (file.size > max) {
              toast.error(`File exceeds ${(max / 1024 / 1024).toFixed(1)}MB`);
              return;
            }
            const reader = new FileReader();
            reader.onload = () =>
              onChange({
                name: file.name,
                size: file.size,
                type: file.type,
                dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
              });
            reader.readAsDataURL(file);
          }}
        />
        {fileValue?.name && (
          <p className="text-xs text-muted-foreground">
            {fileValue.name} ({Math.round((fileValue.size || 0) / 1024)} KB)
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {label}
      <Input
        id={`pf-${field.name}`}
        type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
        value={stringValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    </div>
  );
};
