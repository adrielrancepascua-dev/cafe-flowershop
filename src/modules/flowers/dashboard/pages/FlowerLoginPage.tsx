import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Flower2 } from 'lucide-react';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';
import { FLOWER_DEMO_USERS } from '../../shared/data/flowers.mock';

export default function FlowerLoginPage() {
  const { user, signIn } = useFlowerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? '/dashboard/flowers/orders';

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await signIn(email, password);
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-cream via-brand-light to-brand-beige/40 px-4">
      <div className="flower-card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-brown text-white">
            <Flower2 className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-accent">
              Papers &amp; Petals
            </p>
            <h1 className="font-serif text-xl font-semibold text-brand-dark">Staff Login</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-brand-brown">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="flower-input mt-1.5"
              required
              autoComplete="username"
            />
          </label>

          <label className="block text-sm font-medium text-brand-brown">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="flower-input mt-1.5"
              required
              autoComplete="current-password"
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={isSubmitting} className="flower-btn-primary w-full">
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-dashed border-brand-muted/60 bg-brand-beige/20 p-3 text-xs text-brand-brown/80">
          <p className="font-semibold text-brand-dark">Demo accounts</p>
          <ul className="mt-2 space-y-1">
            {FLOWER_DEMO_USERS.map((demoUser) => (
              <li key={demoUser.id}>
                {demoUser.role === 'admin' ? 'Admin' : 'Staff'}: {demoUser.email} / {demoUser.password}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
