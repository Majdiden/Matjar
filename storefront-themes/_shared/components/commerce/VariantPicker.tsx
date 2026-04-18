import React, { useEffect, useMemo } from 'react';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'variantPicker';

/**
 * Storefront variant picker.
 *
 * Renders one button group per option axis (Color, Size, …). When the
 * customer's selection matches a concrete variant, the parent receives an
 * `onChange(variant)` callback so it can update the displayed price,
 * stock, image and the eventual add-to-cart payload.
 *
 * The component is intentionally headless about layout — it accepts an
 * `accentColor` for the active state but otherwise renders neutral
 * buttons that any theme can style with its own classes if needed.
 */

export interface VariantOption {
  name: string;
  values: string[];
}

export interface Variant {
  _id: string;
  sku?: string;
  optionValues: { name: string; value: string }[];
  price?: number;
  compareAtPrice?: number;
  stock: number;
  image?: string;
}

interface VariantPickerProps {
  options: VariantOption[];
  variants: Variant[];
  selection: Record<string, string>;
  onSelectionChange: (next: Record<string, string>) => void;
  /**
   * Called whenever the current selection resolves to (or away from) a
   * concrete variant. Parents typically swap the displayed price, stock
   * banner and gallery image based on this.
   */
  onVariantChange?: (variant: Variant | null) => void;
  accentColor?: string;
  className?: string;
}

/** Resolve the variant matching a complete option selection (or null). */
export function findVariant(
  variants: Variant[],
  selection: Record<string, string>,
  options: VariantOption[],
): Variant | null {
  if (options.some((o) => !selection[o.name])) return null;
  return (
    variants.find((v) =>
      v.optionValues.every((ov) => selection[ov.name] === ov.value),
    ) || null
  );
}

/**
 * Whether a particular value on a given axis would still produce at
 * least one in-stock variant *given the rest of the current selection*.
 * Used to grey out impossible combinations (e.g. Red T-shirt has no XL).
 */
function isValueAvailable(
  axisName: string,
  value: string,
  variants: Variant[],
  selection: Record<string, string>,
): boolean {
  return variants.some((v) => {
    const axisMatches = v.optionValues.some((ov) => ov.name === axisName && ov.value === value);
    if (!axisMatches) return false;
    const otherAxesMatch = Object.entries(selection).every(([selName, selVal]) => {
      if (selName === axisName) return true;
      return v.optionValues.some((ov) => ov.name === selName && ov.value === selVal);
    });
    return otherAxesMatch && v.stock > 0;
  });
}

export const VariantPicker: React.FC<VariantPickerProps> = (props) => {
  const Override = useThemeSlot<React.ComponentType<VariantPickerProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const {
    options,
    variants,
    selection,
    onSelectionChange,
    onVariantChange,
    accentColor = '#111111',
    className = '',
  } = props;
  const currentVariant = useMemo(
    () => findVariant(variants, selection, options),
    [variants, selection, options],
  );

  // Notify parent whenever the resolved variant changes. Using JSON.stringify
  // as the dep so we don't fire spuriously on identical re-renders.
  const variantKey = currentVariant?._id || null;
  useEffect(() => {
    onVariantChange?.(currentVariant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantKey]);

  if (!options || options.length === 0) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {options.map((axis) => {
        const selected = selection[axis.name];
        return (
          <div key={axis.name}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-gray-700">
                {axis.name}
              </span>
              {selected && (
                <span className="text-xs text-gray-500">{selected}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {axis.values.map((value) => {
                const isSelected = selected === value;
                const available = isValueAvailable(axis.name, value, variants, selection);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onSelectionChange({ ...selection, [axis.name]: value })}
                    disabled={!available && !isSelected}
                    className={[
                      'min-w-[2.75rem] h-10 px-3 rounded-md border text-sm font-medium transition',
                      isSelected
                        ? 'text-white shadow-sm'
                        : available
                          ? 'bg-white text-gray-900 hover:border-gray-900'
                          : 'bg-gray-50 text-gray-400 line-through cursor-not-allowed',
                    ].join(' ')}
                    style={
                      isSelected
                        ? { backgroundColor: accentColor, borderColor: accentColor }
                        : { borderColor: '#d1d5db' }
                    }
                    aria-pressed={isSelected}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VariantPicker;
