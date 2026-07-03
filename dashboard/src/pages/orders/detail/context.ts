import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import type {
  Order, OrderStatus, Payment, CustomerContext,
  PaymentMethodField, PaymentMethodDefinition, PaymentFieldValue,
  OrderWithExtras,
} from '../../../types';
import type { PaymentMethodsEnvelope } from './lib';

export type PaymentActionKey = 'mark_paid' | 'capture' | 'void' | 'mark_failed' | 'record_manual';

/** Single shared context for the order detail screen — order + reload +
 * api-status (payments block, busy flags) so cards don't prop-drill. */
export interface OrderDetailContextValue {
  order: Order;
  setOrder: (order: Order) => void;
  /** Refetch the order (full reload — shows the page skeleton, as before). */
  reload: () => Promise<void>;
  /** Refetch the payments/refunds block (totals + history). */
  reloadPayments: () => Promise<void>;

  // Payments block — loaded once the order is in hand.
  payments: Payment[];
  paymentsLoading: boolean;
  totalPaid: number;
  totalRefunded: number;
  maxRefundable: number;

  // §8 — Customer context (lifetime stats + consent).
  customerContext: CustomerContext | null;
  customerContextLoading: boolean;

  // Payment-method definition derivations (verify / manual-refund flows).
  isManualMethod: boolean;
  isManualRefund: boolean;
  customerFields: PaymentMethodField[];
  submittedDetails: Record<string, PaymentFieldValue>;

  // Shared api-status flags + actions.
  paymentActionBusy: boolean;
  setPaymentActionBusy: (busy: boolean) => void;
  updatingStatus: boolean;
  handleStatusChange: (status: OrderStatus) => void | Promise<void>;
  runPaymentAction: (
    action: PaymentActionKey,
    label: string,
    opts?: { dangerous?: boolean; amount?: number; reference?: string; note?: string },
  ) => Promise<void>;

  // Payment dialog intents — opened from the Operations card, rendered by
  // the Payments card (which owns all payment dialogs).
  verifyOpen: boolean;
  setVerifyOpen: (open: boolean) => void;
  recordManualOpen: boolean;
  setRecordManualOpen: (open: boolean) => void;

  canWriteOrders: boolean;
  formatPrice: (price: number) => string;
}

export const OrderDetailContext = createContext<OrderDetailContextValue | null>(null);

export const useOrderDetail = (): OrderDetailContextValue => {
  const ctx = useContext(OrderDetailContext);
  if (!ctx) throw new Error('useOrderDetail must be used within OrderDetailContext.Provider');
  return ctx;
};

/** Resolves the PaymentMethod definition from the order's paymentMethodCode
 * and derives the manual-method flags. Drives the manual "Verify payment"
 * dialog and the manual-refund form. */
export const usePaymentMethodMeta = (order: Order | null) => {
  const [paymentMethodDef, setPaymentMethodDef] = useState<PaymentMethodDefinition | null>(null);
  // Stash paymentMethodCode in a stable variable so the effect deps are
  // literal property accesses rather than the `(order as X).x` casts the
  // exhaustive-deps linter can't statically parse.
  const paymentMethodCode = order?.paymentMethodCode;
  useEffect(() => {
    // Resolve the PaymentMethod definition so we can render its
    // customerFields schema in the verify/refund dialogs.
    if (!paymentMethodCode) { setPaymentMethodDef(null); return; }
    (async () => {
      try {
        const res = await api.paymentMethods.list() as PaymentMethodsEnvelope;
        const methods: PaymentMethodDefinition[] =
          res?.data?.methods || res?.responseObject?.methods || [];
        const match = methods.find((m) => m.code === paymentMethodCode);
        setPaymentMethodDef(match || null);
      } catch {
        setPaymentMethodDef(null);
      }
    })();
  }, [order?._id, paymentMethodCode]);

  // A "manual" method is one the merchant settles outside of a gateway
  // AND requires reviewing customer-supplied proof (bank transfer receipt,
  // crypto tx hash, etc.). COD is explicitly excluded — there's nothing to
  // verify up-front because the cash is only exchanged on delivery, so COD
  // skips the Verify flow and goes straight through the Mark-as-paid path.
  const isCodMethod =
    paymentMethodDef?.type === 'cod' ||
    (order?.paymentMethod || '').toLowerCase().includes('cash on delivery') ||
    (order?.paymentMethod || '').toLowerCase() === 'cod';
  const orderExtras = order as OrderWithExtras | null;
  const isManualMethod =
    !isCodMethod &&
    (paymentMethodDef?.type === 'manual' ||
      (!paymentMethodDef && !orderExtras?.paymentIntentId));
  const customerFields: PaymentMethodField[] = Array.isArray(paymentMethodDef?.customerFields)
    ? paymentMethodDef.customerFields
    : [];
  const submittedDetails: Record<string, PaymentFieldValue> =
    orderExtras?.paymentDetails || {};

  return { isManualMethod, customerFields, submittedDetails };
};
