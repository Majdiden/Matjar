import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../components/ui/tooltip';
import { MapPin, Phone, Pencil, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { toast } from 'sonner';
import type { Address } from '../../../types';
import { useOrderDetail } from './context';
import { extractOrder, type OrderEnvelope } from './lib';

// §9 — Address helpers.
const ADDRESS_COMPARE_KEYS: (keyof Address)[] = [
  'firstName', 'lastName', 'addressLine1', 'addressLine2',
  'city', 'state', 'postalCode', 'country', 'phone',
];
const addressesMatch = (a?: Address, b?: Address): boolean => {
  if (!a || !b) return false;
  return ADDRESS_COMPARE_KEYS.every(
    (k) => ((a[k] as string | undefined) || '').trim() === ((b[k] as string | undefined) || '').trim()
  );
};

const EMPTY_ADDRESS_FORM: Address = {
  firstName: '', lastName: '', addressLine1: '', addressLine2: '',
  city: '', state: '', postalCode: '', country: '', phone: '',
  deliveryInstructions: '',
};

// §9 — Shipping + Billing address cards (side-by-side on lg) + edit dialog.
export const AddressCards: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const { order, setOrder, reload, canWriteOrders } = useOrderDetail();

  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [addressDialogKind, setAddressDialogKind] = useState<'shipping' | 'billing'>('shipping');
  const [addressForm, setAddressForm] = useState<Address>(EMPTY_ADDRESS_FORM);
  const [savingAddress, setSavingAddress] = useState(false);

  const openAddressDialog = (kind: 'shipping' | 'billing') => {
    const src: Partial<Address> = (kind === 'shipping' ? order?.shippingAddress : order?.billingAddress) || {};
    setAddressDialogKind(kind);
    setAddressForm({
      firstName: src.firstName || '',
      lastName: src.lastName || '',
      addressLine1: src.addressLine1 || '',
      addressLine2: src.addressLine2 || '',
      city: src.city || '',
      state: src.state || '',
      postalCode: src.postalCode || '',
      country: src.country || '',
      phone: src.phone || '',
      deliveryInstructions: src.deliveryInstructions || '',
    });
    setAddressDialogOpen(true);
  };

  const submitAddress = async () => {
    if (!order) return;
    try {
      setSavingAddress(true);
      const key = addressDialogKind === 'shipping' ? 'shippingAddress' : 'billingAddress';
      const payload: { shippingAddress?: Address; billingAddress?: Address } = {
        [key]: { ...addressForm },
      };
      const res = await api.orders.updateAddresses(
        order._id,
        payload as Parameters<typeof api.orders.updateAddresses>[1],
      ) as OrderEnvelope;
      toast.success(addressDialogKind === 'shipping' ? t('orders:toast.address_shipping_updated') : t('orders:toast.address_billing_updated'));
      setAddressDialogOpen(false);
      const updated = extractOrder(res);
      if (updated) setOrder(updated);
      else await reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.address_save_failed'));
    } finally {
      setSavingAddress(false);
    }
  };

  // §9 — Render a single address card. Defined inline so it can close
  // over order state and the edit handlers.
  const renderAddressCard = (
    kind: 'shipping' | 'billing',
    addr: Address | undefined,
    opts: { sameAsShipping?: boolean } = {}
  ) => {
    const title = kind === 'shipping' ? t('orders:detail.address.shipping') : t('orders:detail.address.billing');
    const hasAny = !!(
      addr && (addr.addressLine1 || addr.city || addr.postalCode || addr.firstName)
    );
    const editButton = (
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        disabled={!canWriteOrders}
        onClick={() => openAddressDialog(kind)}
      >
        <Pencil className="h-3.5 w-3.5 me-1.5" />
        {t('common:action.edit')}
      </Button>
    );
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-5 w-5" />{title}
          </CardTitle>
          {canWriteOrders ? (
            editButton
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild><span>{editButton}</span></TooltipTrigger>
                <TooltipContent>{t('orders:detail.address.needs_write')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardHeader>
        <CardContent>
          {opts.sameAsShipping ? (
            <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
              {t('orders:detail.address.same_as_shipping')}
            </div>
          ) : !hasAny ? (
            <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
              {t('orders:detail.address.none_on_file', { kind })}
            </div>
          ) : (
            <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-1">
              {(addr?.firstName || addr?.lastName) && (
                <p className="font-medium">{addr?.firstName} {addr?.lastName}</p>
              )}
              {addr?.addressLine1 && <p>{addr.addressLine1}</p>}
              {addr?.addressLine2 && <p>{addr.addressLine2}</p>}
              <p>
                {[addr?.city, addr?.state, addr?.postalCode].filter(Boolean).join(', ')}
              </p>
              {addr?.country && <p>{addr.country}</p>}
              {addr?.phone && (
                <p className="flex items-center gap-1.5 mt-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />{addr.phone}
                </p>
              )}
              {addr?.deliveryInstructions && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    {t('orders:detail.address.delivery_instructions')}
                  </p>
                  <p className="whitespace-pre-wrap">{addr.deliveryInstructions}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {renderAddressCard('shipping', order.shippingAddress as Address | undefined)}
        {renderAddressCard(
          'billing',
          (order.billingAddress || order.shippingAddress) as Address | undefined,
          {
            sameAsShipping: addressesMatch(
              order.shippingAddress as Address | undefined,
              order.billingAddress as Address | undefined
            ),
          }
        )}
      </div>

      {/* §9 — Address edit dialog (shipping OR billing). */}
      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {addressDialogKind === 'shipping' ? t('orders:dialog.address_edit.title_shipping') : t('orders:dialog.address_edit.title_billing')}
            </DialogTitle>
            <DialogDescription>
              {t('orders:dialog.address_edit.description')}
            </DialogDescription>
          </DialogHeader>

          {order && order.fulfillmentStatus && order.fulfillmentStatus !== 'Unfulfilled' && (
            <Alert variant="destructive" className="mb-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('orders:dialog.address_edit.fulfillment_warning', { status: String(order.fulfillmentStatus).toLowerCase() })}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="addr-firstName">{t('orders:dialog.address_edit.field.first_name')}</Label>
              <Input
                id="addr-firstName"
                value={addressForm.firstName || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-lastName">{t('orders:dialog.address_edit.field.last_name')}</Label>
              <Input
                id="addr-lastName"
                value={addressForm.lastName || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-line1">{t('orders:dialog.address_edit.field.line1')}</Label>
              <Input
                id="addr-line1"
                value={addressForm.addressLine1 || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, addressLine1: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-line2">{t('orders:dialog.address_edit.field.line2')}</Label>
              <Input
                id="addr-line2"
                value={addressForm.addressLine2 || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, addressLine2: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-city">{t('orders:dialog.address_edit.field.city')}</Label>
              <Input
                id="addr-city"
                value={addressForm.city || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-state">{t('orders:dialog.address_edit.field.state')}</Label>
              <Input
                id="addr-state"
                value={addressForm.state || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-postal">{t('orders:dialog.address_edit.field.postal')}</Label>
              <Input
                id="addr-postal"
                value={addressForm.postalCode || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, postalCode: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-country">{t('orders:dialog.address_edit.field.country')}</Label>
              <Input
                id="addr-country"
                value={addressForm.country || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, country: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-phone">{t('orders:dialog.address_edit.field.phone')}</Label>
              <Input
                id="addr-phone"
                value={addressForm.phone || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-delivery">{t('orders:dialog.address_edit.field.delivery_instructions')}</Label>
              <Textarea
                id="addr-delivery"
                value={addressForm.deliveryInstructions || ''}
                onChange={(e) => setAddressForm((f) => ({ ...f, deliveryInstructions: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddressDialogOpen(false)} disabled={savingAddress}>
              {t('common:action.cancel')}
            </Button>
            <Button onClick={submitAddress} disabled={savingAddress || !canWriteOrders}>
              {savingAddress && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t('orders:dialog.address_edit.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
