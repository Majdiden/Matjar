import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { getPreorderState } from '../../utils/preorder';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'preorderBadge';

interface PreorderBadgeProps {
  /** Product passed to `getPreorderState`. */
  product: unknown;
  /** Optional active variant (variant-level preorder wins when enabled). */
  variant?: unknown;
  /** Extra classes so themes can restyle (shape, spacing, typography). */
  className?: string;
  /** Override the accent colour. Defaults to `var(--color-primary)`. */
  accentColor?: string;
  /** Hide the "Ships by …" line (label only). */
  compact?: boolean;
}

/**
 * Theme SDK — shared pre-order badge.
 *
 * Renders a small "PRE-ORDER" pill plus an optional "Ships by <date>" line
 * when the product (or active variant) is configured for pre-orders.
 * Returns null when the item is not a pre-order so call sites can drop it
 * in unconditionally. Styling defers to `--color-primary` (or the
 * `accentColor` prop) and accepts a `className` so each theme can
 * re-shape the pill without re-implementing the decision logic.
 */
export const PreorderBadge: React.FC<PreorderBadgeProps> = (props) => {
  const Override = useThemeSlot<React.ComponentType<PreorderBadgeProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const { product, variant, className, accentColor, compact } = props;
  const { t } = useTranslation('product');
  const pre = getPreorderState(product as any, (variant as any) ?? null);
  if (pre.mode !== 'preorder' && pre.mode !== 'soldOut') return null;
  // Sold-out preorder lines don't get a "pre-order" pill — the CTA below
  // them will say "Sold out". The PDP disclaimer still runs via
  // `getPreorderState`; this component is only for the affirmative badge.
  if (pre.mode !== 'preorder') return null;

  const bg = accentColor || 'var(--color-primary, #f59e0b)';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        className,
      )}
      style={{ backgroundColor: bg, color: '#fff' }}
    >
      <span>{t('preorder_badge.label')}</span>
      {!compact && pre.shipByLabel && (
        <span className="font-medium normal-case tracking-normal opacity-90">
          · {pre.shipByLabel}
        </span>
      )}
    </span>
  );
};

export default PreorderBadge;
