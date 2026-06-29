import React, { Fragment, useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import {
  Store,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Shirt,
  Smartphone,
  UtensilsCrossed,
  Dumbbell,
  BookOpen,
  Baby,
  Home as HomeIcon,
  ShoppingBag,
} from 'lucide-react';
import { api } from '../lib/api-client';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { toast } from 'sonner';

interface ThemeOption {
  _id: string;
  name: string;
  slug: string;
  description: string;
  categories: string[];
  settings?: {
    colors?: { primary?: string; secondary?: string; accent?: string; background?: string };
  };
  statistics?: { rating: number; installCount: number };
}

type Step = 'welcome' | 'account' | 'store' | 'niche' | 'theme';

const STEPS: Step[] = ['welcome', 'account', 'store', 'niche', 'theme'];

// Public storefront domain suffix shown next to the subdomain field.
// Configurable via VITE_STORE_DOMAIN_SUFFIX; defaults to invoila.io.
const STORE_DOMAIN_SUFFIX = import.meta.env.VITE_STORE_DOMAIN_SUFFIX || 'invoila.io';

const NICHE_IDS = ['fashion', 'electronics', 'food', 'sports', 'books', 'toys', 'home', 'general'] as const;

const NICHE_ICONS: Record<string, React.ReactNode> = {
  fashion: <Shirt className="h-5 w-5" />,
  electronics: <Smartphone className="h-5 w-5" />,
  food: <UtensilsCrossed className="h-5 w-5" />,
  sports: <Dumbbell className="h-5 w-5" />,
  books: <BookOpen className="h-5 w-5" />,
  toys: <Baby className="h-5 w-5" />,
  home: <HomeIcon className="h-5 w-5" />,
  general: <ShoppingBag className="h-5 w-5" />,
};

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['auth', 'common']);

  const [step, setStep] = useState<Step>('welcome');
  const [transitionDir, setTransitionDir] = useState<'in' | 'out'>('in');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    storeName: '',
    subdomain: '',
    niche: '',
    themeSlug: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [subdomainTouched, setSubdomainTouched] = useState(false);
  const [subdomainChecking, setSubdomainChecking] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  // Upfront email-exists check — if the email already has an account we stop
  // the user here and point them to sign in (to add a store to that account)
  // instead of letting them fail at the final register call.
  const [emailExists, setEmailExists] = useState(false);
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [themesLoading, setThemesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  // Auto-suggest subdomain from store name until the user edits the field
  // directly. We re-sync on every keystroke so "Standards" fills the whole
  // slug, not just "s".
  useEffect(() => {
    if (subdomainTouched) return;
    const slug = form.storeName
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['']/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 63);
    setForm(p => (p.subdomain === slug ? p : { ...p, subdomain: slug }));
  }, [form.storeName, subdomainTouched]);

  // Debounced subdomain availability check
  useEffect(() => {
    if (form.subdomain.length < 3) { setSubdomainAvailable(null); return; }
    setSubdomainChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = (await api.domains.checkSubdomain(form.subdomain)) as {
          data?: { available?: boolean };
          responseObject?: { available?: boolean };
        };
        setSubdomainAvailable(res.data?.available ?? res.responseObject?.available ?? null);
      } catch {
        setSubdomainAvailable(null);
      } finally {
        setSubdomainChecking(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [form.subdomain]);

  // Debounced email-exists check (only for a syntactically valid email)
  useEffect(() => {
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setEmailExists(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.auth.checkEmail(email) as { data?: { exists?: boolean } };
        // Guard against a stale response after the field changed again.
        if (form.email.trim().toLowerCase() === email) setEmailExists(!!res.data?.exists);
      } catch {
        setEmailExists(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [form.email]);

  // Load themes once we reach the theme step
  useEffect(() => {
    if (step !== 'theme' || themes.length > 0) return;
    setThemesLoading(true);
    api.themes.getActive()
      .then((res) => {
        const r = res as { data?: { themes?: ThemeOption[] } };
        setThemes(r.data?.themes || []);
      })
      .catch(() => {})
      .finally(() => setThemesLoading(false));
    // themes.length guard above ensures single load per step entry; we
    // intentionally omit it from deps to avoid re-running when the list
    // populates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Pre-filter themes by niche
  const relevantThemes = useMemo(() => {
    if (!form.niche || form.niche === 'general') return themes;
    const matched = themes.filter(th => th.categories?.includes(form.niche));
    return matched.length > 0 ? matched : themes;
  }, [themes, form.niche]);

  // Auto-pick first theme when list resolves. We intentionally depend only
  // on the resolved list — reading form.themeSlug here would re-run every
  // keystroke; the guard below already short-circuits once a value is set.
  useEffect(() => {
    if (!form.themeSlug && relevantThemes.length > 0) {
      setForm(p => ({ ...p, themeSlug: relevantThemes[0].slug }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relevantThemes]);

  const update = (k: keyof typeof form, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    setTouched(prev => (prev[k] ? prev : { ...prev, [k]: true }));
  };

  const goTo = (target: Step) => {
    if (target === step) return;
    setError('');
    setTransitionDir('out');
    window.setTimeout(() => {
      setStep(target);
      setTransitionDir('in');
    }, 360);
  };
  const next = () => {
    tryAdvance(() => {
      const i = STEPS.indexOf(step);
      if (i < STEPS.length - 1) goTo(STEPS[i + 1]);
    });
  };
  const back = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) goTo(STEPS[i - 1]);
  };

  // Per-field validation — errors are rendered inline and must all clear
  // before the user can advance. Each rule mirrors a backend constraint so
  // the client catches obvious mistakes without a round-trip.
  const validateStep = (s: Step): Partial<Record<keyof typeof form, string>> => {
    const errs: Partial<Record<keyof typeof form, string>> = {};
    if (s === 'account') {
      const name = form.name.trim();
      if (!name) errs.name = t('auth.field.name.error.required');
      else if (name.length < 2) errs.name = t('auth.field.name.error.too_short');

      const email = form.email.trim();
      if (!email) errs.email = t('auth.validation.email_field_required');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
        errs.email = t('auth.validation.email_invalid');
      else if (emailExists) errs.email = t('auth.validation.email_exists', { defaultValue: 'An account with this email already exists. Sign in to add a store.' });

      const pw = form.password;
      // Mirror the backend registerTenantSchema EXACTLY (>=8, lower+upper+digit)
      // so a weak-but-passing password is caught here on the field, not only
      // at final submit by the server.
      if (!pw) errs.password = t('auth.field.password.error.required');
      else if (pw.length < 8) errs.password = t('auth.field.password.error.too_short');
      else if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw))
        errs.password = t('auth.field.password.error.weak');
    }
    if (s === 'store') {
      const name = form.storeName.trim();
      if (!name) errs.storeName = t('auth.field.store_name.error.required');
      else if (name.length < 2) errs.storeName = t('auth.field.store_name.error.too_short');

      const sd = form.subdomain;
      if (!sd) errs.subdomain = t('auth.field.subdomain.error.required');
      else if (sd.length < 3) errs.subdomain = t('auth.field.subdomain.error.too_short');
      else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(sd))
        errs.subdomain = t('auth.field.subdomain.error.invalid');
      else if (subdomainChecking) errs.subdomain = t('auth.field.subdomain.error.checking');
      else if (subdomainAvailable === false) errs.subdomain = t('auth.field.subdomain.error.taken');
      else if (subdomainAvailable !== true) errs.subdomain = t('auth.field.subdomain.error.waiting');
    }
    if (s === 'niche' && !form.niche) errs.niche = t('auth.register.pick_niche_error');
    if (s === 'theme' && !form.themeSlug) errs.themeSlug = t('auth.register.pick_theme_error');
    return errs;
  };

  // Per-field "touched" — a field's error is only shown after the user has
  // interacted with it (changed it, or hit Continue). Keeps the first
  // render of each step clean but updates live afterwards.
  const [touched, setTouched] = useState<Partial<Record<keyof typeof form, boolean>>>({});

  // Fields relevant to each step, used for bulk-touch when Continue is hit.
  const STEP_FIELDS: Partial<Record<Step, (keyof typeof form)[]>> = {
    account: ['name', 'email', 'password'],
    store: ['storeName', 'subdomain'],
    niche: ['niche'],
    theme: ['themeSlug'],
  };

  // Errors are computed from form state live on every render. `touched`
  // decides which messages are *visible* — so the rule and the display
  // are never out of sync.
  const liveErrors = validateStep(step);
  const fieldErrors: Partial<Record<keyof typeof form, string>> = {};
  for (const [k, v] of Object.entries(liveErrors)) {
    if (touched[k as keyof typeof form] && v) {
      fieldErrors[k as keyof typeof form] = v;
    }
  }

  const tryAdvance = (onOk: () => void) => {
    if (step === 'welcome') { onOk(); return; }
    // Mark every field on this step touched so any outstanding errors
    // reveal themselves now.
    const fields = STEP_FIELDS[step] || [];
    setTouched(prev => {
      const next = { ...prev };
      for (const f of fields) next[f] = true;
      return next;
    });
    const errs = validateStep(step);
    if (Object.keys(errs).length === 0) onOk();
  };

  const canAdvance = (): boolean => {
    if (step === 'welcome') return true;
    return Object.keys(validateStep(step)).length === 0;
  };

  const submit = async () => {
    const errs = validateStep('theme');
    setTouched(prev => ({ ...prev, themeSlug: true }));
    if (Object.keys(errs).length > 0) return;
    // Re-run prior-step validations as a final guard so nothing slipped in
    // via direct URL / back button after clearing an error.
    const priorErrs = {
      ...validateStep('account'),
      ...validateStep('store'),
      ...validateStep('niche'),
    };
    if (Object.keys(priorErrs).length > 0) {
      setError(t('auth.register.general_error'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const response = (await api.auth.register({
        name: form.name,
        email: form.email,
        password: form.password,
        storeName: form.storeName,
        subdomain: form.subdomain,
        themeSlug: form.themeSlug,
        niche: form.niche,
        subscriptionPlan: 'trial',
      })) as {
        responseObject?: {
          subdomain?: string;
          domain?: string;
          setupToken?: string;
          tenantId?: string;
        };
      };

      sessionStorage.setItem('setupEmail', form.email);
      sessionStorage.setItem('setupPassword', form.password);
      sessionStorage.setItem('setupDomain', response.responseObject?.subdomain || response.responseObject?.domain || form.subdomain);
      sessionStorage.setItem('setupToken', response.responseObject?.setupToken || '');

      toast.success(t('auth.toast.store_created'));
      const tenantId = response.responseObject?.tenantId;
      navigate(`/setup?tenantId=${tenantId}`, { replace: true });
    } catch (err) {
      const e = err as { message?: string; error?: string };
      const msg = e?.message || e?.error || t('auth.toast.sign_in_failed');
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar with progress */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-6 py-4 grid grid-cols-[1fr_auto_1fr] items-center gap-6">
          <div className="flex items-center gap-2 justify-self-start">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <Store className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Matjar</span>
          </div>
          <div className="w-64 max-w-full">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground text-center">
              {t('auth.register.step_of', { current: stepIndex + 1, total: STEPS.length })}
            </div>
          </div>
          <div className="justify-self-end">
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 sm:py-16">
        <style>{`
          @keyframes onbIn { 0% { opacity: 0; transform: translateY(18px); } 100% { opacity: 1; transform: translateY(0); } }
          @keyframes onbOut { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-14px); } }
          .onb-step { animation: onbIn 600ms cubic-bezier(.2,.7,.2,1) both; }
          .onb-step.leaving { animation: onbOut 360ms cubic-bezier(.4,.1,.6,1) forwards; }
        `}</style>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 'welcome' && (() => {
          const title = t('auth.register.welcome_title');
          // Arabic letters require contextual shaping across adjacent
          // characters in the same text run. Splitting per-glyph into
          // inline-block <span>s forces every letter into isolated form
          // (the visible bug: "\u0645\u062A\u062C\u0631\u0643" rendering as "\u0645 \u062A \u062C \u0631 \u0643"). When
          // Arabic codepoints are present, cascade per-word instead so
          // each word stays a single shapeable run.
          const hasArabic = /[\u0600-\u06FF]/.test(title);
          const units = hasArabic ? title.split(' ') : [...title];
          const perUnit = hasArabic ? 220 : 55;
          const buttonDelay = units.length * perUnit + 200;
          const linkDelay = buttonDelay + 250;
          return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
              <style>{`
                @keyframes onboardLetterIn {
                  0% { opacity: 0; filter: blur(14px); transform: translateY(10px); }
                  100% { opacity: 1; filter: blur(0); transform: translateY(0); }
                }
                @keyframes onboardFadeIn {
                  0% { opacity: 0; transform: translateY(8px); }
                  100% { opacity: 1; transform: translateY(0); }
                }
                .onb-letter { display: inline-block; opacity: 0; animation: onboardLetterIn 700ms cubic-bezier(.2,.7,.2,1) forwards; }
                .onb-letter-space { width: 0.28em; }
                .onb-fade { opacity: 0; animation: onboardFadeIn 600ms cubic-bezier(.2,.7,.2,1) forwards; }
              `}</style>
              <h1 className={`font-bold leading-[1.02] whitespace-nowrap text-[clamp(1.75rem,6vw,5rem)] px-4 ${hasArabic ? '' : 'tracking-tight'}`}>
                {hasArabic
                  ? units.map((word, i) => (
                      <Fragment key={i}>
                        {i > 0 && ' '}
                        <span
                          className="onb-letter"
                          style={{ animationDelay: `${i * perUnit}ms` }}
                        >
                          {word}
                        </span>
                      </Fragment>
                    ))
                  : units.map((ch, i) => (
                      <span
                        key={i}
                        className={`onb-letter${ch === ' ' ? ' onb-letter-space' : ''}`}
                        style={{ animationDelay: `${i * perUnit}ms` }}
                      >
                        {ch === ' ' ? '\u00A0' : ch}
                      </span>
                    ))}
              </h1>
              <div
                className="onb-fade mt-10"
                style={{ animationDelay: `${buttonDelay}ms` }}
              >
                <Button size="lg" onClick={next} className="h-12 px-8 text-base">
                  {t('common:action.get_started')} <ChevronRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                </Button>
              </div>
              <div
                className="onb-fade mt-6 text-sm text-muted-foreground"
                style={{ animationDelay: `${linkDelay}ms` }}
              >
                {t('auth.register.already_have_account')}{' '}
                <Link to="/login" className="text-foreground font-medium hover:underline">
                  {t('common:action.sign_in')}
                </Link>
              </div>
            </div>
          );
        })()}

        {step === 'account' && (
          <div className={`space-y-8 onb-step${transitionDir === "out" ? " leaving" : ""}`}>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">{t('auth.register.account_title')}</h1>
              <p className="mt-2 text-muted-foreground">{t('auth.register.account_subtitle')}</p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">{t('auth.field.name.label')}</Label>
                <Input id="name" placeholder={t('auth.field.name.placeholder')} value={form.name}
                  onChange={e => update('name', e.target.value)} autoFocus
                  aria-invalid={!!fieldErrors.name} />
                {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.field.email.label')}</Label>
                <Input id="email" type="email" placeholder={t('auth.field.email.placeholder')}
                  value={form.email} autoComplete="email"
                  onChange={e => update('email', e.target.value)}
                  aria-invalid={!!fieldErrors.email || emailExists} />
                {emailExists ? (
                  <p className="text-xs text-destructive">
                    {t('auth.validation.email_exists', { defaultValue: 'An account with this email already exists.' })}{' '}
                    <Link to="/login" state={{ email: form.email }} className="font-semibold underline hover:no-underline">
                      {t('auth.register.sign_in_to_add_store', { defaultValue: 'Sign in to add a store' })}
                    </Link>
                  </p>
                ) : fieldErrors.email ? (
                  <p className="text-xs text-destructive">{fieldErrors.email}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.field.password.label')}</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'}
                    placeholder={t('auth.field.password.placeholder_register')} minLength={8}
                    value={form.password}
                    onChange={e => update('password', e.target.value)} className="pe-10"
                    aria-invalid={!!fieldErrors.password} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Live requirements checklist — turns green as each backend
                    rule is met, so the password is validated on the field
                    instead of failing at final submit. */}
                {form.password ? (
                  <ul className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                    {[
                      { ok: form.password.length >= 8, label: t('auth.field.password.req.length', { defaultValue: 'At least 8 characters' }) },
                      { ok: /[a-z]/.test(form.password), label: t('auth.field.password.req.lower', { defaultValue: 'One lowercase letter' }) },
                      { ok: /[A-Z]/.test(form.password), label: t('auth.field.password.req.upper', { defaultValue: 'One uppercase letter' }) },
                      { ok: /\d/.test(form.password), label: t('auth.field.password.req.digit', { defaultValue: 'One number' }) },
                    ].map((r) => (
                      <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.ok ? 'text-green-600' : 'text-muted-foreground'}`}>
                        <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] ${r.ok ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                          {r.ok ? '✓' : '•'}
                        </span>
                        {r.label}
                      </li>
                    ))}
                  </ul>
                ) : fieldErrors.password ? (
                  <p className="text-xs text-destructive">{fieldErrors.password}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('auth.field.password.help')}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'store' && (
          <div className={`space-y-8 onb-step${transitionDir === "out" ? " leaving" : ""}`}>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">{t('auth.register.store_title')}</h1>
              <p className="mt-2 text-muted-foreground">{t('auth.register.store_subtitle')}</p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="storeName">{t('auth.field.store_name.label')}</Label>
                <Input id="storeName" placeholder={t('auth.field.store_name.placeholder')}
                  value={form.storeName} autoFocus
                  onChange={e => update('storeName', e.target.value)}
                  aria-invalid={!!fieldErrors.storeName} />
                {fieldErrors.storeName && <p className="text-xs text-destructive">{fieldErrors.storeName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subdomain">{t('auth.field.subdomain.label')}</Label>
                <div className="flex items-center gap-0 border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                  <Input
                    id="subdomain"
                    placeholder={t('auth.field.subdomain.placeholder')}
                    value={form.subdomain}
                    onChange={e => {
                      setSubdomainTouched(true);
                      update('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                    }}
                    className="border-0 focus-visible:ring-0 shadow-none"
                  />
                  <div className="px-3 text-sm text-muted-foreground bg-muted h-10 flex items-center whitespace-nowrap" dir="ltr">
                    .{STORE_DOMAIN_SUFFIX}
                  </div>
                  <div className="px-3 h-10 flex items-center bg-muted">
                    {subdomainChecking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {!subdomainChecking && subdomainAvailable === true && <Check className="h-4 w-4 text-green-500" />}
                    {!subdomainChecking && subdomainAvailable === false && <X className="h-4 w-4 text-destructive" />}
                  </div>
                </div>
                {fieldErrors.subdomain ? (
                  <p className="text-xs text-destructive">{fieldErrors.subdomain}</p>
                ) : subdomainAvailable === false ? (
                  <p className="text-xs text-destructive">{t('auth.field.subdomain.error.taken')}</p>
                ) : subdomainAvailable === true ? (
                  <p className="text-xs text-green-600">{t('auth.field.subdomain.available')}</p>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {step === 'niche' && (
          <div className={`space-y-8 onb-step${transitionDir === "out" ? " leaving" : ""}`}>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">{t('auth.register.niche_title')}</h1>
              <p className="mt-2 text-muted-foreground">{t('auth.register.niche_subtitle')}</p>
              {fieldErrors.niche && <p className="mt-2 text-xs text-destructive">{fieldErrors.niche}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {NICHE_IDS.map(id => {
                const selected = form.niche === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => update('niche', id)}
                    className={`text-start p-4 rounded-xl border transition-all flex items-center gap-3 ${
                      selected
                        ? 'border-foreground bg-accent'
                        : 'border-border hover:border-foreground/30 hover:bg-accent/50'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                      selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                    }`}>
                      {NICHE_ICONS[id]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{t(`auth.niche.${id}.label`)}</div>
                      <div className="text-xs text-muted-foreground">{t(`auth.niche.${id}.tagline`)}</div>
                    </div>
                    {selected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 'theme' && (
          <div className={`space-y-8 onb-step${transitionDir === "out" ? " leaving" : ""}`}>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">{t('auth.register.theme_title')}</h1>
              <p className="mt-2 text-muted-foreground">{t('auth.register.theme_subtitle')}</p>
              {fieldErrors.themeSlug && <p className="mt-2 text-xs text-destructive">{fieldErrors.themeSlug}</p>}
            </div>

            {themesLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-56 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : relevantThemes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {t('auth.register.no_themes')}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {relevantThemes.map(theme => {
                  const selected = form.themeSlug === theme.slug;
                  const colors = theme.settings?.colors;
                  return (
                    <button
                      key={theme._id}
                      type="button"
                      onClick={() => update('themeSlug', theme.slug)}
                      className={`relative text-start rounded-xl overflow-hidden border-2 transition-all ${
                        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-foreground/20'
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-2 end-2 z-10 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div className="h-28" style={{ backgroundColor: colors?.primary || '#6366f1' }} />
                      <div className="p-3 bg-card">
                        <div className="font-medium text-sm">{theme.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{theme.description}</div>
                        <div className="flex gap-1 mt-2">
                          {colors?.primary && <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: colors.primary }} />}
                          {colors?.secondary && <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: colors.secondary }} />}
                          {colors?.accent && <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: colors.accent }} />}
                          <Badge variant="secondary" className="ms-auto text-[10px]">{theme.categories?.[0] || t('auth.register.category_general')}</Badge>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Nav buttons */}
        {step !== 'welcome' && (
          <div className="mt-12 flex items-center justify-between">
            <Button variant="ghost" onClick={back} disabled={submitting}>
              <ChevronLeft className="me-1 h-4 w-4 rtl:rotate-180" /> {t('common:action.back')}
            </Button>

            {step === 'theme' ? (
              <Button size="lg" onClick={submit} disabled={submitting || !canAdvance()} className="h-12 px-8">
                {submitting ? (
                  <><Loader2 className="me-2 h-4 w-4 animate-spin" /> {t('auth.register.creating')}</>
                ) : (
                  <>{t('auth.register.launch')}</>
                )}
              </Button>
            ) : (
              <Button size="lg" onClick={next} disabled={!canAdvance()} className="h-12 px-8">
                {t('common:action.continue')} <ChevronRight className="ms-2 h-4 w-4 rtl:rotate-180" />
              </Button>
            )}
          </div>
        )}

      </main>
    </div>
  );
};
