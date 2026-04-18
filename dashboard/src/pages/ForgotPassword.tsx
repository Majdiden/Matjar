import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Store, ArrowLeft, Loader2, AlertCircle, MailCheck } from 'lucide-react';
import { api } from '../lib/api-client';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Enter the email you use to sign in.');
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
      setError(e?.response?.data?.message || e?.message || 'Could not submit request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
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
              <h1 className="text-2xl font-bold tracking-tight">Check your inbox</h1>
              <p className="text-muted-foreground">
                If an account exists for <span className="font-medium text-foreground">{email}</span>,
                a password reset link is on its way. The link expires in 60 minutes.
              </p>
            </div>
            <div className="text-sm text-muted-foreground text-center">
              Didn't get it? Check your spam folder, then{' '}
              <button
                type="button"
                className="text-foreground font-medium hover:underline"
                onClick={() => { setSubmitted(false); }}
              >
                try again
              </button>
              .
            </div>
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Forgot password?</h1>
              <p className="text-muted-foreground">
                Enter your email and we'll send you a link to choose a new one.
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
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
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
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                ) : (
                  <>Send reset link</>
                )}
              </Button>
            </form>

            <div className="text-sm text-muted-foreground">
              <Link to="/login" className="inline-flex items-center hover:text-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
