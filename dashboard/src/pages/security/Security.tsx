import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Fingerprint,
  Loader2,
  Trash2,
  ShieldCheck,
  Mail,
  CheckCircle2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from '@simplewebauthn/browser';
import { api } from '../../lib/api-client';
import { useAuth } from '../../contexts/auth-context';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { OtpInput } from '../../components/OtpInput';
import { useConfirm } from '../../components/ui/use-confirm';
import { toast } from 'sonner';

const OTP_LENGTH = 4;

interface Passkey {
  id: string;
  name: string;
  deviceType?: string | null;
  backedUp?: boolean;
  createdAt?: string | null;
  lastUsedAt?: string | null;
}

/**
 * Security settings body — enroll/remove passkeys and verify the account
 * email. Rendered both as the standalone `/dashboard/security` route and as a
 * tab inside the Settings page. All strings come from the `security` i18n
 * namespace (en + ar); layout uses logical CSS so it mirrors under RTL.
 */
export const SecurityPanel: React.FC = () => {
  const { t, i18n } = useTranslation(['security', 'common']);
  const { user } = useAuth();

  // ── Passkeys ──
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [passkeyName, setPasskeyName] = useState('');
  const confirm = useConfirm();

  // ── Email verification ──
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [email, setEmail] = useState(user?.email || '');
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpDevCode, setOtpDevCode] = useState<string | null>(null);

  // Feature-detect a platform authenticator (Touch ID / Face ID / Hello).
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

  const loadPasskeys = useCallback(async () => {
    setLoadingPasskeys(true);
    try {
      const res = await api.auth.webauthn.listCredentials();
      setPasskeys(res.responseObject?.passkeys || []);
    } catch {
      setPasskeys([]);
    } finally {
      setLoadingPasskeys(false);
    }
  }, []);

  // Load current email-verification status + email from /me.
  const loadStatus = useCallback(async () => {
    try {
      const res = (await api.auth.me()) as {
        responseObject?: { email?: string; emailVerified?: boolean };
      };
      const ro = res.responseObject;
      if (ro) {
        setEmailVerified(!!ro.emailVerified);
        if (ro.email) setEmail(ro.email);
      }
    } catch {
      setEmailVerified(false);
    }
  }, []);

  useEffect(() => { void loadPasskeys(); void loadStatus(); }, [loadPasskeys, loadStatus]);

  // Resend countdown.
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const id = window.setTimeout(() => setOtpCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [otpCooldown]);

  // ── Enroll a passkey ──
  const enrollPasskey = async () => {
    setEnrolling(true);
    try {
      const optRes = (await api.auth.webauthn.registerOptions()) as { responseObject?: unknown };
      const attResp = await startRegistration({
        optionsJSON: optRes.responseObject as PublicKeyCredentialCreationOptionsJSON,
      });
      await api.auth.webauthn.registerVerify(attResp, passkeyName.trim() || undefined);
      // Mark the post-login one-time prompt as answered so it doesn't nag.
      localStorage.setItem('matjar.passkey.enrollPrompted', '1');
      setPasskeyName('');
      toast.success(t('security.passkey.toast_added'));
      await loadPasskeys();
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e?.name !== 'NotAllowedError' && e?.name !== 'AbortError') {
        toast.error(e?.message || t('security.passkey.toast_add_failed'));
      }
    } finally {
      setEnrolling(false);
    }
  };

  const removePasskey = async (pk: Passkey) => {
    const ok = await confirm({
      title: t('security.passkey.remove_title'),
      description: t('security.passkey.remove_desc', { name: pk.name }),
      confirmText: t('security.passkey.remove_confirm'),
      cancelText: t('common:action.cancel'),
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.auth.webauthn.deleteCredential(pk.id);
      toast.success(t('security.passkey.toast_removed'));
      await loadPasskeys();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('security.passkey.toast_remove_failed'));
    }
  };

  // ── Email verification ──
  const startEmailVerify = async () => {
    setOtpSending(true);
    setOtpError('');
    setOtpDevCode(null);
    try {
      const res = await api.auth.emailVerifyRequest();
      const ro = res.responseObject;
      setOtpOpen(true);
      setOtpCode('');
      setOtpCooldown(ro?.cooldownSeconds || 45);
      if (ro?.devCode) setOtpDevCode(ro.devCode);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('security.email.toast_send_failed'));
    } finally {
      setOtpSending(false);
    }
  };

  const verifyEmailCode = useCallback(async (code: string) => {
    if (code.length !== OTP_LENGTH || otpVerifying) return;
    setOtpVerifying(true);
    setOtpError('');
    try {
      const res = await api.auth.emailVerifyConfirm(code);
      if (res.success) {
        setEmailVerified(true);
        setOtpOpen(false);
        toast.success(t('security.email.toast_verified'));
      } else {
        setOtpError(res.message || t('security.email.error_invalid'));
      }
    } catch (err) {
      const e = err as { message?: string };
      setOtpError(e?.message || t('security.email.error_invalid'));
    } finally {
      setOtpVerifying(false);
    }
  }, [otpVerifying, t]);

  // Ref-free stable handler for OtpInput auto-submit.
  const verifyRef = useRef(verifyEmailCode);
  verifyRef.current = verifyEmailCode;

  return (
    <div className="space-y-6">
      {/* ── Passkeys ── */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Fingerprint className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle>{t('security.passkey.title')}</CardTitle>
              <CardDescription>{t('security.passkey.subtitle')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!passkeySupported && (
            <Alert>
              <AlertDescription>{t('security.passkey.unsupported')}</AlertDescription>
            </Alert>
          )}

          {loadingPasskeys ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : passkeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('security.passkey.empty')}</p>
          ) : (
            <ul className="space-y-2">
              {passkeys.map((pk) => (
                <li
                  key={pk.id}
                  className="flex items-center gap-3 rounded-xl border p-3"
                >
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Fingerprint className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{pk.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {pk.lastUsedAt
                        ? t('security.passkey.last_used', {
                            date: new Date(pk.lastUsedAt).toLocaleDateString(i18n.language),
                          })
                        : t('security.passkey.added', {
                            date: pk.createdAt
                              ? new Date(pk.createdAt).toLocaleDateString(i18n.language)
                              : '',
                          })}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePasskey(pk)}
                    aria-label={t('security.passkey.remove_confirm')}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {passkeySupported && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pt-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="passkey-name">{t('security.passkey.name_label')}</Label>
                <Input
                  id="passkey-name"
                  placeholder={t('security.passkey.name_placeholder')}
                  value={passkeyName}
                  onChange={(e) => setPasskeyName(e.target.value)}
                  maxLength={60}
                  disabled={enrolling}
                />
              </div>
              <Button onClick={enrollPasskey} disabled={enrolling} className="h-10">
                {enrolling ? (
                  <><Loader2 className="me-2 h-4 w-4 animate-spin" /> {t('security.passkey.adding')}</>
                ) : (
                  <><Plus className="me-2 h-4 w-4" /> {t('security.passkey.add_cta')}</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Email verification ── */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-2">
                {t('security.email.title')}
                {emailVerified === true && (
                  <Badge variant="secondary" className="gap-1 text-green-700 bg-green-100">
                    <CheckCircle2 className="h-3 w-3" /> {t('security.email.verified_badge')}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {t('security.email.subtitle')}{' '}
                <span className="font-medium text-foreground" dir="ltr">{email}</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailVerified === null ? (
            <Skeleton className="h-10 w-48" />
          ) : emailVerified ? (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <ShieldCheck className="h-4 w-4" />
              {t('security.email.verified_note')}
            </div>
          ) : otpOpen ? (
            <div className="space-y-4 max-w-sm">
              <p className="text-sm text-muted-foreground">
                {t('security.email.enter_code')}{' '}
                <span className="font-medium text-foreground" dir="ltr">{email}</span>
              </p>
              <OtpInput
                id="email-otp"
                length={OTP_LENGTH}
                value={otpCode}
                onChange={(v) => { setOtpError(''); setOtpCode(v); }}
                onComplete={(v) => verifyRef.current(v)}
                autoFocus
                disabled={otpVerifying}
                hasError={!!otpError}
                ariaLabel={t('security.email.title')}
              />
              {otpError && <p className="text-xs text-destructive">{otpError}</p>}
              {otpDevCode && (
                <Alert>
                  <AlertDescription className="text-xs">
                    {t('security.email.dev_hint')}{' '}
                    <code className="font-mono font-semibold" dir="ltr">{otpDevCode}</code>
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex items-center gap-3 text-sm">
                {otpVerifying && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('security.email.verifying')}
                  </span>
                )}
                {otpCooldown > 0 ? (
                  <span className="text-muted-foreground">
                    {t('security.email.resend_in', { seconds: otpCooldown })}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={startEmailVerify}
                    disabled={otpSending}
                    className="inline-flex items-center gap-1 font-medium text-foreground hover:underline disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> {t('security.email.resend')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <Button onClick={startEmailVerify} disabled={otpSending}>
              {otpSending ? (
                <><Loader2 className="me-2 h-4 w-4 animate-spin" /> {t('security.email.sending')}</>
              ) : (
                <><Mail className="me-2 h-4 w-4" /> {t('security.email.verify_cta')}</>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/** Standalone `/dashboard/security` page (heading + panel). */
export const Security: React.FC = () => {
  const { t } = useTranslation(['security']);
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('security.title')}</h1>
        <p className="text-muted-foreground">{t('security.subtitle')}</p>
      </div>
      <SecurityPanel />
    </div>
  );
};

export default Security;
