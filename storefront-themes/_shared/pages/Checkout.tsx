import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useStore } from '../contexts/StoreContext';
import { ordersApi, authApi, checkoutApi, giftCardApi, paymentMethodsApi, PaymentMethodPublic, isPreviewMode, notifyPreviewDisabled } from '../api/client';
import PaymentMethodPicker from '../components/commerce/PaymentMethodPicker';
import { PolicyLinks } from '../components/PolicyLinks';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../i18n/LanguageProvider';
import { COUNTRIES, getCitiesForCountry, optionsWithCurrent, locationLabel } from '../data/locations';

interface CheckoutProps {
  className?: string;
  accentColor?: string;
}

interface AddressForm {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface SavedAddress extends AddressForm {
  _id?: string;
  label?: string;
  isDefault?: boolean;
}

const blankAddress: AddressForm = {
  firstName: '',
  lastName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
};

type Step = 1 | 2 | 3 | 4;

interface Quote {
  subtotal: number;
  discount: number;
  discountCode: string | null;
  shippingCost: number;
  shippingMethod: { id?: string; name?: string; price?: number };
  tax: number;
  totalAmount: number;
}

const Checkout: React.FC<CheckoutProps> = ({ className = '', accentColor }) => {
  const navigate = useNavigate();
  const { cart, loading: cartLoading, clearCart } = useCart();
  const { formatPrice, store } = useStore();
  const { t } = useTranslation(['checkout']);
  const { lang } = useLanguage();
  const giftCardsEnabled = store?.giftCards?.enabled !== false;

  const accent = accentColor || 'var(--color-primary, #2563eb)';

  const STEPS: { id: Step; label: string }[] = [
    { id: 1, label: t('checkout.step.1.title') },
    { id: 2, label: t('checkout.step.2.title') },
    { id: 3, label: t('checkout.step.3.title') },
    { id: 4, label: t('checkout.step.4.title') },
  ];

  // Auth + profile
  const [authChecking, setAuthChecking] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);

  // Step state
  const [step, setStep] = useState<Step>(1);

  // Checkout steps are state-driven, not routes, so the shared route-level
  // ScrollToTop never fires here — advancing a step would leave the shopper
  // scrolled halfway down. Reset to the top whenever the step changes.
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, left: 0 });
  }, [step]);

  // Form state
  const [email, setEmail] = useState('');
  const [acceptsMarketing, setAcceptsMarketing] = useState(false);
  const [shipping, setShipping] = useState<AddressForm>(blankAddress);
  const [selectedAddressIdx, setSelectedAddressIdx] = useState<number | 'new'>('new');
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billing, setBilling] = useState<AddressForm>(blankAddress);
  const [saveAddress, setSaveAddress] = useState(true);

  const [paymentMethodCode, setPaymentMethodCode] = useState<string | null>(null);
  const [paymentFieldValues, setPaymentFieldValues] = useState<Record<string, any>>({});
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<PaymentMethodPublic[]>([]);
  const [notes, setNotes] = useState('');
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [idempotencyKey] = useState<string>(() =>
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  );

  // Discount + live quote
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<string>('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Gift card
  const [giftCardInput, setGiftCardInput] = useState('');
  const [appliedGiftCard, setAppliedGiftCard] = useState<{
    code?: string;
    id?: string;
    balance: number;
    codeLast4: string;
    currency: string;
    coverShipping?: boolean;
    coverTax?: boolean;
  } | null>(null);
  const [giftCardLoading, setGiftCardLoading] = useState(false);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);
  interface MyGiftCard {
    _id: string;
    balance: number;
    codeLast4: string;
    currency: string;
    coverShipping?: boolean;
    coverTax?: boolean;
    expiresAt?: string | null;
  }
  const [myGiftCards, setMyGiftCards] = useState<MyGiftCard[]>([]);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    'w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent';
  const inputStyle = { '--tw-ring-color': accent } as React.CSSProperties;

  // ── Load payment methods ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    paymentMethodsApi
      .list()
      .then((res: any) => {
        if (cancelled) return;
        const list: PaymentMethodPublic[] =
          res?.data?.methods || res?.responseObject?.methods || res?.methods || [];
        setAvailablePaymentMethods(list);
      })
      .catch(() => {
        if (!cancelled) setAvailablePaymentMethods([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Load logged-in customer profile ──────────────────────────────
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
    if (!token) {
      setAuthChecking(false);
      return;
    }
    authApi
      .me()
      .then((res) => {
        const u = res?.data?.user || res?.user;
        if (!u) return;
        setUser(u);
        setEmail(u.email || '');
        setAcceptsMarketing(!!u.acceptsMarketing);

        const addresses: SavedAddress[] = u.addresses || [];
        setSavedAddresses(addresses);

        const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
        if (defaultAddr) {
          setShipping({
            firstName: defaultAddr.firstName || u.firstName || '',
            lastName: defaultAddr.lastName || u.lastName || '',
            phone: defaultAddr.phone || u.phone || '',
            addressLine1: defaultAddr.addressLine1 || '',
            addressLine2: defaultAddr.addressLine2 || '',
            city: defaultAddr.city || '',
            state: defaultAddr.state || '',
            postalCode: defaultAddr.postalCode || '',
            country: defaultAddr.country || '',
          });
          setSelectedAddressIdx(addresses.indexOf(defaultAddr));
          setSaveAddress(false);
        } else {
          setShipping((prev) => ({
            ...prev,
            firstName: u.firstName || u.name?.split(' ')[0] || '',
            lastName: u.lastName || u.name?.split(' ').slice(1).join(' ') || '',
            phone: u.phone || '',
          }));
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecking(false));
  }, []);

  // ── Load signed-in customer's stored gift cards ──
  useEffect(() => {
    if (!user) { setMyGiftCards([]); return; }
    if (!giftCardsEnabled) return;
    let cancelled = false;
    giftCardApi
      .myCards()
      .then((res: any) => {
        if (cancelled) return;
        const list: MyGiftCard[] =
          res?.data?.cards ?? res?.cards ?? res?.responseObject?.cards ?? [];
        setMyGiftCards(Array.isArray(list) ? list : []);
      })
      .catch(() => { if (!cancelled) setMyGiftCards([]); });
    return () => { cancelled = true; };
  }, [user, giftCardsEnabled]);

  // ── Live quote ───────────────────────────────────────────────────
  // Guests quote too: the storefront /checkout/quote endpoint prices anonymous
  // carts via the cart session cookie, so discount validation, shipping and tax
  // all resolve without an account (no `user` requirement here).
  const canQuote = useMemo(
    () =>
      !!cart &&
      cart.items.length > 0 &&
      !!shipping.country &&
      !!shipping.city,
    [cart, shipping.country, shipping.city]
  );

  useEffect(() => {
    if (!canQuote) return;
    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError(null);
    checkoutApi
      .quote({
        shippingAddress: shipping,
        discountCode: appliedDiscount || undefined,
      })
      .then((res) => {
        if (cancelled) return;
        const q = res?.data?.quote;
        setQuote(q || null);
        if (appliedDiscount && q && !q.discountCode) {
          setQuoteError(q.discountError || `Code "${appliedDiscount}" is not valid`);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setQuoteError(err?.message || 'Failed to calculate totals');
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canQuote, shipping.addressLine1, shipping.city, shipping.state, shipping.postalCode, shipping.country, appliedDiscount]);

  // ── Handlers ─────────────────────────────────────────────────────
  const setShippingField = (key: keyof AddressForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setShipping({ ...shipping, [key]: e.target.value });
    setSelectedAddressIdx('new');
  };

  const setBillingField = (key: keyof AddressForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setBilling({ ...billing, [key]: e.target.value });
  };

  // Value setters for the country/city dropdowns. Changing country resets the
  // dependent city so a stale city never rides along with a new country.
  const setShippingValue = (key: keyof AddressForm, value: string) => {
    setShipping((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'country' ? { city: '' } : {}),
    }));
    setSelectedAddressIdx('new');
  };
  const setBillingValue = (key: keyof AddressForm, value: string) => {
    setBilling((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'country' ? { city: '' } : {}),
    }));
  };

  const renderCountrySelect = (
    value: string,
    onChange: (v: string) => void,
    required = false,
  ) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} bg-white`}
      style={inputStyle}
      required={required}
    >
      <option value="">{t('common:location.select_country')}</option>
      {optionsWithCurrent(COUNTRIES, value).map((o) => (
        <option key={o.value} value={o.value}>{locationLabel(o, lang)}</option>
      ))}
    </select>
  );

  const renderCityField = (
    value: string,
    country: string,
    onChange: (v: string) => void,
    required = false,
  ) => {
    const cities = getCitiesForCountry(country);
    if (!cities) {
      return (
        <input
          type="text"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
      );
    }
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} bg-white`}
        style={inputStyle}
        required={required}
      >
        <option value="">{t('common:location.select_city')}</option>
        {optionsWithCurrent(cities, value).map((o) => (
          <option key={o.value} value={o.value}>{locationLabel(o, lang)}</option>
        ))}
      </select>
    );
  };

  const useSavedAddress = (idx: number) => {
    const a = savedAddresses[idx];
    if (!a) return;
    setSelectedAddressIdx(idx);
    setShipping({
      firstName: a.firstName || '',
      lastName: a.lastName || '',
      phone: a.phone || '',
      addressLine1: a.addressLine1 || '',
      addressLine2: a.addressLine2 || '',
      city: a.city || '',
      state: a.state || '',
      postalCode: a.postalCode || '',
      country: a.country || '',
    });
    setSaveAddress(false);
  };

  const applyDiscount = () => {
    setAppliedDiscount(discountInput.trim().toUpperCase());
  };

  const removeDiscount = () => {
    setDiscountInput('');
    setAppliedDiscount('');
    setQuoteError(null);
  };

  const applyGiftCard = async () => {
    const code = giftCardInput.trim();
    if (!code) return;
    setGiftCardLoading(true);
    setGiftCardError(null);
    try {
      const res = await giftCardApi.lookup(code);
      const card = res?.data || res;
      if (!card) throw new Error('Gift card not found');
      setAppliedGiftCard({
        code,
        balance: Number(card.balance) || 0,
        codeLast4: card.codeLast4 || code.slice(-4),
        currency: card.currency || 'USD',
        coverShipping: !!card.coverShipping,
        coverTax: !!card.coverTax,
      });
    } catch (err: any) {
      setAppliedGiftCard(null);
      setGiftCardError(err?.message || 'Invalid gift card');
    } finally {
      setGiftCardLoading(false);
    }
  };

  const applyStoredGiftCard = (card: MyGiftCard) => {
    setGiftCardError(null);
    setGiftCardInput('');
    setAppliedGiftCard({
      id: card._id,
      balance: Number(card.balance) || 0,
      codeLast4: card.codeLast4,
      currency: card.currency || 'USD',
      coverShipping: !!card.coverShipping,
      coverTax: !!card.coverTax,
    });
  };

  const removeGiftCard = () => {
    setGiftCardInput('');
    setAppliedGiftCard(null);
    setGiftCardError(null);
  };

  const validateInformation = () => {
    if (!email) return t('checkout.error.email_required');
    return null;
  };

  const validateShipping = () => {
    if (!shipping.firstName) return t('checkout.error.first_name_required');
    if (!shipping.lastName) return t('checkout.error.last_name_required');
    if (!shipping.addressLine1) return t('checkout.error.address_required');
    if (!shipping.city) return t('checkout.error.city_required');
    if (!shipping.postalCode) return t('checkout.error.postal_required');
    if (!shipping.country) return t('checkout.error.country_required');
    if (!shipping.phone) return t('checkout.error.phone_required');
    return null;
  };

  const goNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    let err: string | null = null;
    if (step === 1) err = validateInformation();
    if (step === 2) err = validateShipping();
    if (step === 3) {
      if (!paymentMethodCode && !isZeroTotal) {
        setPaymentSubmitted(true);
        setError(t('checkout.error.choose_payment'));
        return;
      }
    }
    if (err) {
      setError(err);
      return;
    }
    setStep(((step + 1) as Step));
  };

  const goBack = () => {
    setError(null);
    if (step > 1) setStep(((step - 1) as Step));
  };

  const placeOrder = async () => {
    // Preview mode: demo products aren't in the DB, so a real order would fail.
    // Short-circuit with the same notice the cart shows — never hits the API.
    if (isPreviewMode()) {
      notifyPreviewDisabled(
        t('common:preview.purchasing_disabled', 'Preview mode — purchasing is disabled')
      );
      return;
    }
    if (!cart || cart.items.length === 0) return;
    if (!paymentMethodCode && !isZeroTotal) {
      setPaymentSubmitted(true);
      setStep(3);
      setError(t('checkout.error.choose_payment'));
      return;
    }
    if (!acceptsTerms) {
      setError(t('checkout.error.accept_terms'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const billingAddress = billingSameAsShipping ? shipping : billing;
      const res = await ordersApi.create({
        items: cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          variantId: item.variant?.id,
        })),
        shippingAddress: shipping,
        billingAddress,
        paymentMethod: isZeroTotal ? undefined : paymentMethodCode!,
        paymentMethodCode: isZeroTotal ? undefined : paymentMethodCode!,
        paymentDetails: isZeroTotal ? {} : paymentFieldValues,
        notes: notes || undefined,
        discountCode: appliedDiscount || undefined,
        giftCardCode: appliedGiftCard?.code || undefined,
        giftCardId: appliedGiftCard?.id || undefined,
        shippingMethod: quote?.shippingMethod,
        customerEmail: email,
        customerPhone: shipping.phone,
        acceptsMarketing: acceptsMarketing && !user?.acceptsMarketing,
        saveAddress: !!user && saveAddress && selectedAddressIdx === 'new',
        idempotencyKey,
      });
      const payload = res?.responseObject || res?.data || res;
      const order = payload?.order || payload;
      const trackingToken = payload?.trackingToken || order?.trackingToken;
      const orderForState = trackingToken ? { ...order, trackingToken } : order;
      await clearCart();
      navigate(`/order-success/${order?._id || ''}`, { state: { order: orderForState } });
    } catch (err: any) {
      setError(err?.message || t('checkout.error.place_order'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / empty cart guards ─────────────────────────────────
  if (cartLoading || authChecking) {
    return (
      <div className={`max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center text-gray-500 ${className}`}>
        {t('checkout.loading')}
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className={`max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center ${className}`}>
        <svg className="w-14 h-14 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272" />
        </svg>
        <h2 className="text-2xl font-bold mb-2">{t('checkout.cart.empty_title')}</h2>
        <p className="text-gray-500 mb-6">{t('checkout.cart.empty_description')}</p>
        <Link
          to="/products"
          className="inline-block px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition"
          style={{ backgroundColor: accent }}
        >
          {t('checkout.cart.browse_products')}
        </Link>
      </div>
    );
  }

  // ── Summary numbers ──────────────────────────────────────────────
  const summarySubtotal = quote?.subtotal ?? cart.subtotal;
  const summaryDiscount = quote?.discount ?? 0;
  const summaryShipping = quote?.shippingCost ?? 0;
  const summaryTax = quote?.tax ?? 0;
  const summaryTotalPreGift = quote?.totalAmount ?? cart.total;
  const giftCoverShipping = appliedGiftCard?.coverShipping === true;
  const giftCoverTax = appliedGiftCard?.coverTax === true;
  const giftCoverageBase = Math.min(
    summaryTotalPreGift,
    Math.max(0, summarySubtotal - summaryDiscount) +
      (giftCoverShipping ? summaryShipping : 0) +
      (giftCoverTax ? summaryTax : 0)
  );
  const giftCardDeduction = appliedGiftCard
    ? Math.min(appliedGiftCard.balance, giftCoverageBase)
    : 0;
  const summaryTotal = Math.max(0, summaryTotalPreGift - giftCardDeduction);
  const isZeroTotal = !!appliedGiftCard && summaryTotal <= 0;

  return (
    <div className={`max-w-6xl mx-auto px-4 sm:px-6 py-12 ${className}`}>
      <h1 className="text-3xl font-bold mb-2">{t('checkout.title')}</h1>

      {/* Stepper */}
      <ol className="flex items-center gap-2 mb-8 text-xs font-medium">
        {STEPS.map((s, i) => {
          const isActive = s.id === step;
          const isDone = s.id < step;
          return (
            <React.Fragment key={s.id}>
              <li
                className={`flex items-center gap-2 ${isActive ? '' : isDone ? 'text-gray-700' : 'text-gray-400'}`}
                style={isActive ? { color: accent } : undefined}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] border ${
                    isActive ? 'text-white border-transparent' : isDone ? 'border-gray-700' : 'border-gray-300'
                  }`}
                  style={isActive ? { backgroundColor: accent } : undefined}
                >
                  {isDone ? '✓' : s.id}
                </span>
                <span className="uppercase tracking-wider">{s.label}</span>
              </li>
              {i < STEPS.length - 1 && (
                <svg className="w-3 h-3 text-gray-300 rtl:rotate-180 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </React.Fragment>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Forms column ───────────────────────────────────────── */}
        <div className="lg:col-span-2">
          {/* Logged-in banner */}
          {user && (
            <div className="mb-4 px-4 py-3 rounded-lg border bg-gray-50 text-sm flex items-center justify-between">
              <span>
                {t('checkout.logged_in_as')} <strong>{user.email}</strong>
              </span>
              <Link to="/account" className="text-xs underline" style={{ color: accent }}>
                {t('checkout.view_account')}
              </Link>
            </div>
          )}
          {!user && (
            <div className="mb-4 px-4 py-3 rounded-lg border bg-gray-50 text-sm flex items-center justify-between">
              <span>{t('checkout.have_account')}</span>
              <Link to="/login" className="text-xs underline" style={{ color: accent }}>
                {t('checkout.sign_in_faster')}
              </Link>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* ── Step 1: Contact information ───────────────────── */}
          {step === 1 && (
            <form onSubmit={goNext} className="space-y-4">
              <h2 className="text-lg font-semibold">{t('checkout.field.contact.title')}</h2>
              <div>
                <label className="block text-sm font-medium mb-1">{t('checkout.field.contact.email.label')}</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                  placeholder={t('checkout.field.contact.email.placeholder')}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('checkout.field.contact.email.hint')}
                </p>
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={acceptsMarketing}
                  onChange={(e) => setAcceptsMarketing(e.target.checked)}
                  className="mt-0.5 w-4 h-4"
                />
                <span>{t('checkout.field.contact.marketing')}</span>
              </label>

              <button
                type="submit"
                className="w-full py-3 rounded-lg text-white font-medium hover:opacity-90 transition"
                style={{ backgroundColor: accent }}
              >
                {t('checkout.action.continue_to_shipping')}
              </button>
            </form>
          )}

          {/* ── Step 2: Shipping address ──────────────────────── */}
          {step === 2 && (
            <form onSubmit={goNext} className="space-y-4">
              <h2 className="text-lg font-semibold">{t('checkout.field.shipping.title')}</h2>

              {savedAddresses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider font-medium text-gray-500">
                    {t('checkout.field.shipping.saved_addresses')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {savedAddresses.map((a, idx) => {
                      const isSelected = selectedAddressIdx === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => useSavedAddress(idx)}
                          className={`text-start p-3 border rounded-lg text-xs transition ${
                            isSelected ? 'ring-2' : 'hover:bg-gray-50'
                          }`}
                          style={isSelected ? { borderColor: accent, '--tw-ring-color': accent } as React.CSSProperties : undefined}
                        >
                          <p className="font-semibold text-sm mb-0.5">
                            {a.firstName} {a.lastName}
                            {a.isDefault && <span className="ms-1 text-[10px] uppercase text-gray-500">(default)</span>}
                          </p>
                          <p className="text-gray-600">{a.addressLine1}</p>
                          <p className="text-gray-600">
                            {a.city}{a.state ? `, ${a.state}` : ''} {a.postalCode}
                          </p>
                          <p className="text-gray-600">{a.country}</p>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAddressIdx('new');
                        setShipping(blankAddress);
                      }}
                      className={`text-start p-3 border border-dashed rounded-lg text-xs flex items-center justify-center font-medium ${
                        selectedAddressIdx === 'new' ? 'ring-2' : 'hover:bg-gray-50 text-gray-500'
                      }`}
                      style={selectedAddressIdx === 'new' ? { borderColor: accent, '--tw-ring-color': accent } as React.CSSProperties : undefined}
                    >
                      {t('checkout.field.shipping.use_new_address')}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('checkout.field.shipping.first_name.label')}</label>
                  <input type="text" required value={shipping.firstName} onChange={setShippingField('firstName')} className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('checkout.field.shipping.last_name.label')}</label>
                  <input type="text" required value={shipping.lastName} onChange={setShippingField('lastName')} className={inputClass} style={inputStyle} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('checkout.field.shipping.phone.label')}</label>
                <input type="tel" required value={shipping.phone} onChange={setShippingField('phone')} className={inputClass} style={inputStyle} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('checkout.field.shipping.address.label')}</label>
                <input type="text" required value={shipping.addressLine1} onChange={setShippingField('addressLine1')} className={inputClass} style={inputStyle} placeholder={t('checkout.field.shipping.address.placeholder')} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('checkout.field.shipping.address2.label')}</label>
                <input type="text" value={shipping.addressLine2} onChange={setShippingField('addressLine2')} className={inputClass} style={inputStyle} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('checkout.field.shipping.city.label')}</label>
                  {renderCityField(shipping.city, shipping.country, (v) => setShippingValue('city', v), true)}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('checkout.field.shipping.state.label')}</label>
                  <input type="text" value={shipping.state} onChange={setShippingField('state')} className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('checkout.field.shipping.postal.label')}</label>
                  <input type="text" required value={shipping.postalCode} onChange={setShippingField('postalCode')} className={inputClass} style={inputStyle} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('checkout.field.shipping.country.label')}</label>
                {renderCountrySelect(shipping.country, (v) => setShippingValue('country', v), true)}
              </div>

              {user && selectedAddressIdx === 'new' && (
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="mt-0.5 w-4 h-4"
                  />
                  <span>{t('checkout.field.shipping.save_address')}</span>
                </label>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={goBack} className="flex-1 py-3 rounded-lg border font-medium hover:bg-gray-50">
                  {t('checkout.action.back')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-lg text-white font-medium hover:opacity-90 transition"
                  style={{ backgroundColor: accent }}
                >
                  {t('checkout.action.continue_to_payment')}
                </button>
              </div>
            </form>
          )}

          {/* ── Step 3: Payment ─────────────────────────────── */}
          {step === 3 && (
            <form onSubmit={goNext} className="space-y-4">
              <h2 className="text-lg font-semibold">{t('checkout.field.payment.title')}</h2>

              {isZeroTotal ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  {t('checkout.field.payment.gift_card_covers')}
                </div>
              ) : (
                <PaymentMethodPicker
                  value={paymentMethodCode}
                  onChange={setPaymentMethodCode}
                  fieldValues={paymentFieldValues}
                  onFieldChange={setPaymentFieldValues}
                  submitted={paymentSubmitted}
                  accentColor={accent}
                />
              )}

              {/* Billing address */}
              <div className="pt-2">
                <h3 className="text-sm font-semibold mb-2">{t('checkout.field.payment.billing_title')}</h3>
                <label className="flex items-center gap-2 text-sm mb-3">
                  <input
                    type="checkbox"
                    checked={billingSameAsShipping}
                    onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span>{t('checkout.field.payment.billing_same')}</span>
                </label>

                {!billingSameAsShipping && (
                  <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input placeholder={t('checkout.field.shipping.first_name.label')} value={billing.firstName} onChange={setBillingField('firstName')} className={inputClass} style={inputStyle} />
                      <input placeholder={t('checkout.field.shipping.last_name.label')} value={billing.lastName} onChange={setBillingField('lastName')} className={inputClass} style={inputStyle} />
                    </div>
                    <input placeholder={t('checkout.field.shipping.address.label')} value={billing.addressLine1} onChange={setBillingField('addressLine1')} className={inputClass} style={inputStyle} />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {renderCityField(billing.city, billing.country, (v) => setBillingValue('city', v))}
                      <input placeholder={t('checkout.field.shipping.state.label')} value={billing.state} onChange={setBillingField('state')} className={inputClass} style={inputStyle} />
                      <input placeholder={t('checkout.field.shipping.postal.label')} value={billing.postalCode} onChange={setBillingField('postalCode')} className={inputClass} style={inputStyle} />
                    </div>
                    {renderCountrySelect(billing.country, (v) => setBillingValue('country', v))}
                  </div>
                )}
              </div>

              {/* Order notes */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('checkout.field.payment.notes.label')}</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 resize-none"
                  style={inputStyle}
                  placeholder={t('checkout.field.payment.notes.placeholder')}
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={goBack} className="flex-1 py-3 rounded-lg border font-medium hover:bg-gray-50">
                  {t('checkout.action.back')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-lg text-white font-medium hover:opacity-90 transition"
                  style={{ backgroundColor: accent }}
                >
                  {t('checkout.action.review_order')}
                </button>
              </div>
            </form>
          )}

          {/* ── Step 4: Review ──────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">{t('checkout.field.review.title')}</h2>

              <div className="border rounded-lg p-4 text-sm">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold uppercase text-xs text-gray-500">{t('checkout.field.review.contact_label')}</p>
                  <button onClick={() => setStep(1)} className="text-xs underline" style={{ color: accent }}>{t('checkout.action.edit')}</button>
                </div>
                <p>{email}</p>
              </div>

              <div className="border rounded-lg p-4 text-sm">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold uppercase text-xs text-gray-500">{t('checkout.field.review.ship_to_label')}</p>
                  <button onClick={() => setStep(2)} className="text-xs underline" style={{ color: accent }}>{t('checkout.action.edit')}</button>
                </div>
                <p>{shipping.firstName} {shipping.lastName}</p>
                <p className="text-gray-600">{shipping.addressLine1}{shipping.addressLine2 ? `, ${shipping.addressLine2}` : ''}</p>
                <p className="text-gray-600">{shipping.city}{shipping.state ? `, ${shipping.state}` : ''} {shipping.postalCode}</p>
                <p className="text-gray-600">{shipping.country}</p>
                <p className="text-gray-600 mt-1">{shipping.phone}</p>
              </div>

              <div className="border rounded-lg p-4 text-sm">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold uppercase text-xs text-gray-500">{t('checkout.field.review.payment_label')}</p>
                  <button onClick={() => setStep(3)} className="text-xs underline" style={{ color: accent }}>{t('checkout.action.edit')}</button>
                </div>
                <p>{isZeroTotal ? t('checkout.summary.gift_card') : (availablePaymentMethods.find((m) => m.code === paymentMethodCode)?.label || paymentMethodCode || '—')}</p>
                {notes && <p className="text-gray-600 mt-2 text-xs italic">"{notes}"</p>}
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={acceptsTerms}
                  onChange={(e) => setAcceptsTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4"
                />
                <span>
                  {t('checkout.field.review.terms')
                    .split(t('checkout.field.review.terms_and_conditions'))
                    .map((part, i, arr) =>
                      i < arr.length - 1 ? (
                        <React.Fragment key={i}>
                          {part}
                          <Link to="/terms" className="underline">{t('checkout.field.review.terms_and_conditions')}</Link>
                        </React.Fragment>
                      ) : (
                        part
                          .split(t('checkout.field.review.privacy_policy'))
                          .map((p2, j, arr2) =>
                            j < arr2.length - 1 ? (
                              <React.Fragment key={j}>
                                {p2}
                                <Link to="/privacy" className="underline">{t('checkout.field.review.privacy_policy')}</Link>
                              </React.Fragment>
                            ) : (
                              p2
                            )
                          )
                      )
                    )}
                </span>
              </label>

              <div className="flex gap-3">
                <button type="button" onClick={goBack} className="flex-1 py-3 rounded-lg border font-medium hover:bg-gray-50">
                  {t('checkout.action.back')}
                </button>
                <button
                  type="button"
                  onClick={placeOrder}
                  disabled={submitting || !acceptsTerms || (!isZeroTotal && !paymentMethodCode)}
                  className="flex-1 py-3 rounded-lg text-white font-medium hover:opacity-90 transition disabled:opacity-50"
                  style={{ backgroundColor: accent }}
                >
                  {submitting ? t('checkout.action.placing') : t('checkout.action.place_order', { total: formatPrice(summaryTotal) })}
                </button>
              </div>

              {/* Store policy links (delivery / returns / cash-on-delivery /
                  privacy) — only shown for policies the merchant published. */}
              <PolicyLinks
                inline
                className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs opacity-70"
                linkClassName="hover:underline"
              />
            </div>
          )}
        </div>

        {/* ── Order summary sidebar ─────────────────────────────── */}
        <aside className="lg:col-span-1">
          <div className="border rounded-lg p-6 sticky top-24 space-y-4">
            <h3 className="font-semibold">{t('checkout.summary.title')}</h3>

            {(() => {
              const preorderLines = cart.items.filter(
                (i: any) => i.isPreorder,
              ) as any[];
              if (preorderLines.length === 0) return null;
              const dates = preorderLines
                .map((i) => i.preorderExpectedShipDate)
                .filter(Boolean)
                .map((d) => new Date(d).getTime())
                .filter((t2) => !isNaN(t2));
              const latest = dates.length > 0 ? new Date(Math.max(...dates)) : null;
              return (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <p className="font-semibold">{t('checkout.summary.preorder_notice_title')}</p>
                  {latest && (
                    <p className="opacity-90">
                      {t('checkout.summary.preorder_ships_by', { date: latest.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) })}
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {cart.items.map((item) => (
                <div key={item.id} className="flex gap-3 text-sm">
                  <div className="relative">
                    <img
                      src={item.product?.images?.[0] || 'https://placehold.co/64x64'}
                      alt={item.product?.name}
                      className="w-14 h-14 object-cover rounded border"
                    />
                    <span className="absolute -top-1 -end-1 w-5 h-5 rounded-full bg-gray-800 text-white text-[10px] flex items-center justify-center font-bold">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium break-words">{item.product?.name}</p>
                    {item.variant?.name && (
                      <p className="text-gray-500 text-xs break-words">{item.variant.name}</p>
                    )}
                    {(item as any).isPreorder && (
                      <p className="text-amber-600 text-xs font-medium">
                        {t('checkout.summary.preorder_badge')}
                        {(item as any).preorderExpectedShipDate
                          ? ` ${t('checkout.summary.preorder_ships_inline', { date: new Date((item as any).preorderExpectedShipDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) })}`
                          : ''}
                      </p>
                    )}
                    <p className="text-gray-500 text-xs">{t('checkout.summary.price_each', { price: formatPrice(item.price) })}</p>
                  </div>
                  <p className="font-semibold whitespace-nowrap">{formatPrice(item.lineTotal)}</p>
                </div>
              ))}
            </div>

            {/* Discount code — available to guests and signed-in shoppers alike */}
            <div className="pt-2 border-t">
                {appliedDiscount && quote?.discountCode ? (
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {t('checkout.summary.code_applied', { code: quote.discountCode })}
                    </span>
                    <button onClick={removeDiscount} className="text-xs underline text-gray-500">
                      {t('checkout.summary.remove')}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      placeholder={t('checkout.summary.discount_placeholder')}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={applyDiscount}
                      disabled={!discountInput.trim()}
                      className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      {t('checkout.summary.apply')}
                    </button>
                  </div>
                )}
                {quoteError && <p className="text-xs text-red-600 mt-1">{quoteError}</p>}
              </div>

            {/* Gift card */}
            {giftCardsEnabled && (
            <div className="pt-2 border-t space-y-2">
              {appliedGiftCard ? (
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {t('checkout.summary.gift_card_applied', { last4: appliedGiftCard.codeLast4 })}
                    <span className="text-xs text-gray-500 ms-1">
                      {t('checkout.summary.gift_card_balance', { balance: formatPrice(appliedGiftCard.balance) })}
                    </span>
                  </span>
                  <button onClick={removeGiftCard} className="text-xs underline text-gray-500">
                    {t('checkout.summary.remove')}
                  </button>
                </div>
              ) : (
                <>
                  {myGiftCards.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs uppercase tracking-wider font-medium text-gray-500">
                        {t('checkout.summary.your_gift_cards')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {myGiftCards.map((c) => (
                          <button
                            key={c._id}
                            type="button"
                            onClick={() => applyStoredGiftCard(c)}
                            className="px-3 py-1.5 rounded-full border text-xs font-medium hover:bg-gray-50 flex items-center gap-2"
                          >
                            <span className="font-mono">•••• {c.codeLast4}</span>
                            <span className="text-gray-500">{formatPrice(c.balance)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={giftCardInput}
                      onChange={(e) => setGiftCardInput(e.target.value)}
                      placeholder={t('checkout.summary.gift_card_placeholder')}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={applyGiftCard}
                      disabled={!giftCardInput.trim() || giftCardLoading}
                      className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      {giftCardLoading ? '…' : t('checkout.summary.apply')}
                    </button>
                  </div>
                </>
              )}
              {giftCardError && <p className="text-xs text-red-600 mt-1">{giftCardError}</p>}
            </div>
            )}

            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('checkout.summary.subtotal')}</span>
                <span>{formatPrice(summarySubtotal)}</span>
              </div>
              {summaryDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{t('checkout.summary.discount')}</span>
                  <span>−{formatPrice(summaryDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">{t('checkout.summary.shipping')}</span>
                <span>
                  {quote
                    ? summaryShipping > 0
                      ? formatPrice(summaryShipping)
                      : t('checkout.summary.shipping_free')
                    : <span className="text-xs text-gray-400">{t('checkout.summary.shipping_calculated')}</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('checkout.summary.tax')}</span>
                <span>
                  {quote
                    ? summaryTax > 0
                      ? formatPrice(summaryTax)
                      : '—'
                    : <span className="text-xs text-gray-400">{t('checkout.summary.tax_calculated')}</span>}
                </span>
              </div>
              {giftCardDeduction > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{t('checkout.summary.gift_card')}{appliedGiftCard?.codeLast4 ? ` (•••• ${appliedGiftCard.codeLast4})` : ''}</span>
                  <span>−{formatPrice(giftCardDeduction)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t">
                <span>{t('checkout.summary.total')}</span>
                <span>{formatPrice(summaryTotal)}</span>
              </div>
              {quoteLoading && (
                <p className="text-[11px] text-gray-400 text-end">{t('checkout.summary.updating')}</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Checkout;
