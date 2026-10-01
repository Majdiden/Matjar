// Turns server error envelopes into merchant-friendly messages in the
// dashboard's current language (en/ar).
//
// The server's validation entries carry a zod-style `code` plus its
// parameters (see middlewares/validate.js and errorHandler.js), e.g.
//   { field: "body.description", code: "too_small", origin: "string", minimum: 10 }
// which renders as "Description must be at least 10 characters." /
// «يجب أن يتكوّن الحقل «الوصف» من 10 أحرف على الأقل.» instead of zod's
// developer-facing "Too small: expected string to have >=10 characters".
//
// `localizeApiError` is applied once in `apiCall`, so every toast and inline
// error that reads `.message` (or `errors[i].message`) gets the localized
// text without per-page changes. The original server text is kept on
// `serverMessage` for debugging.
import i18n from '../i18n';

export interface ApiValidationEntry {
  field?: string;
  message?: string;
  code?: string;
  origin?: string;
  minimum?: number;
  maximum?: number;
  inclusive?: boolean;
  exact?: boolean;
  expected?: string;
  format?: string;
  values?: unknown[];
  keys?: string[];
  divisor?: number;
  missing?: boolean;
  custom?: boolean;
  value?: string;
  serverMessage?: string;
}

export interface ApiErrorEnvelope {
  success?: boolean;
  message?: string;
  serverMessage?: string;
  code?: string;
  status?: number;
  errors?: Array<ApiValidationEntry | string>;
  [key: string]: unknown;
}

const NS = 'errors';
const t = (key: string, opts?: Record<string, unknown>) => i18n.t(`${NS}:api.${key}`, opts ?? {}) as string;
const has = (key: string) => i18n.exists(`${NS}:api.${key}`);
const isArabic = () => (i18n.resolvedLanguage || i18n.language || 'en').startsWith('ar');

const MAX_LISTED_OPTIONS = 6;

/** "compareAtPrice" / "compare_at_price" → "compare_at_price" */
const toSnake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[-\s]+/g, '_').toLowerCase();

/** Last meaningful path segment: "body.variants.0.price" → "price". */
function fieldKey(field: string | undefined): string | null {
  if (!field) return null;
  const parts = field.split('.').filter((p) => p && !/^\d+$/.test(p) && !['body', 'query', 'params'].includes(p));
  return parts.length ? parts[parts.length - 1] : null;
}

/**
 * Label for a field, already wrapped for use as a sentence subject:
 * en "Description" / ar «الحقل «الوصف»». Unknown fields fall back to a
 * humanized name in English and to "this field" in Arabic.
 */
function fieldSubject(field: string | undefined): string {
  const key = fieldKey(field);
  if (!key) return t('this_field');
  const snake = toSnake(key);
  if (has(`field.${snake}`)) return t('field_wrap', { label: t(`field.${snake}`) });
  if (isArabic()) return t('this_field');
  const human = snake.replace(/_/g, ' ').replace(/\bid\b/, 'ID');
  return human.charAt(0).toUpperCase() + human.slice(1);
}

// Western digits in both languages, matching the {{count}} in the plural units.
const fmtNumber = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(n);

/** Localized message for one validation entry. */
export function describeValidationEntry(entry: ApiValidationEntry | string): string {
  if (typeof entry === 'string') return isArabic() ? t('validation.invalid', { field: t('this_field') }) : entry;

  // Hand-written server messages are already explanatory in English.
  if (!isArabic() && entry.custom && entry.message) return entry.message;

  const field = fieldSubject(entry.field);
  const { code, origin } = entry;
  const min = entry.minimum;
  const max = entry.maximum;

  switch (code) {
    case 'too_small':
      if (typeof min !== 'number') break;
      if (origin === 'string') {
        if (min <= 1) return t('validation.required', { field });
        return t(entry.exact ? 'validation.exact_length' : 'validation.min_length', { field, amount: t('unit.chars', { count: min }) });
      }
      if (origin === 'array' || origin === 'set') {
        return t('validation.min_items', { field, amount: t('unit.items', { count: min }) });
      }
      if (origin === 'number' || origin === 'int' || origin === 'bigint') {
        return t(entry.inclusive === false ? 'validation.gt_number' : 'validation.min_number', { field, value: fmtNumber(min) });
      }
      if (origin === 'date') return t('validation.invalid_date', { field });
      break;
    case 'too_big':
      if (typeof max !== 'number') break;
      if (origin === 'string') {
        return t(entry.exact ? 'validation.exact_length' : 'validation.max_length', { field, amount: t('unit.chars', { count: max }) });
      }
      if (origin === 'array' || origin === 'set') {
        return t('validation.max_items', { field, amount: t('unit.items', { count: max }) });
      }
      if (origin === 'number' || origin === 'int' || origin === 'bigint') {
        return t(entry.inclusive === false ? 'validation.lt_number' : 'validation.max_number', { field, value: fmtNumber(max) });
      }
      if (origin === 'file') return t('validation.file_too_large', { field });
      break;
    case 'invalid_type':
      if (entry.missing) return t('validation.required', { field });
      switch (entry.expected) {
        case 'number':
        case 'int':
        case 'bigint':
          return t('validation.not_number', { field });
        case 'string':
          return t('validation.not_text', { field });
        case 'boolean':
          return t('validation.not_boolean', { field });
        case 'array':
          return t('validation.not_list', { field });
        case 'date':
          return t('validation.invalid_date', { field });
      }
      break;
    case 'invalid_format':
      switch (entry.format) {
        case 'email':
          return t('validation.invalid_email', { field });
        case 'url':
          return t('validation.invalid_url', { field });
        case 'date':
        case 'datetime':
        case 'time':
        case 'duration':
          return t('validation.invalid_date', { field });
        case 'uuid':
        case 'guid':
        case 'cuid':
        case 'cuid2':
        case 'ulid':
          return t('validation.invalid_id', { field });
      }
      return t('validation.invalid_format', { field });
    case 'invalid_value': {
      const values = (entry.values ?? []).filter((v) => v !== undefined && v !== null).map(String);
      if (values.length === 0 || values.length > MAX_LISTED_OPTIONS) break;
      return t('validation.invalid_option', { field, options: values.join(isArabic() ? '، ' : ', ') });
    }
    case 'not_multiple_of':
      if (typeof entry.divisor === 'number') return t('validation.multiple_of', { field, value: fmtNumber(entry.divisor) });
      break;
    case 'unrecognized_keys':
      return t('validation.unknown_fields', { keys: (entry.keys ?? []).join(', ') });
    case 'invalid_id':
      return t('validation.invalid_id', { field });
    case 'duplicate':
      return entry.value
        ? t('validation.duplicate_value', { field, value: entry.value })
        : t('validation.duplicate', { field });
  }
  return t('validation.invalid', { field });
}

// Exact server messages worth a proper translation (auth/session/permission
// copy merchants hit most). Keyed by the English text the server sends.
const KNOWN_SERVER_MESSAGES: Record<string, string> = {
  'Invalid email or password': 'invalid_credentials',
  'Current password is incorrect': 'wrong_current_password',
  'Account is deactivated': 'account_deactivated',
  'User account is deactivated': 'account_deactivated',
  'Account is disabled or not found.': 'account_deactivated',
  'Invalid or expired reset link': 'reset_link_invalid',
  'Email verification is invalid or has expired. Please verify your email again.': 'verification_expired',
  'Session has been revoked. Please log in again.': 'session_expired',
  'Password changed. Please log in again.': 'session_expired',
  'Invalid or expired token.': 'session_expired',
  'Invalid token. Please login again.': 'session_expired',
  'Token expired. Please login again.': 'session_expired',
  'Refresh token expired': 'session_expired',
  'Invalid refresh token': 'session_expired',
  'Authentication required. Please login first.': 'session_expired',
  'Authentication required.': 'session_expired',
  'Not authenticated': 'session_expired',
  'No token provided.': 'session_expired',
  'Access denied. You do not have permission to perform this action.': 'forbidden',
  'Access denied. You can only access your own resources.': 'forbidden',
  'Insufficient permissions for this action.': 'forbidden',
  'This support session is read-only. Changes are not allowed.': 'read_only_session',
  'Multiple stores found for this email. Please pick one.': 'multiple_stores',
};

// Server texts that say nothing useful to a merchant; replaced by the
// status-based message in every language.
const UNHELPFUL = /^(Validation failed|Internal server error|Operation failed\.?|Route not found:.*|An error occurred|Request failed.*)$/i;

function statusMessage(status: number | undefined): string {
  if (!status) return t('status.network');
  if (status >= 500) return t('status.server');
  if ([400, 401, 403, 404, 409, 413, 422, 429].includes(status)) return t(`status.${status === 422 ? 400 : status}`);
  return t('status.400');
}

/** Localized top-level message for a server error without field details. */
function describeServerMessage(message: string | undefined, status: number | undefined): string {
  const text = (message || '').trim();
  if (text && KNOWN_SERVER_MESSAGES[text]) return t(`server.${KNOWN_SERVER_MESSAGES[text]}`);

  const notFound = /^([A-Za-z][A-Za-z ]{1,40}?) not found\.?$/.exec(text);
  if (notFound) {
    const entity = toSnake(notFound[1].trim());
    if (has(`field.${entity}`)) return t('server.entity_not_found', { entity: t(`field.${entity}`) });
  }

  if (!text || UNHELPFUL.test(text) || (status !== undefined && status >= 500)) return statusMessage(status);
  // English: the server's own sentence is the most specific thing we have.
  // Arabic: lead with a localized explanation, keep the server detail so
  // nothing actionable is lost until that message gets a translation.
  return isArabic() ? `${statusMessage(status)} (${text})` : text;
}

/**
 * Rewrite a thrown server envelope (or network failure) in place so its
 * `message` and every `errors[i].message` are localized and explanatory.
 * Returns the same object for envelopes; anything else becomes a localized
 * status (or network) message string.
 */
export function localizeApiError(payload: unknown, status?: number): unknown {
  if (!payload || typeof payload !== 'object') {
    // No JSON envelope: a network failure (axios gives a bare string) or a
    // proxy's plain-text/HTML error page — neither is fit to show as-is.
    return statusMessage(status);
  }
  const env = payload as ApiErrorEnvelope;
  if (env.serverMessage !== undefined) return env; // already localized
  env.serverMessage = env.message;
  if (status) env.status = status;

  const entries = Array.isArray(env.errors) ? env.errors : [];
  const described = entries.map((e) => describeValidationEntry(e));
  if (entries.length > 0) {
    env.errors = entries.map((e, i) =>
      typeof e === 'string' ? described[i] : { ...e, serverMessage: e.message, message: described[i] },
    );
  }

  const unique = [...new Set(described)];
  if (unique.length === 1) env.message = unique[0];
  else if (unique.length > 1) env.message = t('validation.summary', { list: unique.join(' • ') });
  else env.message = describeServerMessage(env.message, status);
  return env;
}
