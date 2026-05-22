import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi, ordersApi, wishlistApi, reviewsApi, giftCardApi } from '../api/client';
import { useStore } from '../contexts/StoreContext';
import { RatingStars } from '../components/commerce/RatingStars';
import { useConfirm } from '../components/primitives/ConfirmDialog';
import { useTranslation } from 'react-i18next';

/**
 * Customer account page (/account).
 *
 * Tabbed surface for everything a customer can self-serve:
 *   • Profile     — edit name / phone / marketing opt-in
 *   • Orders      — order history with status badges and a tracking link
 *   • Addresses   — CRUD on the saved address book (used by checkout)
 *   • Security    — password change + account deactivation
 *
 * All tabs talk to `/storefront/auth/me*` and `/orders/my-orders`. Backend
 * already enforces tenant scope via `req.models`, so a logged-in customer
 * can only ever see/touch their own data.
 */

interface AccountProps {
  className?: string;
  accentColor?: string;
}

interface Address {
  _id?: string;
  label?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

interface User {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  acceptsMarketing?: boolean;
  addresses?: Address[];
  totalOrders?: number;
  totalSpent?: number;
  createdAt?: string;
}

interface OrderLine {
  product?: any;
  name?: string;
  quantity: number;
  price: number;
}

interface Order {
  _id: string;
  orderNumber?: string;
  status: string;
  totalAmount: number;
  products?: OrderLine[];
  createdAt: string;
}

type Tab = 'profile' | 'orders' | 'wishlist' | 'reviews' | 'giftcards' | 'addresses' | 'security';

const STATUS_TINT: Record<string, string> = {
  Pending:    'bg-amber-50 text-amber-700 border-amber-200',
  Processing: 'bg-violet-50 text-violet-700 border-violet-200',
  Shipped:    'bg-sky-50 text-sky-700 border-sky-200',
  Delivered:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelled:  'bg-red-50 text-red-700 border-red-200',
  Refunded:   'bg-rose-50 text-rose-700 border-rose-200',
};

// STATUS_LABEL is now resolved via i18n keys in OrdersTab

const fieldLabel = 'block text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-1';
const inputCls =
  'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-0';
const btnGhost =
  'px-3 py-2 rounded-lg border text-sm hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed';

const Account: React.FC<AccountProps> = ({ className = '', accentColor }) => {
  const navigate = useNavigate();
  const { formatPrice, store } = useStore();
  const { t } = useTranslation(['account']);
  const accent = accentColor || 'var(--color-primary, #2563eb)';
  const giftCardsEnabled = store?.giftCards?.enabled !== false;

  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('profile');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const flash = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 3000);
  };

  // ── Initial load ──────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (!token) {
      navigate('/login', { state: { from: '/account' } });
      return;
    }
    (async () => {
      try {
        const [meRes, ordersRes] = await Promise.all([
          authApi.me().catch(() => null),
          ordersApi.myOrders().catch(() => null),
        ]);
        const u: User | null =
          meRes?.responseObject || meRes?.data?.user || meRes?.user || null;
        if (!u) {
          localStorage.removeItem('customer_token');
          navigate('/login', { state: { from: '/account' } });
          return;
        }
        setUser(u);
        const orderList: Order[] =
          ordersRes?.responseObject?.orders ||
          ordersRes?.data?.orders ||
          ordersRes?.orders ||
          [];
        setOrders(orderList);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_refresh_token');
    navigate('/');
  };

  if (loading) {
    return (
      <div className={`max-w-5xl mx-auto px-4 sm:px-6 py-16 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-100 rounded-2xl" />
          <div className="h-64 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const lifetimeSpent = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className={`max-w-5xl mx-auto px-4 sm:px-6 py-12 ${className}`}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-sm"
            style={{ backgroundColor: accent }}
          >
            {(user.name || user.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t('account.title')}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {t('account.welcome_back', { name: user.name || user.firstName || user.email.split('@')[0] })}
              {memberSince ? ` · ${t('account.member_since', { date: memberSince })}` : ''}
            </p>
          </div>
        </div>
        <button onClick={handleLogout} className={btnGhost}>
          {t('account.action.sign_out')}
        </button>
      </div>

      {/* ── Stat strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard label={t('account.stat.orders')} value={String(orders.length)} accent={accent} />
        <StatCard label={t('account.stat.lifetime_spend')} value={formatPrice(lifetimeSpent)} accent={accent} />
        <StatCard
          label={t('account.stat.saved_addresses')}
          value={String(user.addresses?.length || 0)}
          accent={accent}
        />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className="border-b mb-6 flex gap-1 overflow-x-auto">
        {((['profile', 'orders', 'wishlist', 'reviews', 'giftcards', 'addresses', 'security'] as const).filter(
          (tabKey) => tabKey !== 'giftcards' || giftCardsEnabled
        )).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition ${
              tab === tabKey ? 'border-current' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            style={tab === tabKey ? { color: accent } : undefined}
          >
            {tabKey === 'profile' && t('account.tab.profile')}
            {tabKey === 'orders' && t('account.tab.orders', { count: orders.length })}
            {tabKey === 'wishlist' && t('account.tab.wishlist')}
            {tabKey === 'reviews' && t('account.tab.reviews')}
            {tabKey === 'giftcards' && t('account.tab.giftcards')}
            {tabKey === 'addresses' && t('account.tab.addresses', { count: user.addresses?.length || 0 })}
            {tabKey === 'security' && t('account.tab.security')}
          </button>
        ))}
      </div>

      {/* ── Toast ──────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${
            toast.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Tab content ────────────────────────────────────────── */}
      {tab === 'profile' && (
        <ProfileTab user={user} onSaved={(u) => { setUser(u); flash('ok', t('account.toast.profile_updated')); }} onError={(m) => flash('err', m)} accent={accent} />
      )}
      {tab === 'orders' && (
        <OrdersTab
          orders={orders}
          accent={accent}
          onCancelled={(id) =>
            setOrders((prev) =>
              prev.map((o) => (o._id === id ? { ...o, status: 'Cancelled' as Order['status'] } : o))
            )
          }
          flash={flash}
        />
      )}
      {tab === 'wishlist' && (
        <WishlistTab accent={accent} flash={flash} />
      )}
      {tab === 'reviews' && (
        <ReviewsTab accent={accent} flash={flash} />
      )}
      {tab === 'giftcards' && (
        <GiftCardsTab accent={accent} flash={flash} />
      )}
      {tab === 'addresses' && (
        <AddressesTab
          user={user}
          onChanged={(addresses) => setUser({ ...user, addresses })}
          flash={flash}
          accent={accent}
        />
      )}
      {tab === 'security' && (
        <SecurityTab
          flash={flash}
          accent={accent}
          onDeactivated={() => {
            localStorage.removeItem('customer_token');
            localStorage.removeItem('customer_refresh_token');
            navigate('/');
          }}
        />
      )}
    </div>
  );
};

// ─── Stat card ──────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: string; accent: string }> = ({ label, value, accent }) => (
  <div className="border rounded-2xl bg-white shadow-sm p-4">
    <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
    <p className="text-2xl font-bold mt-1" style={{ color: accent }}>
      {value}
    </p>
  </div>
);

// ─── Profile tab ────────────────────────────────────────────────
const ProfileTab: React.FC<{
  user: User;
  onSaved: (u: User) => void;
  onError: (m: string) => void;
  accent: string;
}> = ({ user, onSaved, onError, accent }) => {
  const { t } = useTranslation(['account']);
  const [form, setForm] = useState({
    name: user.name || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    phone: user.phone || '',
    acceptsMarketing: !!user.acceptsMarketing,
  });
  const [saving, setSaving] = useState(false);
  const dirty =
    form.name !== (user.name || '') ||
    form.firstName !== (user.firstName || '') ||
    form.lastName !== (user.lastName || '') ||
    form.phone !== (user.phone || '') ||
    form.acceptsMarketing !== !!user.acceptsMarketing;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      onError(t('account.toast.name_required'));
      return;
    }
    setSaving(true);
    try {
      const res: any = await authApi.updateMe(form);
      const updated: User =
        res?.data?.user || res?.responseObject || res?.user || { ...user, ...form };
      onSaved(updated);
    } catch (err: any) {
      onError(err?.message || t('account.toast.profile_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="border rounded-2xl bg-white shadow-sm p-6 space-y-5 max-w-2xl">
      <div>
        <h3 className="font-semibold text-lg">{t('account.section.profile.title')}</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          {t('account.section.profile.subtitle')}
        </p>
      </div>
      <div>
        <label className={fieldLabel}>{t('account.field.full_name.label')}</label>
        <input
          className={inputCls}
          style={{ '--tw-ring-color': accent } as React.CSSProperties}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={fieldLabel}>{t('account.field.first_name.label')}</label>
          <input
            className={inputCls}
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </div>
        <div>
          <label className={fieldLabel}>{t('account.field.last_name.label')}</label>
          <input
            className={inputCls}
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className={fieldLabel}>{t('account.field.email.label')}</label>
        <input className={`${inputCls} bg-gray-50 cursor-not-allowed`} value={user.email} disabled />
        <p className="text-xs text-gray-500 mt-1">
          {t('account.field.email.hint')}
        </p>
      </div>
      <div>
        <label className={fieldLabel}>{t('account.field.phone.label')}</label>
        <input
          type="tel"
          className={inputCls}
          style={{ '--tw-ring-color': accent } as React.CSSProperties}
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder={t('account.field.phone.placeholder')}
        />
      </div>
      <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.acceptsMarketing}
          onChange={(e) => setForm({ ...form, acceptsMarketing: e.target.checked })}
          className="mt-0.5"
        />
        <span>
          {t('account.field.marketing_opt_in')}
          <span className="block text-xs text-gray-500 mt-0.5">
            {t('account.field.marketing_opt_in_hint')}
          </span>
        </span>
      </label>
      <div className="pt-2">
        <button
          type="submit"
          disabled={!dirty || saving}
          className="px-5 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: accent }}
        >
          {saving ? t('account.action.saving') : t('account.action.save_changes')}
        </button>
      </div>
    </form>
  );
};

// ─── Orders tab ─────────────────────────────────────────────────
const OrdersTab: React.FC<{
  orders: Order[];
  accent: string;
  onCancelled: (id: string) => void;
  flash: (kind: 'ok' | 'err', msg: string) => void;
}> = ({ orders, accent, onCancelled, flash }) => {
  const { formatPrice } = useStore();
  const { t } = useTranslation(['account']);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const confirm = useConfirm();

  // A customer can cancel an order while it's still Pending or Processing.
  // Once it's Shipped/Delivered/Cancelled/Refunded the button is hidden —
  // the backend will reject those anyway, this just keeps the UI honest.
  const isCancellable = (status: string) =>
    status === 'Pending' || status === 'Processing';

  const handleCancel = async (id: string) => {
    const confirmed = await confirm({
      title: t('account.order.cancel_confirm_title'),
      description: t('account.order.cancel_confirm_description'),
      confirmText: t('account.order.cancel_confirm_text'),
      cancelText: t('account.order.cancel_keep_text'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      setCancellingId(id);
      await ordersApi.cancel(id);
      onCancelled(id);
      flash('ok', t('account.toast.order_cancelled'));
    } catch (err: any) {
      flash('err', err?.message || t('account.toast.cancel_error'));
    } finally {
      setCancellingId(null);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 border rounded-2xl bg-white shadow-sm">
        <svg className="w-14 h-14 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
        <h3 className="text-lg font-semibold mb-1">{t('account.order.empty_title')}</h3>
        <p className="text-gray-500 text-sm mb-6">{t('account.order.empty_description')}</p>
        <Link
          to="/products"
          className="inline-block px-6 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition"
          style={{ backgroundColor: accent }}
        >
          {t('account.order.start_shopping')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const tint = STATUS_TINT[order.status] || 'bg-gray-100 text-gray-700 border-gray-200';
        const label = t(`account.order.status.${order.status}`, { defaultValue: order.status });
        const itemCount = order.products?.reduce((s, p) => s + (p.quantity || 0), 0) || 0;
        const summary = (order.products || [])
          .slice(0, 2)
          .map((p) => p.name || (typeof p.product === 'object' && p.product?.name) || t('account.order.item_fallback', { defaultValue: 'Item' }))
          .join(', ');
        const moreCount = (order.products?.length || 0) - 2;
        return (
          <div
            key={order._id}
            className="border rounded-2xl bg-white shadow-sm p-5 flex flex-wrap items-center gap-4"
          >
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-sm">
                  Order #{order.orderNumber || order._id.slice(-8).toUpperCase()}
                </p>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${tint}`}>
                  {label}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {new Date(order.createdAt).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}{' '}
                · {t(`account.order.item_count_${itemCount === 1 ? 'one' : 'other'}`, { count: itemCount })}
                {summary && <span className="hidden sm:inline"> · {summary}{moreCount > 0 ? ` ${t('account.order.more', { count: moreCount })}` : ''}</span>}
              </p>
            </div>
            <p className="font-bold text-base">{formatPrice(order.totalAmount)}</p>
            <div className="flex items-center gap-3 whitespace-nowrap">
              <Link
                to={`/orders/${order._id}`}
                className="text-sm font-medium hover:underline"
                style={{ color: accent }}
              >
                {t('account.order.track')}
              </Link>
              {isCancellable(order.status) && (
                <button
                  type="button"
                  onClick={() => handleCancel(order._id)}
                  disabled={cancellingId === order._id}
                  className="text-sm font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancellingId === order._id ? t('account.order.cancelling') : t('account.order.cancel')}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Addresses tab ──────────────────────────────────────────────
const blankAddress: Address = {
  label: 'Home',
  firstName: '',
  lastName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  isDefault: false,
};

const AddressesTab: React.FC<{
  user: User;
  onChanged: (addresses: Address[]) => void;
  flash: (kind: 'ok' | 'err', msg: string) => void;
  accent: string;
}> = ({ user, onChanged, flash, accent }) => {
  const { t } = useTranslation(['account']);
  const [editing, setEditing] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const startNew = () => setEditing({ ...blankAddress, isDefault: (user.addresses?.length || 0) === 0 });

  const save = async () => {
    if (!editing) return;
    if (!editing.addressLine1 || !editing.city || !editing.postalCode || !editing.country) {
      flash('err', t('account.address.error.required_fields'));
      return;
    }
    setSaving(true);
    try {
      let res: any;
      if (editing._id) {
        res = await authApi.updateAddress(editing._id, editing);
      } else {
        const { _id: _omit, ...payload } = editing;
        void _omit;
        res = await authApi.addAddress(payload as any);
      }
      const next: Address[] = res?.data?.addresses || res?.responseObject?.addresses || [];
      onChanged(next);
      setEditing(null);
      flash('ok', editing._id ? t('account.toast.address_updated') : t('account.toast.address_added'));
    } catch (err: any) {
      flash('err', err?.message || t('account.toast.address_save_error'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id?: string) => {
    if (!id) return;
    if (!(await confirm({
      title: t('account.delete_address_confirm.title'),
      description: t('account.delete_address_confirm.description'),
      confirmText: t('account.delete_address_confirm.confirm'),
      variant: 'destructive',
    }))) return;
    try {
      const res: any = await authApi.deleteAddress(id);
      onChanged(res?.data?.addresses || res?.responseObject?.addresses || []);
      flash('ok', t('account.toast.address_deleted'));
    } catch (err: any) {
      flash('err', err?.message || t('account.toast.address_delete_error'));
    }
  };

  const setDefault = async (id?: string) => {
    if (!id) return;
    try {
      const res: any = await authApi.updateAddress(id, { isDefault: true });
      onChanged(res?.data?.addresses || res?.responseObject?.addresses || []);
      flash('ok', t('account.toast.default_address_updated'));
    } catch (err: any) {
      flash('err', err?.message || t('account.toast.address_default_error'));
    }
  };

  const addresses = user.addresses || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {t('account.address.hint')}
        </p>
        {!editing && (
          <button
            onClick={startNew}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition"
            style={{ backgroundColor: accent }}
          >
            {t('account.address.add')}
          </button>
        )}
      </div>

      {addresses.length === 0 && !editing && (
        <div className="text-center py-12 border rounded-2xl bg-white shadow-sm">
          <p className="text-gray-500 text-sm">{t('account.address.empty')}</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {addresses.map((a) => (
          <div key={a._id} className="border rounded-2xl bg-white shadow-sm p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">
                {a.label || 'Address'}
                {a.isDefault && (
                  <span
                    className="ms-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${accent}15`, color: accent }}
                  >
                    {t('account.address.default_badge')}
                  </span>
                )}
              </p>
            </div>
            <div className="text-sm text-gray-700">
              {(a.firstName || a.lastName) && (
                <p className="font-medium">
                  {a.firstName} {a.lastName}
                </p>
              )}
              <p>{a.addressLine1}</p>
              {a.addressLine2 && <p>{a.addressLine2}</p>}
              <p>
                {a.city}
                {a.state ? `, ${a.state}` : ''} {a.postalCode}
              </p>
              <p>{a.country}</p>
              {a.phone && <p className="text-gray-500 text-xs mt-1">{a.phone}</p>}
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <button onClick={() => setEditing(a)} className="text-xs hover:underline" style={{ color: accent }}>
                {t('checkout.action.edit', { ns: 'checkout', defaultValue: 'Edit' })}
              </button>
              {!a.isDefault && (
                <button onClick={() => setDefault(a._id)} className="text-xs text-gray-600 hover:underline">
                  {t('account.address.set_default')}
                </button>
              )}
              <button onClick={() => remove(a._id)} className="text-xs text-red-600 hover:underline ml-auto">
                {t('account.delete_address_confirm.confirm')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="border rounded-2xl bg-white shadow-sm p-5 space-y-4">
          <h3 className="font-semibold">{editing._id ? t('account.address.edit_title') : t('account.address.new_title')}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={fieldLabel}>{t('account.address.field.label.label')}</label>
              <input
                className={inputCls}
                style={{ '--tw-ring-color': accent } as React.CSSProperties}
                placeholder={t('account.address.field.label.placeholder')}
                value={editing.label || ''}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              />
            </div>
            <div>
              <label className={fieldLabel}>{t('account.address.field.first_name.label')}</label>
              <input
                className={inputCls}
                style={{ '--tw-ring-color': accent } as React.CSSProperties}
                value={editing.firstName || ''}
                onChange={(e) => setEditing({ ...editing, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className={fieldLabel}>{t('account.address.field.last_name.label')}</label>
              <input
                className={inputCls}
                style={{ '--tw-ring-color': accent } as React.CSSProperties}
                value={editing.lastName || ''}
                onChange={(e) => setEditing({ ...editing, lastName: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={fieldLabel}>{t('account.address.field.address_line1.label')}</label>
              <input
                className={inputCls}
                style={{ '--tw-ring-color': accent } as React.CSSProperties}
                value={editing.addressLine1}
                onChange={(e) => setEditing({ ...editing, addressLine1: e.target.value })}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className={fieldLabel}>{t('account.address.field.address_line2.label')}</label>
              <input
                className={inputCls}
                style={{ '--tw-ring-color': accent } as React.CSSProperties}
                value={editing.addressLine2 || ''}
                onChange={(e) => setEditing({ ...editing, addressLine2: e.target.value })}
              />
            </div>
            <div>
              <label className={fieldLabel}>{t('account.address.field.city.label')}</label>
              <input
                className={inputCls}
                style={{ '--tw-ring-color': accent } as React.CSSProperties}
                value={editing.city}
                onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                required
              />
            </div>
            <div>
              <label className={fieldLabel}>{t('account.address.field.state.label')}</label>
              <input
                className={inputCls}
                style={{ '--tw-ring-color': accent } as React.CSSProperties}
                value={editing.state || ''}
                onChange={(e) => setEditing({ ...editing, state: e.target.value })}
              />
            </div>
            <div>
              <label className={fieldLabel}>{t('account.address.field.postal_code.label')}</label>
              <input
                className={inputCls}
                style={{ '--tw-ring-color': accent } as React.CSSProperties}
                value={editing.postalCode}
                onChange={(e) => setEditing({ ...editing, postalCode: e.target.value })}
                required
              />
            </div>
            <div>
              <label className={fieldLabel}>{t('account.address.field.country.label')}</label>
              <input
                className={inputCls}
                style={{ '--tw-ring-color': accent } as React.CSSProperties}
                value={editing.country}
                onChange={(e) => setEditing({ ...editing, country: e.target.value })}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className={fieldLabel}>{t('account.address.field.phone.label')}</label>
              <input
                type="tel"
                className={inputCls}
                style={{ '--tw-ring-color': accent } as React.CSSProperties}
                value={editing.phone || ''}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
              />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!editing.isDefault}
                onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })}
              />
              {t('account.address.field.set_default')}
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              {saving ? t('account.action.saving') : editing._id ? t('account.action.save_changes') : t('account.action.add_address')}
            </button>
            <button onClick={() => setEditing(null)} className={btnGhost}>
              {t('account.order.cancel_keep_text')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Security tab ───────────────────────────────────────────────
const SecurityTab: React.FC<{
  flash: (kind: 'ok' | 'err', msg: string) => void;
  accent: string;
  onDeactivated: () => void;
}> = ({ flash, accent, onDeactivated }) => {
  const { t } = useTranslation(['account']);
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirm = useConfirm();

  const submitPwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.next.length < 8) return flash('err', t('account.toast.password_error_min'));
    if (pwd.next !== pwd.confirm) return flash('err', t('account.toast.password_error_match'));
    setSaving(true);
    try {
      await authApi.changePassword(pwd.current, pwd.next);
      setPwd({ current: '', next: '', confirm: '' });
      flash('ok', t('account.toast.password_updated'));
    } catch (err: any) {
      flash('err', err?.message || t('account.toast.password_error_change'));
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!(await confirm({
      title: t('account.deactivate_confirm.title'),
      description: t('account.deactivate_confirm.description'),
      confirmText: t('account.deactivate_confirm.confirm'),
      variant: 'destructive',
    }))) return;
    setDeleting(true);
    try {
      await authApi.deleteAccount();
      onDeactivated();
    } catch (err: any) {
      flash('err', err?.message || t('account.toast.deactivate_error'));
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <form onSubmit={submitPwd} className="border rounded-2xl bg-white shadow-sm p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-lg">{t('account.section.password.title')}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {t('account.section.password.subtitle')}
          </p>
        </div>
        <div>
          <label className={fieldLabel}>{t('account.field.current_password.label')}</label>
          <input
            type="password"
            className={inputCls}
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            value={pwd.current}
            onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <label className={fieldLabel}>{t('account.field.new_password.label')}</label>
          <input
            type="password"
            className={inputCls}
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            value={pwd.next}
            onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div>
          <label className={fieldLabel}>{t('account.field.confirm_new_password.label')}</label>
          <input
            type="password"
            className={inputCls}
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            value={pwd.confirm}
            onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          {saving ? t('account.action.updating') : t('account.action.update_password')}
        </button>
      </form>

      <div className="border border-red-200 rounded-2xl bg-red-50/40 p-6 space-y-3">
        <div>
          <h3 className="font-semibold text-lg text-red-700">{t('account.section.deactivate.title')}</h3>
          <p className="text-sm text-red-600/80 mt-0.5">
            {t('account.section.deactivate.subtitle')}
          </p>
        </div>
        <button
          onClick={deactivate}
          disabled={deleting}
          className="px-4 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-medium bg-white hover:bg-red-50 transition disabled:opacity-50"
        >
          {deleting ? t('account.action.deactivating') : t('account.action.deactivate')}
        </button>
      </div>
    </div>
  );
};

// ─── Wishlist tab ────────────────────────────────────────────────
// Lists everything the customer has saved. The backend's wishlist
// endpoint populates the product, so each row can link straight to the
// PDP and a "Remove" button calls the idempotent toggle endpoint.
const WishlistTab: React.FC<{ accent: string; flash: (k: 'ok' | 'err', m: string) => void }> = ({ accent, flash }) => {
  const { t } = useTranslation(['account']);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await wishlistApi.get();
      setItems(res?.data?.items || res?.items || []);
    } catch (e: any) {
      flash('err', e.message || t('account.toast.wishlist_load_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async (productId: string) => {
    setRemoving(productId);
    try {
      await wishlistApi.toggle(productId);
      setItems((prev) => prev.filter((it) => (it.product?._id || it.productId) !== productId));
      flash('ok', t('account.toast.wishlist_removed'));
    } catch (e: any) {
      flash('err', e.message || t('account.toast.wishlist_remove_error'));
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">{t('account.wishlist.loading')}</div>;
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed rounded-2xl">
        <p className="text-gray-500 text-sm">{t('account.wishlist.empty')}</p>
        <Link to="/products" className="inline-block mt-3 text-sm font-medium" style={{ color: accent }}>
          {t('account.wishlist.browse')}
        </Link>
      </div>
    );
  }


  return (
    <div>
      <div className="flex justify-end mb-3">
        <Link to="/wishlist" className="text-xs font-medium hover:underline" style={{ color: accent }}>
          {t('account.wishlist.open_full')}
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((it) => {
        const product = it.product || it;
        const productId = product._id || it.productId;
        const image = product.images?.[0]?.url || product.images?.[0] || product.image;
        const price = product.price;
        return (
          <div key={productId} className="border rounded-2xl overflow-hidden bg-white flex flex-col">
            <Link to={`/products/${product.slug || productId}`} className="block aspect-square bg-gray-50">
              {image ? (
                <img src={image} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">{t('account.wishlist.no_image')}</div>
              )}
            </Link>
            <div className="p-3 flex-1 flex flex-col">
              <Link
                to={`/products/${product.slug || productId}`}
                className="text-sm font-medium line-clamp-2 hover:underline"
              >
                {product.name}
              </Link>
              {price != null && (
                <div className="text-sm mt-1 font-semibold" style={{ color: accent }}>
                  ${Number(price).toFixed(2)}
                </div>
              )}
              <button
                onClick={() => remove(productId)}
                disabled={removing === productId}
                className="mt-3 text-xs px-3 py-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
              >
                {removing === productId ? t('account.wishlist.removing') : t('account.wishlist.remove')}
              </button>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};

// ─── Reviews tab ─────────────────────────────────────────────────
// Lists every review the customer has posted. The backend populates
// the product so we can link back to it and show a thumbnail.
const ReviewsTab: React.FC<{ accent: string; flash: (k: 'ok' | 'err', m: string) => void }> = ({ accent, flash }) => {
  const { t } = useTranslation(['account']);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await reviewsApi.mine();
        setReviews(res?.data?.reviews || []);
      } catch (e: any) {
        flash('err', e.message || t('account.toast.reviews_load_error'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="text-sm text-gray-500">{t('account.reviews.loading')}</div>;
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed rounded-2xl">
        <p className="text-gray-500 text-sm">{t('account.reviews.empty')}</p>
        <Link to="/products" className="inline-block mt-3 text-sm font-medium" style={{ color: accent }}>
          {t('account.reviews.browse')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((r) => {
        const product = r.product || {};
        const image = product.images?.[0]?.url || product.images?.[0];
        return (
          <div key={r._id} className="border rounded-2xl p-4 bg-white flex gap-4">
            {image && (
              <Link to={`/products/${product.slug || product._id}`} className="block w-20 h-20 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
                <img src={image} alt={product.name} className="w-full h-full object-cover" />
              </Link>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <Link
                  to={`/products/${product.slug || product._id}`}
                  className="text-sm font-medium hover:underline truncate"
                >
                  {product.name || 'Product'}
                </Link>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
                </span>
              </div>
              <div className="mt-1">
                <RatingStars rating={r.rating || 0} size="sm" />
              </div>
              {r.title && <div className="text-sm font-semibold mt-1.5">{r.title}</div>}
              {r.comment && <p className="text-sm text-gray-600 mt-1 line-clamp-3">{r.comment}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Gift cards tab ──────────────────────────────────────────────
interface GiftCardSummary {
  _id: string;
  codeLast4?: string;
  balance: number;
  initialAmount: number;
  currency?: string;
  status: string;
  expiresAt?: string;
  createdAt?: string;
}

const GiftCardsTab: React.FC<{ accent: string; flash: (k: 'ok' | 'err', m: string) => void }> = ({ accent, flash }) => {
  const { formatPrice } = useStore();
  const { t } = useTranslation(['account']);
  const [cards, setCards] = useState<GiftCardSummary[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await giftCardApi.myCards();
        const list: GiftCardSummary[] =
          res?.data?.cards || res?.cards || res?.responseObject?.cards || [];
        setCards(list);
      } catch (err: any) {
        flash('err', err?.message || t('account.toast.giftcards_load_error'));
        setCards([]);
      }
    })();
  }, [flash]);

  if (cards === null) {
    return <div className="text-sm text-gray-500">{t('account.giftcards.loading')}</div>;
  }
  if (cards.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-500">
        {t('account.giftcards.empty')}
      </div>
    );
  }

  const statusTint: Record<string, string> = {
    active:   'bg-emerald-50 text-emerald-700 border-emerald-200',
    redeemed: 'bg-gray-100 text-gray-600 border-gray-200',
    expired:  'bg-red-50 text-red-700 border-red-200',
    disabled: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div className="space-y-3">
      {cards.map((c) => (
        <div
          key={c._id}
          className="border rounded-xl p-4 flex items-center justify-between gap-4"
        >
          <div>
            <div className="text-sm font-semibold">
              {t('account.giftcards.card', { last4: c.codeLast4 || '????' })}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {t('account.giftcards.balance', { balance: formatPrice(c.balance), initial: formatPrice(c.initialAmount) })}
              {c.expiresAt && ` ${t('account.giftcards.expires', { date: new Date(c.expiresAt).toLocaleDateString() })}`}
            </div>
          </div>
          <span
            className={`text-xs px-2 py-1 rounded-full border capitalize ${
              statusTint[c.status] || 'bg-gray-50 text-gray-600 border-gray-200'
            }`}
            style={c.status === 'active' ? { borderColor: accent, color: accent } : undefined}
          >
            {c.status}
          </span>
        </div>
      ))}
    </div>
  );
};

export default Account;
