/**
 * Scroll to and focus the first field with a validation error, so a merchant
 * on a phone sees where the problem is instead of a button that "does
 * nothing".
 *
 * A field counts as invalid when it (or a wrapper) carries
 * `aria-invalid="true"` (set by ui/input, ui/textarea, ui/select and the
 * shared field components when they get an `error`) or `data-field-error`
 * (for custom pickers such as option grids). The first one in page order
 * wins.
 *
 * `block: 'center'` keeps the field clear of the dashboard header and the
 * mobile bottom bar, which overlays the bottom of the scroll area.
 */
export const INVALID_FIELD_SELECTOR = '[aria-invalid="true"], [data-field-error]';

const FOCUSABLE_SELECTOR =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/** Scroll `el` into the middle of its scroll area and focus it (or its first focusable child). */
export function focusField(el: Element | null | undefined): boolean {
  if (!(el instanceof HTMLElement)) return false;
  el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  const target = el.matches(FOCUSABLE_SELECTOR) ? el : el.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  target?.focus({ preventScroll: true });
  return true;
}

/** Focus the field with this element id (for forms that report errors with a toast). */
export function focusFieldById(id: string): boolean {
  return focusField(typeof document === 'undefined' ? null : document.getElementById(id));
}

/**
 * Focus the first invalid field inside `root` (default: the whole page).
 * Waits a frame so error state set just before the call has rendered.
 */
export function focusFirstInvalid(root?: ParentNode | null): void {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    const scope = root ?? document;
    focusField(scope.querySelector(INVALID_FIELD_SELECTOR));
  });
}
