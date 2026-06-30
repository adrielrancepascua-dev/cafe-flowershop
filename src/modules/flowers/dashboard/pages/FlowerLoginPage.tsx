import { useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, UserRound } from 'lucide-react';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';
import { isFlowerDemoMode } from '../../../../app/app-mode';
import { FLOWER_DEMO_USERS } from '../../shared/data/flowers.mock';
import FlowerBrandLogo from '../../shared/components/FlowerBrandLogo';

export default function FlowerLoginPage() {
  const { user, signIn } = useFlowerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);

  const demoAdmin = useMemo(
    () => FLOWER_DEMO_USERS.find((demoUser) => demoUser.role === 'admin'),
    [],
  );
  const demoStaff = useMemo(
    () => FLOWER_DEMO_USERS.find((demoUser) => demoUser.role === 'staff'),
    [],
  );

  const isDemoMode = isFlowerDemoMode();

  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? '/dashboard/flowers/orders';

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  async function completeSignIn(nextEmail: string, nextPassword: string) {
    setIsSubmitting(true);
    setError('');

    try {
      await signIn(nextEmail, nextPassword);
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await completeSignIn(email, password);
  }

  async function handleQuickLogin(role: 'admin' | 'staff') {
    const demoUser = role === 'admin' ? demoAdmin : demoStaff;
    if (!demoUser) {
      setError('Demo account not found.');
      return;
    }

    await completeSignIn(demoUser.email, demoUser.password);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-cream via-brand-light to-brand-beige/40 px-4">
      <div className="flower-card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6">
          <FlowerBrandLogo size="lg" subtitle="Staff login" />
        </div>

        {isDemoMode ? (
          <div className="space-y-3">
            <p className="text-sm text-brand-brown/75">
              Demo mode — pick a role to sign in instantly.
            </p>

            <button
              type="button"
              disabled={isSubmitting || !demoAdmin}
              onClick={() => void handleQuickLogin('admin')}
              className="flower-btn-primary flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold">Admin</span>
                <span className="block text-xs font-normal text-white/80">
                  {demoAdmin?.display_name ?? 'Owner Admin'} · full access
                </span>
              </span>
            </button>

            <button
              type="button"
              disabled={isSubmitting || !demoStaff}
              onClick={() => void handleQuickLogin('staff')}
              className="flower-btn-secondary flex w-full items-center gap-3 border-brand-muted/60 px-4 py-3 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-beige/80 text-brand-brown">
                <UserRound className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold text-brand-dark">Staff</span>
                <span className="block text-xs font-normal text-brand-brown/70">
                  {demoStaff?.display_name ?? 'Staff One'} · orders, stock &amp; expenses
                </span>
              </span>
            </button>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => setShowEmailLogin((current) => !current)}
              className="w-full pt-1 text-center text-xs font-medium text-brand-brown/60 underline-offset-2 hover:text-brand-brown hover:underline"
            >
              {showEmailLogin ? 'Hide email login' : 'Sign in with email instead'}
            </button>

            {showEmailLogin ? (
              <form onSubmit={handleSubmit} className="space-y-4 border-t border-brand-muted/40 pt-4">
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

                <button type="submit" disabled={isSubmitting} className="flower-btn-primary w-full">
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            ) : null}
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
