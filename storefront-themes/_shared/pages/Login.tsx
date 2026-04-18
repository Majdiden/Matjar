import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/client';
import { useStore } from '../contexts/StoreContext';

interface LoginProps {
  className?: string;
  accentColor?: string;
  heading?: string;
  subheading?: string;
}

const Login: React.FC<LoginProps> = ({
  className = '',
  accentColor,
  heading = 'Welcome back',
  subheading = 'Sign in to your account to continue.',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { store } = useStore();
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
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`max-w-md mx-auto px-4 sm:px-6 py-12 ${className}`}>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">{heading}</h1>
        <p className="text-gray-500 text-sm">{subheading}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            placeholder="your@email.com"
            autoComplete="email"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium">Password</label>
            <Link to="/forgot-password" className="text-xs hover:underline" style={{ color: accent }}>
              Forgot?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-lg text-white font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="font-medium hover:underline" style={{ color: accent }}>
          Create one
        </Link>
      </p>

      {store?.name && (
        <p className="text-center text-xs text-gray-400 mt-8">
          Signing in to {store.name}
        </p>
      )}
    </div>
  );
};

export default Login;
