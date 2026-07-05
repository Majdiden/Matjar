import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Store, ArrowLeft, Loader2, AlertCircle, MailCheck } from 'lucide-react';
import { api } from '../lib/api-client';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation(['auth', 'common']);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError(t('auth.validation.email_required_forgot'));
      return;
    }
    setIsLoading(true);
    try {
      await api.auth.requestPasswordReset(email.trim().toLowerCase());
      // Backend always returns success — we intentionally don't branch on
      // anything from the response. Show the neutral confirmation screen
      // whether or not an account actually matched.
      setSubmitted(true);
    } catch (err) {
      // The only path into this branch is a validation 400 or an outright
      // transport error — both are safe to surface.
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || t('auth.toast.forgot_submit_failed'));
    } finally {
      setIsLoading(false);
    }
  };

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

        {submitted ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <MailCheck className="h-6 w-6 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{t('auth.forgot.check_inbox_title')}</h1>
              <p className="text-muted-foreground">
                <Trans
                  i18nKey="auth.forgot.check_inbox_body"
                  values={{ email }}
                  components={[<span />, <span className="font-medium text-foreground" />]}
                />
              </p>
            </div>
            <div className="text-sm text-muted-foreground text-center">
              {t('auth.forgot.no_email')}{' '}
              <button
                type="button"
                className="text-foreground font-medium hover:underline"
                onClick={() => { setSubmitted(false); }}
              >
                {t('auth.forgot.try_again_link')}
              </button>
              .
            </div>
            <Link
              to="/dashboard/login"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t('auth.forgot.back_to_sign_in')}
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">{t('auth.forgot.title')}</h1>
              <p className="text-muted-foreground">
                {t('auth.forgot.subtitle')}
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

              <Button type="submit" className="w-full h-11 text-base" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="me-2 h-4 w-4 animate-spin" /> {t('auth.forgot.submitting')}</>
                ) : (
                  <>{t('auth.forgot.submit')}</>
                )}
              </Button>
            </form>

            <div className="text-sm text-muted-foreground">
              <Link to="/dashboard/login" className="inline-flex items-center hover:text-foreground">
                <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t('auth.forgot.back_to_sign_in')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
