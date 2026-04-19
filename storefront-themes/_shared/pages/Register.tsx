import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import { useStore } from '../contexts/StoreContext';
import { useTranslation } from 'react-i18next';

interface RegisterProps {
  className?: string;
  accentColor?: string;
  heading?: string;
  subheading?: string;
}

const Register: React.FC<RegisterProps> = ({
  className = '',
  accentColor,
  heading,
  subheading,
}) => {
  const navigate = useNavigate();
  const { store } = useStore();
  const { t } = useTranslation(['account']);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const accent = accentColor || 'var(--color-primary, #2563eb)';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(t('register.error.password_min'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('register.error.password_match'));
      return;
    }

    setSubmitting(true);
    try {
      // Storefront register returns an access token directly
      const res = await authApi.register({ name, email, password });
      const token = res.data?.accessToken || res.responseObject?.accessToken || res.token;
      if (token) {
        localStorage.setItem('customer_token', token);
      } else {
        // Fallback: explicit login if the endpoint didn't return a token
        const loginRes = await authApi.login(email, password);
        const t2 = loginRes.data?.accessToken || loginRes.responseObject?.accessToken;
        if (t2) localStorage.setItem('customer_token', t2);
      }
      navigate('/account');
    } catch (err: any) {
      setError(err?.message || t('register.error.default'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`max-w-md mx-auto px-4 sm:px-6 py-12 ${className}`}>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">{heading || t('register.title')}</h1>
        <p className="text-gray-500 text-sm">{subheading || t('register.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">{t('register.field.full_name.label')}</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            placeholder={t('register.field.full_name.placeholder')}
            autoComplete="name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('register.field.email.label')}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            placeholder={t('register.field.email.placeholder')}
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('register.field.password.label')}</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            placeholder={t('register.field.password.placeholder')}
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('register.field.confirm_password.label')}</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            placeholder={t('register.field.confirm_password.placeholder')}
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-lg text-white font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          {submitting ? t('register.submitting') : t('register.submit')}
        </button>

        <p className="text-xs text-gray-400 text-center">
          {t('register.terms_html')}
        </p>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        {t('register.have_account_text')}{' '}
        <Link to="/login" className="font-medium hover:underline" style={{ color: accent }}>
          {t('register.have_account_link')}
        </Link>
      </p>

      {store?.name && (
        <p className="text-center text-xs text-gray-400 mt-8">
          {t('register.joining', { store: store.name })}
        </p>
      )}
    </div>
  );
};

export default Register;
