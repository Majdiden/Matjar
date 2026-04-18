import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

const NICHES: { id: string; label: string; tagline: string; icon: React.ReactNode }[] = [
  { id: 'fashion', label: 'Fashion & Apparel', tagline: 'Clothes, accessories, style', icon: <Shirt className="h-5 w-5" /> },
  { id: 'electronics', label: 'Electronics', tagline: 'Gadgets and devices', icon: <Smartphone className="h-5 w-5" /> },
  { id: 'food', label: 'Food & Grocery', tagline: 'Edibles, pantry, fresh', icon: <UtensilsCrossed className="h-5 w-5" /> },
  { id: 'sports', label: 'Sports & Fitness', tagline: 'Gear and activewear', icon: <Dumbbell className="h-5 w-5" /> },
  { id: 'books', label: 'Books & Media', tagline: 'Print, digital, learning', icon: <BookOpen className="h-5 w-5" /> },
  { id: 'toys', label: 'Kids & Toys', tagline: 'Play, learn, grow', icon: <Baby className="h-5 w-5" /> },
  { id: 'home', label: 'Home & Decor', tagline: 'Furniture and essentials', icon: <HomeIcon className="h-5 w-5" /> },
  { id: 'general', label: 'A bit of everything', tagline: 'Mixed catalog', icon: <ShoppingBag className="h-5 w-5" /> },
];

export const Register: React.FC = () => {
  const navigate = useNavigate();

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
    const matched = themes.filter(t => t.categories?.includes(form.niche));
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
      if (!name) errs.name = 'Please enter your name.';
      else if (name.length < 2) errs.name = 'Name must be at least 2 characters.';

      const email = form.email.trim();
      if (!email) errs.email = 'Email is required.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
        errs.email = 'That doesn\u2019t look like a valid email.';

      const pw = form.password;
      if (!pw) errs.password = 'Password is required.';
      else if (pw.length < 8) errs.password = 'Use at least 8 characters.';
      else if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw))
        errs.password = 'Include at least one letter and one number.';
    }
    if (s === 'store') {
      const name = form.storeName.trim();
      if (!name) errs.storeName = 'Your store needs a name.';
      else if (name.length < 2) errs.storeName = 'Store name is too short.';

      const sd = form.subdomain;
      if (!sd) errs.subdomain = 'Pick a URL for your store.';
      else if (sd.length < 3) errs.subdomain = 'At least 3 characters.';
      else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(sd))
        errs.subdomain = 'Lowercase letters, numbers and hyphens only. No leading or trailing hyphen.';
      else if (subdomainChecking) errs.subdomain = 'Checking availability\u2026';
      else if (subdomainAvailable === false) errs.subdomain = 'That URL is taken \u2014 try another.';
      else if (subdomainAvailable !== true) errs.subdomain = 'Waiting for availability check\u2026';
    }
    if (s === 'niche' && !form.niche) errs.niche = 'Pick one to continue.';
    if (s === 'theme' && !form.themeSlug) errs.themeSlug = 'Pick a theme to continue.';
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
      setError('Something earlier needs a fix. Go back and check each step.');
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

      toast.success('Your store is being created!');
      const tenantId = response.responseObject?.tenantId;
      navigate(`/setup?tenantId=${tenantId}`, { replace: true });
    } catch (err) {
      const e = err as { message?: string; error?: string };
      const msg = e?.message || e?.error || 'Something went wrong. Try again.';
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
              Step {stepIndex + 1} of {STEPS.length}
            </div>
          </div>
          <div />
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
          const title = "Let's open your store.";
          const letters = [...title];
          const perLetter = 55;
          const buttonDelay = letters.length * perLetter + 200;
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
              <h1 className="font-bold tracking-tight leading-[1.02] whitespace-nowrap text-[clamp(1.75rem,6vw,5rem)] px-4">
                {letters.map((ch, i) => (
                  <span
                    key={i}
                    className={`onb-letter${ch === ' ' ? ' onb-letter-space' : ''}`}
                    style={{ animationDelay: `${i * perLetter}ms` }}
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
                  Get started <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <div
                className="onb-fade mt-6 text-sm text-muted-foreground"
                style={{ animationDelay: `${linkDelay}ms` }}
              >
                Already have an account?{' '}
                <Link to="/login" className="text-foreground font-medium hover:underline">
                  Sign in
                </Link>
              </div>
            </div>
          );
        })()}

        {step === 'account' && (
          <div className={`space-y-8 onb-step${transitionDir === "out" ? " leaving" : ""}`}>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">First, who are you?</h1>
              <p className="mt-2 text-muted-foreground">We'll use this to sign you in — email and password only.</p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" placeholder="Jamie Rivera" value={form.name}
                  onChange={e => update('name', e.target.value)} autoFocus
                  aria-invalid={!!fieldErrors.name} />
                {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com"
                  value={form.email} autoComplete="email"
                  onChange={e => update('email', e.target.value)}
                  aria-invalid={!!fieldErrors.email} />
                {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters" minLength={8}
                    value={form.password}
                    onChange={e => update('password', e.target.value)} className="pr-10"
                    aria-invalid={!!fieldErrors.password} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p className="text-xs text-destructive">{fieldErrors.password}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">At least 8 characters, with a letter and a number.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'store' && (
          <div className={`space-y-8 onb-step${transitionDir === "out" ? " leaving" : ""}`}>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">Name your store.</h1>
              <p className="mt-2 text-muted-foreground">This is what shoppers will see. You can rename it later.</p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="storeName">Store name</Label>
                <Input id="storeName" placeholder="Rivera & Co."
                  value={form.storeName} autoFocus
                  onChange={e => update('storeName', e.target.value)}
                  aria-invalid={!!fieldErrors.storeName} />
                {fieldErrors.storeName && <p className="text-xs text-destructive">{fieldErrors.storeName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subdomain">Your store URL</Label>
                <div className="flex items-center gap-0 border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                  <Input
                    id="subdomain"
                    placeholder="rivera-co"
                    value={form.subdomain}
                    onChange={e => {
                      setSubdomainTouched(true);
                      update('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                    }}
                    className="border-0 focus-visible:ring-0 shadow-none"
                  />
                  <div className="px-3 text-sm text-muted-foreground bg-muted h-10 flex items-center whitespace-nowrap">
                    .matjar.com
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
                  <p className="text-xs text-destructive">That URL is taken — try another.</p>
                ) : subdomainAvailable === true ? (
                  <p className="text-xs text-green-600">Nice — that one's yours.</p>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {step === 'niche' && (
          <div className={`space-y-8 onb-step${transitionDir === "out" ? " leaving" : ""}`}>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">What will you sell?</h1>
              <p className="mt-2 text-muted-foreground">We'll suggest themes and defaults that fit your niche.</p>
              {fieldErrors.niche && <p className="mt-2 text-xs text-destructive">{fieldErrors.niche}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {NICHES.map(n => {
                const selected = form.niche === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => update('niche', n.id)}
                    className={`text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${
                      selected
                        ? 'border-foreground bg-accent'
                        : 'border-border hover:border-foreground/30 hover:bg-accent/50'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                      selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                    }`}>
                      {n.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{n.label}</div>
                      <div className="text-xs text-muted-foreground">{n.tagline}</div>
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
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">Pick a starting look.</h1>
              <p className="mt-2 text-muted-foreground">You can customize or switch themes anytime from the dashboard.</p>
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
                No themes available — a default will be applied.
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
                      className={`relative text-left rounded-xl overflow-hidden border-2 transition-all ${
                        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-foreground/20'
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-2 right-2 z-10 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
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
                          <Badge variant="secondary" className="ml-auto text-[10px]">{theme.categories?.[0] || 'general'}</Badge>
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
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>

            {step === 'theme' ? (
              <Button size="lg" onClick={submit} disabled={submitting || !canAdvance()} className="h-12 px-8">
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating your store...</>
                ) : (
                  <>Launch my store</>
                )}
              </Button>
            ) : (
              <Button size="lg" onClick={next} disabled={!canAdvance()} className="h-12 px-8">
                Continue <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        )}

      </main>
    </div>
  );
};
