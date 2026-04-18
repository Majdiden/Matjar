// Tenant-aware currency formatter. Reads the merchant's currency from
// localStorage (populated by AuthContext after /auth/me) so pages don't
// need to plumb a context — price formatting is the single most common
// thing we do and we want it to be cheap and synchronous.

const STORAGE_KEY = "tenantCurrency";
const LOCALE_KEY = "tenantLocale";

export function setTenantCurrency(code: string | null | undefined) {
  if (!code) return;
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
}

export function setTenantLocale(locale: string | null | undefined) {
  if (!locale) return;
  try { localStorage.setItem(LOCALE_KEY, locale); } catch { /* ignore */ }
}

export function getTenantCurrency(): string {
  try { return localStorage.getItem(STORAGE_KEY) || "SDG"; }
  catch { return "SDG"; }
}

export function getTenantLocale(): string {
  try { return localStorage.getItem(LOCALE_KEY) || "en-US"; }
  catch { return "en-US"; }
}

export function formatPrice(
  amount: number | null | undefined,
  currency?: string,
): string {
  const code = (currency || getTenantCurrency()).toUpperCase();
  const n = typeof amount === "number" && isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(getTenantLocale(), {
      style: "currency",
      currency: code,
    }).format(n);
  } catch {
    // Invalid currency code — fall back to a plain number with the code.
    return `${n.toFixed(2)} ${code}`;
  }
}

export const formatCurrency = formatPrice;
