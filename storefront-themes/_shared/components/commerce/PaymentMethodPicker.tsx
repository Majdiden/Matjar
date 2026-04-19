import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { paymentMethodsApi, PaymentMethodPublic, PaymentMethodField } from '../../api/client';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';
import PaymentLogo from './PaymentLogo';

export const SLOT_KEY = 'paymentMethodPicker';

interface Props {
  value: string | null;
  onChange: (code: string) => void;
  fieldValues: Record<string, any>;
  onFieldChange: (values: Record<string, any>) => void;
  submitted?: boolean;
  accentColor?: string;
  className?: string;
}

const DEFAULT_MAX = 5 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const PaymentMethodPicker: React.FC<Props> = (props) => {
  const Override = useThemeSlot<React.ComponentType<Props>>(SLOT_KEY);
  if (Override) return <Override {...props} />;

  const {
    value,
    onChange,
    fieldValues,
    onFieldChange,
    submitted = false,
    accentColor,
    className = '',
  } = props;

  const { t } = useTranslation(['product', 'common']);
  const accent = accentColor || 'var(--color-primary, #2563eb)';

  const [methods, setMethods] = useState<PaymentMethodPublic[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    paymentMethodsApi
      .list()
      .then((res: any) => {
        if (cancelled) return;
        const list: PaymentMethodPublic[] =
          res?.data?.methods || res?.responseObject?.methods || res?.methods || [];
        setMethods(list);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load payment methods.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = methods?.find((m) => m.code === value) || null;

  const setField = (name: string, v: any) => {
    onFieldChange({ ...fieldValues, [name]: v });
  };

  const handleFile = (field: PaymentMethodField, file: File | null) => {
    setFileErrors((p) => {
      const { [field.name]: _, ...rest } = p;
      return rest;
    });
    if (!file) {
      setField(field.name, null);
      return;
    }
    const max = field.maxSize || DEFAULT_MAX;
    if (file.size > max) {
      setFileErrors((p) => ({ ...p, [field.name]: `File too large. Max ${formatBytes(max)}.` }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setField(field.name, {
        name: file.name,
        type: file.type,
        size: file.size,
        data: reader.result as string,
      });
    };
    reader.onerror = () => {
      setFileErrors((p) => ({ ...p, [field.name]: 'Could not read file.' }));
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 rounded-lg border animate-pulse"
            style={{ borderColor: 'var(--color-border, #e5e7eb)', backgroundColor: 'var(--color-surface, #f9fafb)' }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm ${className}`}>
        {error}
      </div>
    );
  }

  if (!methods || methods.length === 0) {
    return (
      <div
        className={`rounded-lg border px-4 py-6 text-sm text-center ${className}`}
        style={{ borderColor: 'var(--color-border, #e5e7eb)', color: 'var(--color-muted, #6b7280)' }}
      >
        {t('payment.no_methods')}
      </div>
    );
  }

  const sorted = [...methods].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const inputClass =
    'w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:border-transparent';
  const inputStyle: React.CSSProperties = { '--tw-ring-color': accent } as React.CSSProperties;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="space-y-2">
        {sorted.map((method) => {
          const isSelected = method.code === value;
          const logos =
            method.providerLogos && method.providerLogos.length > 0
              ? method.providerLogos
              : [method.icon || method.code];
          return (
            <label
              key={method.code}
              className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition ${
                isSelected ? 'ring-2' : 'hover:bg-gray-50'
              }`}
              style={
                isSelected
                  ? ({ borderColor: accent, '--tw-ring-color': accent } as React.CSSProperties)
                  : { borderColor: 'var(--color-border, #e5e7eb)' }
              }
            >
              <div className="flex items-center gap-1 shrink-0">
                {logos.slice(0, 4).map((l, i) => (
                  <PaymentLogo key={`${method.code}-${l}-${i}`} code={l} />
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm" style={{ color: 'var(--color-text, #111827)' }}>
                  {method.label}
                </p>
                {method.description && (
                  <p className="text-xs" style={{ color: 'var(--color-muted, #6b7280)' }}>
                    {method.description}
                  </p>
                )}
              </div>
              <input
                type="radio"
                name="payment-method"
                value={method.code}
                checked={isSelected}
                onChange={() => onChange(method.code)}
                className="w-4 h-4"
              />
            </label>
          );
        })}
      </div>

      {selected && selected.type === 'manual' && selected.providers && selected.providers.length > 0 && (
        <div
          className="rounded-lg border p-4 space-y-3"
          style={{ borderColor: 'var(--color-border, #e5e7eb)', backgroundColor: 'var(--color-surface, #f9fafb)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--color-text, #111827)' }}>
            {t('payment.choose_provider')}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {selected.providers.map((p) => {
              const isPicked = fieldValues.providerCode === p.code;
              return (
                <button
                  type="button"
                  key={p.code}
                  onClick={() => onFieldChange({ ...fieldValues, providerCode: p.code })}
                  className={`group relative flex flex-col items-center justify-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 w-full ${isPicked ? 'border-2' : 'border-2 border-transparent hover:-translate-y-0.5 hover:shadow-sm'}`}
                  style={{
                    borderColor: isPicked ? accent : 'transparent',
                    backgroundColor: 'white',
                  }}
                  aria-pressed={isPicked}
                >
                  {isPicked && (
                    <span
                      className="absolute top-0 end-0 w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: accent }}
                    >
                      ✓
                    </span>
                  )}
                  {p.logo && /^(https?:|\/)/.test(p.logo) && (
                    <img
                      src={p.logo}
                      alt=""
                      className="w-10 h-10 object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <span
                    className={`text-sm text-center ${isPicked ? 'font-semibold' : 'font-medium'}`}
                    style={{ color: isPicked ? accent : 'var(--color-text, #111827)' }}
                  >
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>
          {submitted && !fieldValues.providerCode && (
            <p className="text-xs text-red-600">{t('payment.please_choose_provider')}</p>
          )}

          {(() => {
            const picked = selected.providers!.find(p => p.code === fieldValues.providerCode);
            if (!picked) return null;
            return (
              <div className="rounded-md border bg-white p-3 text-sm space-y-1" style={{ borderColor: 'var(--color-border, #e5e7eb)' }}>
                <p className="font-medium" style={{ color: 'var(--color-text, #111827)' }}>{t('payment.transfer_to')}</p>
                {picked.beneficiaryName && (
                  <div><span className="text-xs" style={{ color: 'var(--color-muted, #6b7280)' }}>{t('payment.beneficiary')}</span> <strong>{picked.beneficiaryName}</strong></div>
                )}
                {picked.accountNumber && (
                  <div><span className="text-xs" style={{ color: 'var(--color-muted, #6b7280)' }}>{t('payment.account')}</span> <strong className="font-mono">{picked.accountNumber}</strong></div>
                )}
                {picked.phone && (
                  <div><span className="text-xs" style={{ color: 'var(--color-muted, #6b7280)' }}>{t('payment.phone')}</span> <strong className="font-mono">{picked.phone}</strong></div>
                )}
                {picked.instructions && (
                  <p className="text-xs mt-2" style={{ color: 'var(--color-muted, #6b7280)' }}>{picked.instructions}</p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {selected && selected.customerFields && selected.customerFields.length > 0 && (selected.type !== 'manual' || fieldValues.providerCode) && (
        <div
          className="rounded-lg border p-4 space-y-3"
          style={{ borderColor: 'var(--color-border, #e5e7eb)', backgroundColor: 'var(--color-surface, #f9fafb)' }}
        >
          {selected.instructions && (
            <div className="prose prose-sm whitespace-pre-line text-sm" style={{ color: 'var(--color-text, #111827)' }}>
              {selected.instructions}
            </div>
          )}

          {selected.customerFields.map((field) => {
            const v = fieldValues[field.name];
            const missing = submitted && field.required && !v;
            const labelEl = (
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text, #111827)' }}>
                {field.label}
                {field.required && <span className="text-red-600 ms-1">*</span>}
              </label>
            );

            if (field.type === 'textarea') {
              return (
                <div key={field.name}>
                  {labelEl}
                  <textarea
                    rows={3}
                    placeholder={field.placeholder}
                    value={v || ''}
                    onChange={(e) => setField(field.name, e.target.value)}
                    className={`${inputClass} resize-none`}
                    style={inputStyle}
                  />
                  {missing && <p className="text-xs text-red-600 mt-1">{t('payment.required')}</p>}
                </div>
              );
            }

            if (field.type === 'select') {
              return (
                <div key={field.name}>
                  {labelEl}
                  <select
                    value={v || ''}
                    onChange={(e) => setField(field.name, e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  >
                    <option value="">{field.placeholder || 'Select...'}</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {missing && <p className="text-xs text-red-600 mt-1">{t('payment.required')}</p>}
                </div>
              );
            }

            if (field.type === 'file') {
              const fileErr = fileErrors[field.name];
              return (
                <div key={field.name}>
                  {labelEl}
                  {v && v.name ? (
                    <div
                      className="flex items-center justify-between px-3 py-2 border rounded-md text-sm"
                      style={{ borderColor: 'var(--color-border, #e5e7eb)' }}
                    >
                      <span className="truncate">
                        {v.name}{' '}
                        <span className="text-xs" style={{ color: 'var(--color-muted, #6b7280)' }}>
                          ({formatBytes(v.size)})
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setField(field.name, null)}
                        className="text-xs underline ms-2"
                        style={{ color: accent }}
                      >
                        {t('common:action.remove')}
                      </button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept={field.accept}
                      onChange={(e) => handleFile(field, e.target.files?.[0] || null)}
                      className="block w-full text-sm"
                    />
                  )}
                  {fileErr && <p className="text-xs text-red-600 mt-1">{fileErr}</p>}
                  {missing && !fileErr && <p className="text-xs text-red-600 mt-1">Required</p>}
                </div>
              );
            }

            const inputType =
              field.type === 'email'
                ? 'email'
                : field.type === 'tel'
                  ? 'tel'
                  : field.type === 'number'
                    ? 'number'
                    : 'text';

            return (
              <div key={field.name}>
                {labelEl}
                <input
                  type={inputType}
                  placeholder={field.placeholder}
                  value={v ?? ''}
                  onChange={(e) => setField(field.name, e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
                {missing && <p className="text-xs text-red-600 mt-1">Required</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PaymentMethodPicker;
