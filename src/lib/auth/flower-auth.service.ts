import { isFlowerDemoMode } from '../../app/app-mode';
import type { FlowerAuthSession, FlowerUser } from '../../modules/flowers/shared/types/auth';
import { FLOWER_DEMO_USERS } from '../../modules/flowers/shared/data/flowers.mock';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase/client';

const AUTH_STORAGE_KEY = 'papers_petals_auth_v1';

function readLocalSession(): FlowerAuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as FlowerAuthSession;
  } catch {
    return null;
  }
}

function writeLocalSession(session: FlowerAuthSession | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

async function signInLocal(email: string, password: string): Promise<FlowerAuthSession> {
  const normalizedEmail = email.trim().toLowerCase();
  const match = FLOWER_DEMO_USERS.find(
    (user) => user.email.toLowerCase() === normalizedEmail && user.password === password,
  );

  if (!match) {
    throw new Error('Invalid email or password.');
  }

  const session: FlowerAuthSession = {
    user: {
      id: match.id,
      email: match.email,
      display_name: match.display_name,
      role: match.role,
    },
    token: `local-${match.id}-${Date.now()}`,
  };

  writeLocalSession(session);
  return session;
}

async function signInSupabase(email: string, password: string): Promise<FlowerAuthSession> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? 'Invalid email or password.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('flower_profiles')
    .select('id, email, display_name, role')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('User profile not found.');
  }

  const session: FlowerAuthSession = {
    user: {
      id: profile.id,
      email: profile.email,
      display_name: profile.display_name,
      role: profile.role === 'admin' ? 'admin' : 'staff',
    },
    token: data.session?.access_token ?? '',
  };

  writeLocalSession(session);
  return session;
}

export async function signInFlowerUser(email: string, password: string): Promise<FlowerAuthSession> {
  if (isSupabaseConfigured()) {
    return signInSupabase(email, password);
  }

  if (!isFlowerDemoMode()) {
    throw new Error('Live login is not configured. Contact your administrator.');
  }

  return signInLocal(email, password);
}

export async function signOutFlowerUser(): Promise<void> {
  writeLocalSession(null);

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
  }
}

export function getStoredFlowerSession(): FlowerAuthSession | null {
  return readLocalSession();
}

export function isAdminUser(user: FlowerUser | null | undefined): boolean {
  return user?.role === 'admin';
}
