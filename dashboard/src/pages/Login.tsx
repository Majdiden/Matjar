import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/auth-context';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Store,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  ShoppingBag,
  TrendingUp,
  Zap,
  Fingerprint,
} from 'lucide-react';
import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialRequestOptionsJSON,
  type PublicKeyCredentialCreationOptionsJSON,
} from '@simplewebauthn/browser';
import { api } from '../lib/api-client';
import type { AuthResponse, StoreChoice } from '../types';

type Step = 'credentials' | 'pick-store' | 'enroll-passkey';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithResponse, isAuthenticated } = useAuth();
  const { t } = useTranslation(['auth', 'common']);

  const [step, setStep] = useState<Step>('credentials');
  // Passkey (WebAuthn platform authenticator) capability + in-flight state.
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);
  // Prefill the email when the signup flow sent the user here ("an account
  // with this email already exists — sign in to add a store").
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email || '');
  const [password, setPassword] = useState('');
  const [stores, setStores] = useState<StoreChoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/dashboard';

  useEffect(() => {
    // Don't bounce away while we're showing the one-time passkey-enrollment
    // prompt — the user IS authenticated at that point but we want them to
    // answer the prompt first.
    if (isAuthenticated && step !== 'enroll-passkey') navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate, step]);

  // Feature-detect a platform authenticator (Touch ID / Face ID / Windows
  // Hello). The passkey affordances stay hidden unless the browser exposes
  // PublicKeyCredential AND a user-verifying platform authenticator is
  // actually available.
  useEffect(() => {
    let cancelled = false;
    const PKC = typeof window !== 'undefined' ? window.PublicKeyCredential : undefined;
    if (PKC?.isUserVerifyingPlatformAuthenticatorAvailable) {
      PKC.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((ok) => { if (!cancelled) setPasskeySupported(!!ok); })
        .catch(() => { if (!cancelled) setPasskeySupported(false); });
    }
    return () => { cancelled = true; };
  }, []);

  const PASSKEY_PROMPT_KEY = 'matjar.passkey.enrollPrompted';

  const finishLogin = async (tenantId?: string) => {
    const result = await login({ email, password, tenantId });
    if (result && 'stores' in result) {
      if (result.stores.length === 1) {
        // Edge case: backend returned exactly one store. Auto-pick it
        // so the merchant isn't forced through a 1-option picker.
        await finishLogin(result.stores[0].id);
        return;
      }
      if (result.stores.length > 1) {
        setStores(result.stores);
        setStep('pick-store');
        return;
      }
    }
    // If we reach here after `login()` resolved, no cross-host hop happened
    // (a hop never returns control), so we're staying on this origin and it's
    // safe to offer passkey enrollment. Token is already in localStorage.
    if (localStorage.getItem('token')) {
      const alreadyPrompted = localStorage.getItem(PASSKEY_PROMPT_KEY) === '1';
      if (passkeySupported && !alreadyPrompted) {
        setStep('enroll-passkey');
        return;
      }
      navigate(from, { replace: true });
    }
  };

  // ── Passwordless sign-in with an enrolled passkey ──
  const handlePasskeyLogin = async () => {
    setError('');
    if (!email.trim()) {
      setError(t('auth.passkey.enter_email_first'));
      return;
    }
    setPasskeyLoading(true);
    try {
      const optRes = await api.auth.webauthn.authenticateOptions(email.trim().toLowerCase());
      const ro = optRes.responseObject;
      if (!ro?.hasCredentials || !ro.options || !ro.flowId) {
        setError(t('auth.passkey.none_found'));
        return;
      }
      const assertion = await startAuthentication({
        optionsJSON: ro.options as PublicKeyCredentialRequestOptionsJSON,
      });
      const verifyRes = (await api.auth.webauthn.authenticateVerify(ro.flowId, assertion)) as AuthResponse;
      const vro = verifyRes.responseObject;
      if (!vro?.accessToken) {
        setError(t('auth.passkey.failed'));
        return;
      }
      await loginWithResponse(vro);
      if (localStorage.getItem('token')) navigate(from, { replace: true });
    } catch (err) {
      const e = err as { name?: string; message?: string };
      // User dismissed the OS prompt — not an error worth shouting about.
      if (e?.name !== 'NotAllowedError' && e?.name !== 'AbortError') {
        setError(e?.message || t('auth.passkey.failed'));
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  // ── Enroll a passkey after a password login (one-time prompt) ──
  const enrollPasskey = async () => {
    setEnrollLoading(true);
    setError('');
    try {
      const optRes = (await api.auth.webauthn.registerOptions()) as { responseObject?: unknown };
      const attResp = await startRegistration({
        optionsJSON: optRes.responseObject as PublicKeyCredentialCreationOptionsJSON,
      });
      await api.auth.webauthn.registerVerify(attResp);
      localStorage.setItem(PASSKEY_PROMPT_KEY, '1');
      navigate(from, { replace: true });
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') {
        skipEnroll();
      } else {
        setError(e?.message || t('auth.passkey.enroll_failed'));
      }
    } finally {
      setEnrollLoading(false);
    }
  };

  const skipEnroll = () => {
    localStorage.setItem(PASSKEY_PROMPT_KEY, '1');
    navigate(from, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError(t('auth.validation.email_required'));
      return;
    }
    setIsLoading(true);
    try {
      await finishLogin();
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message || t('auth.toast.sign_in_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const pickStore = async (tenantId: string) => {
    setError('');
    setIsLoading(true);
    try {
      await finishLogin(tenantId);
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message || t('auth.toast.store_sign_in_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  // "Create a new store" from the picker: the user has valid credentials but
  // isn't signed in yet. Establish a session on THIS origin (no cross-host
  // redirect) using any of their stores, then go to the add-store flow.
  const createAnotherStore = async () => {
    setError('');
    setIsLoading(true);
    try {
      await login({ email, password, tenantId: stores[0]?.id, skipHostRedirect: true });
      navigate('/register?add=1');
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message || t('auth.toast.store_sign_in_failed'));
      setIsLoading(false);
    }
  };

  // One-time post-login prompt to set up biometric sign-in.
  if (step === 'enroll-passkey') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <Store className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Matjar</span>
            <div className="ms-auto">
              <LanguageSwitcher />
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md text-center space-y-6">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Fingerprint className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">{t('auth.passkey.enroll_title')}</h1>
              <p className="text-muted-foreground">{t('auth.passkey.enroll_subtitle')}</p>
            </div>

            {error && (
              <Alert variant="destructive" className="text-start">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Button className="w-full h-11 text-base" onClick={enrollPasskey} disabled={enrollLoading}>
                {enrollLoading ? (
                  <><Loader2 className="me-2 h-4 w-4 animate-spin" /> {t('auth.passkey.enrolling')}</>
                ) : (
                  <><Fingerprint className="me-2 h-4 w-4" /> {t('auth.passkey.enroll_cta')}</>
                )}
              </Button>
              <Button variant="ghost" className="w-full" onClick={skipEnroll} disabled={enrollLoading}>
                {t('auth.passkey.enroll_skip')}
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Store picker takes over the whole screen — it deserves more room than
  // the cramped right column of the login split layout.
  if (step === 'pick-store') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
                <Store className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold tracking-tight">Matjar</span>
            </div>
            <button
              onClick={() => { setStep('credentials'); setError(''); }}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t('auth.pick_store.back_to_sign_in')}
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center">
          <div className="max-w-5xl w-full mx-auto px-6 py-12 sm:py-16">
            <div className="text-center max-w-xl mx-auto mb-10">
              <p className="mb-5 text-base sm:text-lg text-muted-foreground">
                {t('auth.pick_store.signed_in_as')} <span className="font-semibold text-foreground">{email}</span>
              </p>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{t('auth.pick_store.title')}</h1>
              <p className="mt-3 text-muted-foreground">
                {t('auth.pick_store.subtitle')}
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="max-w-xl mx-auto mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stores.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickStore(s.id)}
                  disabled={isLoading}
                  className="group relative text-start p-6 border rounded-2xl bg-card hover:border-foreground/30 hover:shadow-lg transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-xl font-semibold mb-4">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="font-semibold text-lg leading-snug truncate">{s.name}</div>
                  <div className="text-sm text-muted-foreground truncate mt-1">{s.domain}</div>
                  <div className="mt-4 inline-flex items-center text-sm font-medium text-foreground/80 group-hover:text-foreground">
                    {t('auth.pick_store.open_store')}
                    <ArrowRight className="h-4 w-4 ms-1 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
                  </div>
                  {isLoading && (
                    <Loader2 className="absolute top-4 end-4 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </button>
              ))}

              {/* Create another store under this account */}
              <button
                onClick={createAnotherStore}
                disabled={isLoading}
                className="group text-start p-6 border border-dashed rounded-2xl bg-card/50 hover:border-foreground/40 hover:bg-card transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                <div className="h-14 w-14 rounded-xl border-2 border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground text-2xl font-light mb-4 group-hover:border-foreground/40 group-hover:text-foreground transition-colors">
                  +
                </div>
                <div className="font-semibold text-lg leading-snug">{t('auth.pick_store.create_store')}</div>
                <div className="text-sm text-muted-foreground mt-1">{t('auth.pick_store.create_store_hint')}</div>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background relative">
      <div className="absolute top-3 end-3 z-10">
        <LanguageSwitcher />
      </div>
      {/* Left — marketing panel */}
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800 text-white p-12 flex-col justify-between">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 20% 30%, white 0, transparent 40%), radial-gradient(circle at 80% 70%, white 0, transparent 40%)',
        }} />

        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Store className="h-5 w-5" />
            </div>
            <span className="text-xl font-semibold tracking-tight">Matjar</span>
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <h2 className="text-4xl font-bold tracking-tight leading-tight">
              {t('auth.marketing.headline_line1')}<br />
              {t('auth.marketing.headline_line2')}
            </h2>
            <p className="mt-4 text-white/80 text-lg max-w-md">
              {t('auth.marketing.tagline')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 max-w-sm">
            <Feature icon={<ShoppingBag className="h-5 w-5" />} title={t('auth.marketing.feature_products_title')} body={t('auth.marketing.feature_products_body')} />
            <Feature icon={<TrendingUp className="h-5 w-5" />} title={t('auth.marketing.feature_analytics_title')} body={t('auth.marketing.feature_analytics_body')} />
            <Feature icon={<Zap className="h-5 w-5" />} title={t('auth.marketing.feature_speed_title')} body={t('auth.marketing.feature_speed_body')} />
          </div>
        </div>

        <div className="relative text-sm text-white/70">
          {t('auth.marketing.social_proof')}
        </div>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Store className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold tracking-tight">Matjar</span>
          </div>

          <>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">{t('auth.login.title')}</h1>
                <p className="text-muted-foreground">
                  {t('auth.login.subtitle')}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.field.email.label')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('auth.field.email.placeholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    autoFocus
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t('auth.field.password.label')}</Label>
                    <div className="flex items-center gap-3">
                      <Link
                        to="/forgot-password"
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {t('auth.forgot_password_link')}
                      </Link>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <span className="inline-flex items-center gap-1"><EyeOff className="h-3 w-3" /> {t('auth.field.password.hide')}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {t('auth.field.password.show')}</span>
                        )}
                      </button>
                    </div>
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('auth.field.password.placeholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={isLoading}
                  />
                </div>

                <Button type="submit" className="w-full h-11 text-base" disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="me-2 h-4 w-4 animate-spin" /> {t('auth.login.submitting')}</>
                  ) : (
                    <>{t('auth.login.submit')} <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" /></>
                  )}
                </Button>

                {/* Passwordless sign-in — only rendered when the device has a
                    usable platform authenticator (Touch ID / Face ID / Hello). */}
                {passkeySupported && (
                  <>
                    <div className="relative py-1">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-background px-2 text-muted-foreground">{t('auth.passkey.or')}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11 text-base"
                      onClick={handlePasskeyLogin}
                      disabled={isLoading || passkeyLoading}
                    >
                      {passkeyLoading ? (
                        <><Loader2 className="me-2 h-4 w-4 animate-spin" /> {t('auth.passkey.signing_in')}</>
                      ) : (
                        <><Fingerprint className="me-2 h-4 w-4" /> {t('auth.passkey.sign_in')}</>
                      )}
                    </Button>
                  </>
                )}
              </form>

              <div className="text-sm text-muted-foreground text-center">
                {t('auth.login.new_to_matjar')}{' '}
                <Link to="/register" className="text-foreground font-medium hover:underline">
                  {t('auth.login.create_store')}
                </Link>
              </div>
            </>
        </div>
      </div>
    </div>
  );
};

const Feature: React.FC<{ icon: React.ReactNode; title: string; body: string }> = ({ icon, title, body }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 h-8 w-8 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div>
      <div className="font-medium">{title}</div>
      <div className="text-sm text-white/70">{body}</div>
    </div>
  </div>
);
