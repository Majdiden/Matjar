import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import { useStore } from '../contexts/StoreContext';

interface RegisterProps {
  className?: string;
  accentColor?: string;
  heading?: string;
  subheading?: string;
}

const Register: React.FC<RegisterProps> = ({
  className = '',
  accentColor,
  heading = 'Create an account',
  subheading = 'Join us to start shopping and tracking orders.',
}) => {
  const navigate = useNavigate();
  const { store } = useStore();
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
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
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
        const t = loginRes.data?.accessToken || loginRes.responseObject?.accessToken;
        if (t) localStorage.setItem('customer_token', t);
      }
      navigate('/account');
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
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
          <label className="block text-sm font-medium mb-1">Full name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            placeholder="Jane Doe"
            autoComplete="name"
          />
        </div>

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
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Confirm password</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
            placeholder="Re-enter password"
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-lg text-white font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          {submitting ? 'Creating account...' : 'Create Account'}
        </button>

        <p className="text-xs text-gray-400 text-center">
          By creating an account you agree to our Terms and Privacy Policy.
        </p>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="font-medium hover:underline" style={{ color: accent }}>
          Sign in
        </Link>
      </p>

      {store?.name && (
        <p className="text-center text-xs text-gray-400 mt-8">
          Joining {store.name}
        </p>
      )}
    </div>
  );
};

export default Register;
