// Platform payment-method catalog. Mirrors routes/platform/paymentCatalog.js.
import { http, unwrapData as d } from './api';

export type PaymentMethodType = 'cod' | 'manual' | 'gateway';

export const CUSTOMER_FIELD_TYPES = ['text', 'textarea', 'number', 'file', 'select', 'email', 'tel'] as const;
export type CustomerFieldType = (typeof CUSTOMER_FIELD_TYPES)[number];

export interface CustomerField {
  name: string;
  label: string;
  labelAr?: string;
  type: CustomerFieldType;
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  accept?: string;
  maxSize?: number;
}

export interface ProviderTemplate {
  code: string;
  label: string;
  logo?: string;
}

export interface MerchantField {
  name: string;
  label: string;
  type?: string;
  secret?: boolean;
  required?: boolean;
}

export interface PaymentIntegration {
  key: string;
  type: PaymentMethodType;
  label: string;
  description: string;
  supportsProviders: boolean;
  merchantFields: MerchantField[];
}

export interface CatalogEntry {
  _id: string;
  code: string;
  integrationKey: string;
  type: PaymentMethodType | null;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  instructions: string;
  instructionsAr: string;
  logo: string;
  icon: string;
  enabled: boolean;
  enabledByDefault: boolean;
  order: number;
  customerFields: CustomerField[];
  providers: ProviderTemplate[];
  storesEnabled: number;
  integration: Pick<PaymentIntegration, 'key' | 'label' | 'supportsProviders' | 'merchantFields'> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogEntryInput {
  code: string;
  integrationKey: string;
  label: string;
  labelAr?: string;
  description?: string;
  descriptionAr?: string;
  instructions?: string;
  instructionsAr?: string;
  logo?: string;
  icon?: string;
  enabled?: boolean;
  enabledByDefault?: boolean;
  order?: number;
  customerFields?: CustomerField[];
  providers?: ProviderTemplate[];
  reason?: string;
}

export type CatalogEntryPatch = Partial<Omit<CatalogEntryInput, 'code' | 'integrationKey'>>;

/** Built-in entries the platform seeds; they can be disabled but not deleted. */
export const BUILT_IN_CODES = new Set(['cod', 'manual-transfer']);

export const TYPE_LABEL: Record<PaymentMethodType, string> = {
  cod: 'Cash on delivery',
  manual: 'Manual transfer',
  gateway: 'Gateway',
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export const paymentsApi = {
  list: () => d<{ entries: CatalogEntry[]; integrations: PaymentIntegration[] }>(http.get('/payment-methods')),
  create: (body: CatalogEntryInput) => d<CatalogEntry>(http.post('/payment-methods', body)),
  update: (id: string, body: CatalogEntryPatch) => d<CatalogEntry>(http.patch(`/payment-methods/${id}`, body)),
  remove: (id: string, reason?: string) => d<{ id: string }>(http.delete(`/payment-methods/${id}`, { data: reason ? { reason } : undefined })),
  uploadLogo: (id: string, file: File) => {
    const form = new FormData();
    form.append('logo', file);
    return d<CatalogEntry>(http.post(`/payment-methods/${id}/logo`, form, { headers: { 'Content-Type': 'multipart/form-data' } }));
  },
};
