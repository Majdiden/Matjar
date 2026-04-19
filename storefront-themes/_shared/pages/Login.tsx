import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/client';
import { useStore } from '../contexts/StoreContext';
import { useTranslation } from 'react-i18next';

interface LoginProps {
  className?: string;
  accentColor?: string;
  heading?: string;
  subheading?: string;
}

const Login: React.FC<LoginProps> = ({
  className = '',
  accentColor,
  heading,
  subheading,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { store } = useStore();
  const { t } = useTranslation(['account']);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const accent = accentColor || 'var(--color-primary, #2563eb)';
  const redirectTo = (location.state as { from?: string } | null)?.from || '/account';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await authApi.login(email, password);
      const token = res.data?.accessToken || res.responseObject?.accessToken || res.token;
      if (token) localStorage.setItem('customer_token', token);
      navigate(redirectTo);
    } catch (err: any) {
      setError(err?.message || t('login.error_default'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`max-w-md mx-auto px-4 sm:px-6 py-12 ${className}`}>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">{heading || t('login.title')}</h1>
        <p className="text-gray-500 text-sm">{subheading || t('login.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">{t('login.field.email.label')}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            placeholder={t('login.field.email.placeholder')}
            autoComplete="email"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium">{t('login.field.password.label')}</label>
            <Link to="/forgot-password" className="text-xs hover:underline" style={{ color: accent }}>
              {t('login.forgot_link')}
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            placeholder={t('login.field.password.placeholder')}
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-lg text-white font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          {submitting ? t('login.submitting') : t('login.submit')}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        {t('login.no_account_text')}{' '}
        <Link to="/register" className="font-medium hover:underline" style={{ color: accent }}>
          {t('login.no_account_link')}
        </Link>
      </p>

      {store?.name && (
        <p className="text-center text-xs text-gray-400 mt-8">
          {t('login.signing_in_to', { store: store.name })}
        </p>
      )}
    </div>
  );
};

export default Login;
