import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/client';
import { useTranslation } from 'react-i18next';

interface ForgotPasswordProps {
  className?: string;
  accentColor?: string;
}

/**
 * Customer "forgot password" — requests a reset link. The backend always
 * returns success (no account enumeration), so we always show the
 * check-your-inbox state on submit.
 */
const ForgotPassword: React.FC<ForgotPasswordProps> = ({ className = '', accentColor }) => {
  const { t } = useTranslation(['account']);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const accent = accentColor || 'var(--color-primary, #2563eb)';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
    } catch {
      /* deliberately ignored — never reveal whether the email exists */
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className={`max-w-md mx-auto px-4 sm:px-6 py-12 text-center ${className}`}>
        <h1 className="text-2xl font-bold mb-2">{t('forgot.check_inbox_title')}</h1>
        <p className="text-gray-500 text-sm mb-8">{t('forgot.check_inbox_body', { email })}</p>
        <Link to="/login" className="text-sm font-medium hover:underline" style={{ color: accent }}>
          {t('forgot.back_to_sign_in')}
        </Link>
      </div>
    );
  }

  return (
    <div className={`max-w-md mx-auto px-4 sm:px-6 py-12 ${className}`}>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('forgot.title')}</h1>
        <p className="text-gray-500 text-sm">{t('forgot.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-lg text-white font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          {submitting ? t('forgot.submitting') : t('forgot.submit')}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        <Link to="/login" className="font-medium hover:underline" style={{ color: accent }}>
          {t('forgot.back_to_sign_in')}
        </Link>
      </p>
    </div>
  );
};

export default ForgotPassword;
