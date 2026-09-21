import React, { useEffect } from 'react';
import { findVariant, type Variant, type VariantOption } from '@matjar/theme-shared/components/commerce/VariantPicker';

interface Props {
  options: VariantOption[];
  variants: Variant[];
  selection: Record<string, string>;
  onSelectionChange: (s: Record<string, string>) => void;
  onVariantChange: (v: Variant | null) => void;
}

/**
 * Variant axes as square pill buttons with the chosen value echoed into the
 * label ("Skin type: Dry"). Values with no in-stock combination given the
 * rest of the selection are dimmed but stay selectable. The first value of
 * every axis is preselected so single-variant products never block the CTA.
 */
export const PillVariantPicker: React.FC<Props> = ({ options, variants, selection, onSelectionChange, onVariantChange }) => {
  useEffect(() => {
    if (options.every((o) => selection[o.name])) return;
    const next = { ...selection };
    for (const o of options) if (!next[o.name] && o.values[0]) next[o.name] = o.values[0];
    onSelectionChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  useEffect(() => { onVariantChange(findVariant(variants, selection, options)); }, [variants, selection, options, onVariantChange]);

  const available = (axis: string, value: string) =>
    variants.some((v) =>
      v.optionValues.some((ov) => ov.name === axis && ov.value === value) &&
      Object.entries(selection).every(([n, val]) => n === axis || v.optionValues.some((ov) => ov.name === n && ov.value === val)) &&
      v.stock > 0
    );

  return (
    <div className="space-y-5">
      {options.map((axis) => (
        <fieldset key={axis.name}>
          <legend className="mb-2.5 text-[0.95rem] text-ink">
            <span className="text-dune">{axis.name}:</span> <span className="font-bold">{selection[axis.name] || '—'}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {axis.values.map((value) => {
              const on = selection[axis.name] === value;
              const ok = available(axis.name, value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onSelectionChange({ ...selection, [axis.name]: value })}
                  className={`min-w-[3rem] border px-4 py-2 text-sm transition-colors duration-300 ${
                    on ? 'border-ink bg-ink text-cream' : 'border-line bg-transparent text-ink hover:border-ink'
                  } ${ok ? '' : 'line-through decoration-dune opacity-60'}`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
};

export default PillVariantPicker;
