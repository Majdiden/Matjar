import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/client';
import { useTranslation } from 'react-i18next';

interface ResetPasswordProps {
  className?: string;
  accentColor?: string;
}

/**
 * Customer password reset — the token comes from the emailed link
 * (?token=). On success the customer is sent back to sign in.
 */
const ResetPassword: React.FC<ResetPasswordProps> = ({ className = '', accentColor }) => {
  const { t } = useTranslation(['account']);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const accent = accentColor || 'var(--color-primary, #2563eb)';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError(t('reset.error_min')); return; }
    if (password !== confirm) { setError(t('reset.error_match')); return; }
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err: any) {
      setError(err?.message || t('reset.error_default'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className={`max-w-md mx-auto px-4 sm:px-6 py-12 text-center ${className}`}>
        <h1 className="text-2xl font-bold mb-2">{t('reset.invalid_title')}</h1>
        <p className="text-gray-500 text-sm mb-8">{t('reset.invalid_body')}</p>
        <Link to="/forgot-password" className="text-sm font-medium hover:underline" style={{ color: accent }}>
          {t('reset.request_new')}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className={`max-w-md mx-auto px-4 sm:px-6 py-12 text-center ${className}`}>
        <h1 className="text-2xl font-bold mb-2">{t('reset.success_title')}</h1>
        <p className="text-gray-500 text-sm">{t('reset.success_body')}</p>
      </div>
    );
  }

  return (
    <div className={`max-w-md mx-auto px-4 sm:px-6 py-12 ${className}`}>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('reset.title')}</h1>
        <p className="text-gray-500 text-sm">{t('reset.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">{t('reset.field.new_password')}</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('reset.field.confirm_password')}</label>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-lg text-white font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          {submitting ? t('reset.submitting') : t('reset.submit')}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
