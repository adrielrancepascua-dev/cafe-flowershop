import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { FlowerAuthSession, FlowerUser } from '../../modules/flowers/shared/types/auth';
import {
  getStoredFlowerSession,
  isAdminUser,
  needsFlowerOnboarding,
  refreshFlowerSession,
  restoreFlowerSession,
  signInFlowerUser,
  signOutFlowerUser,
} from './flower-auth.service';

interface FlowerAuthContextValue {
  user: FlowerUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  needsOnboarding: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const FlowerAuthContext = createContext<FlowerAuthContextValue | null>(null);

export function FlowerAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<FlowerAuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const restored = await restoreFlowerSession();
      if (!cancelled) {
        setSession(restored ?? getStoredFlowerSession());
        setIsLoading(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const nextSession = await signInFlowerUser(email, password);
    setSession(nextSession);
  }, []);

  const signOut = useCallback(async () => {
    await signOutFlowerUser();
    setSession(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const nextSession = await refreshFlowerSession();
    setSession(nextSession);
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      isLoading,
      isAdmin: isAdminUser(session?.user),
      needsOnboarding: needsFlowerOnboarding(session?.user),
      signIn,
      signOut,
      refreshUser,
    }),
    [session, isLoading, signIn, signOut, refreshUser],
  );

  return <FlowerAuthContext.Provider value={value}>{children}</FlowerAuthContext.Provider>;
}

export function useFlowerAuth() {
  const context = useContext(FlowerAuthContext);
  if (!context) {
    throw new Error('useFlowerAuth must be used within FlowerAuthProvider');
  }

  return context;
}
