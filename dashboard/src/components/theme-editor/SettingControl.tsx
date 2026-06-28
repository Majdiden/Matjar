/**
 * SettingControl — renders the correct form control based on a SectionSetting
 * schema. Built on shadcn primitives + ColorPickerPopover for a polished feel.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, X, Image as ImageIcon } from 'lucide-react';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { ChevronDown } from 'lucide-react';
import ColorPickerPopover from './ColorPickerPopover';
import type { SectionSetting } from './types';

interface SettingControlProps {
  setting: SectionSetting;
  value: unknown;
  onChange: (value: unknown) => void;
}

/**
 * Coerce an `unknown` into the string that the native form controls
 * expect. Manifest-declared defaults are typed `unknown` because the
 * setting schema is user-authored; at runtime they'll nearly always be
 * strings, numbers, or booleans. Numbers and booleans get stringified
 * so the <input> value is well-formed; object shapes fall through to
 * an empty string rather than rendering "[object Object]".
 */
function toStringValue(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  return '';
}

export default function SettingControl({ setting, value, onChange }: SettingControlProps) {
  const { t } = useTranslation('themes');
  const rawValue: unknown = value ?? setting.default ?? '';
  const currentValue = toStringValue(rawValue);
  const checkedValue = typeof rawValue === 'boolean' ? rawValue : Boolean(rawValue);
  // Manifest-declared label/info are English by default; a `settings.<id>.*`
  // key can override per-locale while falling back to the manifest string.
  const label = t(`themes:settings.${setting.id}.label`, { defaultValue: setting.label });
  const info = setting.info
    ? t(`themes:settings.${setting.id}.info`, { defaultValue: setting.info })
    : undefined;

  switch (setting.type) {
    case 'text':
      return (
        <FieldWrapper label={label} info={info}>
          <Input
            type="text"
            value={currentValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={setting.placeholder || ''}
            className="h-9 text-sm"
          />
        </FieldWrapper>
      );

    case 'textarea':
      return (
        <FieldWrapper label={label} info={info}>
          <Textarea
            value={currentValue}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder={setting.placeholder || ''}
            className="text-sm resize-y min-h-[72px]"
          />
        </FieldWrapper>
      );

    case 'number':
      return (
        <FieldWrapper label={label} info={info}>
          <Input
            type="number"
            value={currentValue}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            min={setting.min}
            max={setting.max}
            step={setting.step || 1}
            className="h-9 text-sm"
          />
        </FieldWrapper>
      );

    case 'range':
      return (
        <FieldWrapper label={label} info={info}>
          <div className="flex items-center gap-3">
            <input
              type="range"
              value={currentValue}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              min={setting.min ?? 0}
              max={setting.max ?? 100}
              step={setting.step || 1}
              className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-xs text-slate-600 font-mono w-14 text-end tabular-nums">
              {currentValue}
              {setting.unit || ''}
            </span>
          </div>
        </FieldWrapper>
      );

    case 'checkbox':
      return (
        <div className="flex items-center justify-between gap-3 py-0.5">
          <div className="min-w-0">
            <Label className="text-xs font-medium text-slate-700">{label}</Label>
            {info && (
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{info}</p>
            )}
          </div>
          <Switch checked={checkedValue} onCheckedChange={onChange} />
        </div>
      );

    case 'select':
      return (
        <FieldWrapper label={label} info={info}>
          <div className="relative">
            <select
              value={currentValue || ''}
              onChange={(e) => onChange(e.target.value)}
              className="flex h-9 w-full appearance-none rounded-md border border-slate-200 bg-white px-3 pe-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            >
              {(setting.options || []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute end-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </FieldWrapper>
      );

    case 'color':
      return (
        <FieldWrapper label={label} info={info}>
          <ColorPickerPopover value={currentValue || '#000000'} onChange={onChange} />
        </FieldWrapper>
      );

    case 'image':
      return (
        <FieldWrapper label={label} info={info}>
          <ImageInput value={currentValue} onChange={onChange} />
        </FieldWrapper>
      );

    case 'url':
      return (
        <FieldWrapper label={label} info={info}>
          <div className="relative">
            <Link2 className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="text"
              value={currentValue}
              onChange={(e) => onChange(e.target.value)}
              placeholder="/products"
              className="h-9 ps-8 text-sm"
            />
          </div>
        </FieldWrapper>
      );

    case 'collection':
    case 'product':
      return (
        <FieldWrapper
          label={label}
          info={info || t('themes:editor.control.reference.info', { type: setting.type })}
        >
          <Input
            type="text"
            value={currentValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('themes:editor.control.reference.placeholder', { type: setting.type })}
            className="h-9 text-sm"
          />
        </FieldWrapper>
      );

    default: {
      const fallback =
        typeof rawValue === 'string'
          ? rawValue
          : rawValue == null
          ? ''
          : JSON.stringify(rawValue);
      return (
        <FieldWrapper label={label} info={t('themes:editor.control.unsupported', { type: setting.type })}>
          <Input
            type="text"
            value={fallback}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 text-sm"
          />
        </FieldWrapper>
      );
    }
  }
}

// ─── Helper components ──────────────────────────────────────────────

function FieldWrapper({
  label,
  info,
  children,
}: {
  label: string;
  info?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
      {info && <p className="text-[10px] text-slate-400 leading-tight">{info}</p>}
    </div>
  );
}

function ImageInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation('themes');
  const [editing, setEditing] = useState(false);

  if (value && !editing) {
    return (
      <div className="space-y-1.5">
        <div className="relative group rounded-md overflow-hidden bg-slate-100 border border-slate-200">
          <div className="aspect-video">
            <img src={value} alt="" className="w-full h-full object-cover" />
          </div>
          <button
            onClick={() => onChange('')}
            className="absolute top-1.5 end-1.5 h-6 w-6 rounded-full bg-white/90 hover:bg-white shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
          >
            <X className="h-3 w-3 text-slate-600" />
          </button>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-[11px] text-blue-600 hover:underline"
        >
          {t('themes:editor.control.image.change')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <ImageIcon className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <Input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          placeholder="https://example.com/image.jpg"
          className="h-9 ps-8 text-sm"
          autoFocus={editing}
        />
      </div>
    </div>
  );
}
