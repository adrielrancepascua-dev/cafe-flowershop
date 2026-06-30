import { useEffect, useState } from 'react';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';
import { listFlowerBranches } from '../../../../services/flowers/inventory';
import { completeStaffOnboarding } from '../../../../services/flowers/team';
import type { FlowerBranchOption } from '../../shared/types/flower-inventory';

export default function StaffOnboardingModal() {
  const { user, refreshUser, signOut } = useFlowerAuth();
  const [branches, setBranches] = useState<FlowerBranchOption[]>([]);
  const [branchId, setBranchId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void listFlowerBranches().then((items) => {
      setBranches(items.filter((branch) => branch.is_active));
    });
  }, []);

  if (!user) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) {
      return;
    }
    setErrorMessage('');

    if (!branchId) {
      setErrorMessage('Choose your branch.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await completeStaffOnboarding(user.id, branchId, password);
      await refreshUser();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not finish setup.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark/45 px-4 py-8">
      <div className="flower-card w-full max-w-md p-6 sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
          First-time setup
        </p>
        <h2 className="mt-1 font-serif text-2xl font-semibold text-brand-dark">Welcome, {user.display_name}</h2>
        <p className="mt-2 text-sm text-brand-brown/80">
          Before you start, choose your branch and set a personal password. Your temporary password{' '}
          <span className="font-semibold">1234</span> will stop working after this.
        </p>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-brand-brown">
            Your branch
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="flower-input mt-1.5"
              required
            >
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-brand-brown">
            New password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="flower-input mt-1.5"
              minLength={6}
              autoComplete="new-password"
              required
            />
          </label>

          <label className="block text-sm font-medium text-brand-brown">
            Confirm password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="flower-input mt-1.5"
              minLength={6}
              autoComplete="new-password"
              required
            />
          </label>

          {errorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <button type="submit" disabled={isSubmitting} className="flower-btn-primary w-full">
            {isSubmitting ? 'Saving...' : 'Finish setup'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 w-full text-center text-xs font-medium text-brand-brown/60 underline-offset-2 hover:text-brand-brown hover:underline"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
