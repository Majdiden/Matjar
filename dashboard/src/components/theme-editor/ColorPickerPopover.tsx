/**
 * ColorPickerPopover — swatch button that opens a popover with
 * a hex input, native color picker, and a curated palette of swatches.
 * Used by SettingControl for `color` settings.
 */
import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Input } from '../ui/input';
import { Pipette } from 'lucide-react';

interface ColorPickerPopoverProps {
  value: string;
  onChange: (value: string) => void;
  recentColors?: string[];
}

const PALETTE = [
  '#000000', '#FFFFFF', '#1E293B', '#475569', '#94A3B8', '#E2E8F0',
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#10B981', '#06B6D4',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899', '#F43F5E',
];

function isValidHex(v: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v);
}

export default function ColorPickerPopover({ value, onChange, recentColors = [] }: ColorPickerPopoverProps) {
  const safeValue = value || '#000000';
  const [hexInput, setHexInput] = useState(safeValue);

  useEffect(() => {
    setHexInput(safeValue);
  }, [safeValue]);

  const commitHex = (v: string) => {
    const trimmed = v.trim();
    if (isValidHex(trimmed)) {
      onChange(trimmed.toUpperCase());
    } else {
      setHexInput(safeValue);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full h-9 px-2 border border-slate-200 rounded-md bg-white hover:border-slate-300 transition group"
        >
          <span
            className="h-6 w-6 rounded border border-slate-200 shrink-0 shadow-sm"
            style={{ backgroundColor: safeValue }}
          />
          <span className="flex-1 text-left text-xs font-mono text-slate-700 uppercase">
            {safeValue}
          </span>
          <Pipette className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-3">
          {/* Native picker + hex input */}
          <div className="flex items-center gap-2">
            <label className="relative h-9 w-9 rounded-md overflow-hidden border border-slate-200 cursor-pointer shrink-0">
              <input
                type="color"
                value={safeValue}
                onChange={(e) => onChange(e.target.value.toUpperCase())}
                className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer p-0 border-0"
              />
            </label>
            <Input
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={(e) => commitHex(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitHex((e.target as HTMLInputElement).value);
              }}
              className="h-9 font-mono text-xs uppercase"
              placeholder="#000000"
            />
          </div>

          {/* Palette */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
              Palette
            </p>
            <div className="grid grid-cols-9 gap-1">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange(c)}
                  className="h-5 w-5 rounded border border-slate-200 hover:scale-110 transition shadow-sm"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Recent */}
          {recentColors.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                Currently used
              </p>
              <div className="grid grid-cols-9 gap-1">
                {recentColors.slice(0, 9).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChange(c)}
                    className="h-5 w-5 rounded border border-slate-200 hover:scale-110 transition shadow-sm"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
