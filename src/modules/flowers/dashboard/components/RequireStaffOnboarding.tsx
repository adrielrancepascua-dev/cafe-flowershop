import type { ReactNode } from 'react';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';
import StaffOnboardingModal from './StaffOnboardingModal';

export default function RequireStaffOnboarding({ children }: { children: ReactNode }) {
  const { needsOnboarding, isLoading } = useFlowerAuth();

  if (isLoading) {
    return null;
  }

  if (needsOnboarding) {
    return <StaffOnboardingModal />;
  }

  return children;
}
