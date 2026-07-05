import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Store,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api-client';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

// Mirrors the backend regex in validators/auth.validator.js: 64 hex chars.
// Validated client-side so we can show a helpful error before hitting the
// network for a token that was obviously mangled in transit.
const HEX_TOKEN_RE = /^[a-f0-9]{64}$/;

export const ResetPassword: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const { t } = useTranslation(['auth', 'common']);

  const tokenIsWellFormed = useMemo(() => HEX_TOKEN_RE.test(token), [token]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!tokenIsWellFormed) {
      setError(t('auth.toast.reset_invalid_link'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('auth.field.password.error.min_chars'));
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError(t('auth.field.password.error.complexity'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.field.password.error.no_match'));
      return;
    }

    setIsLoading(true);
    try {
      const res = (await api.auth.confirmPasswordReset(token, newPassword)) as {
        success?: boolean;
        message?: string;
      };
      // Service returns { success, message, statusCode } — the axios
      // client unwraps to `data`, so `res` is that body.
      if (res?.success === false) {
        setError(res?.message || t('auth.toast.reset_failed'));
        return;
      }
      setSuccess(true);
      // Give the success screen a beat so the user sees what happened
      // before bouncing them to the login page.
      setTimeout(() => navigate('/dashboard/login', { replace: true }), 2500);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(
        e?.response?.data?.message ||
          e?.message ||
          t('auth.toast.reset_failed'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // No token in the URL at all — route was hit directly. Don't show a form
  // the user can't submit; point them back at the forgot-password flow.
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 relative">
        <div className="absolute top-3 end-3">
          <LanguageSwitcher />
        </div>
        <div className="w-full max-w-md space-y-6 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold tracking-tight">{t('auth.reset.missing_token_title')}</h1>
          <p className="text-muted-foreground">
            {t('auth.reset.missing_token_body')}
          </p>
          <Link
            to="/dashboard/forgot-password"
            className="inline-block text-sm font-medium text-foreground hover:underline"
          >
            {t('auth.reset.request_link')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 relative">
      <div className="absolute top-3 end-3">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Store className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold tracking-tight">Matjar</span>
        </div>

        {success ? (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{t('auth.reset.success_title')}</h1>
            <p className="text-muted-foreground">
              {t('auth.reset.success_body')}
            </p>
            <Link
              to="/dashboard/login"
              className="text-sm font-medium text-foreground hover:underline"
            >
              {t('auth.reset.go_to_sign_in')}
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">{t('auth.reset.title')}</h1>
              <p className="text-muted-foreground">
                {t('auth.reset.subtitle')}
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="newPassword">{t('auth.field.new_password.label')}</Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? (
                      <span className="inline-flex items-center gap-1"><EyeOff className="h-3 w-3" /> {t('auth.field.password.hide')}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {t('auth.field.password.show')}</span>
                    )}
                  </button>
                </div>
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('auth.field.confirm_password.label')}</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full h-11 text-base" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="me-2 h-4 w-4 animate-spin" /> {t('auth.reset.submitting')}</>
                ) : (
                  <>{t('auth.reset.submit')}</>
                )}
              </Button>
            </form>

            <div className="text-sm text-muted-foreground">
              <Link to="/dashboard/login" className="inline-flex items-center hover:text-foreground">
                <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t('auth.reset.back_to_sign_in')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
