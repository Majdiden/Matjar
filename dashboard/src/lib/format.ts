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

/** Unicode extension: Latin digits (0-9) whatever the language. */
const LATIN_DIGITS = "-u-nu-latn";

/** The dashboard's current language (set on <html lang> by LanguageProvider). */
function uiLanguage(): "ar" | "en" {
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "";
  return lang?.toLowerCase().startsWith("ar") ? "ar" : "en";
}

/**
 * Locale for every number, price and date the dashboard shows: the
 * language the merchant is reading the dashboard in, the store's region
 * (e.g. SD), and always Latin digits. Arabic-Indic digits (٠١٢) were
 * confusing next to Latin ones in phone numbers and order numbers, and
 * showed up even in the English dashboard once stores defaulted to Arabic.
 */
export function getTenantLocale(): string {
  let stored = "";
  try { stored = localStorage.getItem(LOCALE_KEY) || ""; } catch { /* ignore */ }
  const region = stored.split("-")[1] || (uiLanguage() === "ar" ? "SD" : "US");
  return `${uiLanguage()}-${region}${LATIN_DIGITS}`;
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

export type DateStyle = "short" | "medium" | "long" | "full";

// Tenant-locale date formatter. With no `style` it matches the output of
// a bare `date.toLocaleDateString()` (numeric date) but respects the
// merchant's locale instead of the browser default.
export function formatDate(
  date: string | number | Date | null | undefined,
  style?: DateStyle,
): string {
  if (date == null || date === "") return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(
      getTenantLocale(),
      style ? { dateStyle: style } : undefined,
    ).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

export function formatDateTime(
  date: string | number | Date | null | undefined,
  style: DateStyle = "medium",
): string {
  if (date == null || date === "") return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(getTenantLocale(), {
      dateStyle: style,
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}
