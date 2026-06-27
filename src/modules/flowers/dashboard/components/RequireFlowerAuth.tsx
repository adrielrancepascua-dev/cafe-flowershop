import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';

export default function RequireFlowerAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useFlowerAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-light">
        <p className="text-sm text-brand-brown/70">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function RequireFlowerAdmin({
  children,
  silent = false,
}: {
  children: ReactNode;
  silent?: boolean;
}) {
  const { isAdmin, isLoading } = useFlowerAuth();

  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    if (silent) {
      return null;
    }

    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Admin access required for this section.
      </div>
    );
  }

  return children;
}
