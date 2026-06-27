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
  signInFlowerUser,
  signOutFlowerUser,
} from './flower-auth.service';

interface FlowerAuthContextValue {
  user: FlowerUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const FlowerAuthContext = createContext<FlowerAuthContextValue | null>(null);

export function FlowerAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<FlowerAuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSession(getStoredFlowerSession());
    setIsLoading(false);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const nextSession = await signInFlowerUser(email, password);
    setSession(nextSession);
  }, []);

  const signOut = useCallback(async () => {
    await signOutFlowerUser();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      isLoading,
      isAdmin: isAdminUser(session?.user),
      signIn,
      signOut,
    }),
    [session, isLoading, signIn, signOut],
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
