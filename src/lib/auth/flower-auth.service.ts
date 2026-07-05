import { isFlowerDemoMode } from '../../app/app-mode';
import type { FlowerAuthSession, FlowerUser } from '../../modules/flowers/shared/types/auth';
import { FLOWER_DEMO_USERS } from '../../modules/flowers/shared/data/flowers.mock';
import { mapFlowerProfileRow } from '../../services/flowers/team/flowers-team.shared';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../../services/flowers/storage-mode';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase/client';

const AUTH_STORAGE_KEY = 'papers_petals_auth_v1';
const TEAM_STORAGE_KEY = 'papers_petals_team_v1';

const PROFILE_SELECT =
  'id, email, display_name, role, branch_id, onboarding_completed, is_active, flower_branches ( name )';

function shouldUseSupabaseAuth(): boolean {
  if (!isSupabaseConfigured()) {
    return false;
  }

  if (isFlowerDemoMode()) {
    return false;
  }

  return shouldUseFlowerSupabase(getFlowerStorageMode());
}

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

  let user: FlowerUser | null = match
    ? {
        id: match.id,
        email: match.email,
        display_name: match.display_name,
        role: match.role,
        branch_id: match.branch_id ?? null,
        branch_name: match.branch_name ?? null,
        onboarding_completed: match.onboarding_completed ?? true,
        is_active: match.is_active ?? true,
      }
    : null;

  if (!user) {
    try {
      const raw = window.localStorage.getItem(TEAM_STORAGE_KEY);
      const team = raw ? (JSON.parse(raw) as Array<FlowerUser & { password?: string }>) : [];
      const teamMatch = team.find(
        (entry) => entry.email.toLowerCase() === normalizedEmail && entry.password === password,
      );
      if (teamMatch) {
        user = {
          id: teamMatch.id,
          email: teamMatch.email,
          display_name: teamMatch.display_name,
          role: 'staff',
          branch_id: teamMatch.branch_id ?? null,
          branch_name: teamMatch.branch_name ?? null,
          onboarding_completed: teamMatch.onboarding_completed ?? false,
          is_active: teamMatch.is_active ?? true,
        };
      }
    } catch {
      // ignore malformed local team storage
    }
  }

  if (!user) {
    throw new Error('Invalid email or password.');
  }

  if (!user.is_active) {
    throw new Error('This account has been deactivated. Contact your shop admin.');
  }

  const session: FlowerAuthSession = {
    user,
    token: `local-${user.id}-${Date.now()}`,
  };

  writeLocalSession(session);
  return session;
}

async function loadSupabaseProfile(userId: string): Promise<FlowerUser> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('flower_profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    throw new Error('User profile not found.');
  }

  return mapFlowerProfileRow(profile);
}

async function signInSupabase(email: string, password: string): Promise<FlowerAuthSession> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  let data;
  let error;

  try {
    const result = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    data = result.data;
    error = result.error;
  } catch (networkError) {
    const message =
      networkError instanceof Error ? networkError.message.toLowerCase() : '';
    if (message.includes('fetch')) {
      throw new Error(
        'Cannot reach Supabase. Check VITE_SUPABASE_URL on Vercel (should look like https://xxxxx.supabase.co) and confirm your project is not paused.',
      );
    }
    throw networkError;
  }

  if (error || !data.user) {
    throw new Error(error?.message ?? 'Invalid email or password.');
  }

  const user = await loadSupabaseProfile(data.user.id);
  if (!user.is_active) {
    await supabase.auth.signOut();
    throw new Error('This account has been deactivated. Contact your shop admin.');
  }

  const session: FlowerAuthSession = {
    user,
    token: data.session?.access_token ?? '',
    refresh_token: data.session?.refresh_token ?? '',
  };

  writeLocalSession(session);
  return session;
}

export async function signInFlowerUser(email: string, password: string): Promise<FlowerAuthSession> {
  if (shouldUseSupabaseAuth()) {
    return signInSupabase(email, password);
  }

  if (isFlowerDemoMode()) {
    return signInLocal(email, password);
  }

  throw new Error('Live login is not configured. Set Supabase env vars and VITE_FLOWER_STORAGE_MODE=supabase on Vercel.');
}

export async function ensureSupabaseSession(): Promise<void> {
  if (!shouldUseSupabaseAuth()) {
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    return;
  }

  const stored = readLocalSession();
  if (!stored?.token || !stored.refresh_token) {
    writeLocalSession(null);
    return;
  }

  const { data: restored, error } = await supabase.auth.setSession({
    access_token: stored.token,
    refresh_token: stored.refresh_token,
  });

  if (error || !restored.session?.access_token) {
    writeLocalSession(null);
  }
}

export async function requireSupabaseAuthSession(): Promise<void> {
  if (!shouldUseSupabaseAuth()) {
    return;
  }

  await ensureSupabaseSession();

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Your session has expired. Please sign in again.');
  }
}

export async function restoreFlowerSession(): Promise<FlowerAuthSession | null> {
  if (!shouldUseSupabaseAuth()) {
    const stored = readLocalSession();
    if (!stored) {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(TEAM_STORAGE_KEY);
      const team = raw ? (JSON.parse(raw) as Array<FlowerUser & { password?: string }>) : [];
      const teamMatch = team.find((entry) => entry.id === stored.user.id);
      if (teamMatch) {
        const refreshed: FlowerAuthSession = {
          ...stored,
          user: {
            ...stored.user,
            branch_id: teamMatch.branch_id ?? null,
            branch_name: teamMatch.branch_name ?? null,
            onboarding_completed: teamMatch.onboarding_completed ?? false,
            is_active: teamMatch.is_active ?? true,
          },
        };
        writeLocalSession(refreshed);
        return refreshed;
      }
    } catch {
      return stored;
    }

    return stored;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return readLocalSession();
  }

  await ensureSupabaseSession();

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) {
    writeLocalSession(null);
    return null;
  }

  const user = await loadSupabaseProfile(data.session.user.id);
  if (!user.is_active) {
    writeLocalSession(null);
    return null;
  }

  const session: FlowerAuthSession = {
    user,
    token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };

  writeLocalSession(session);
  return session;
}

export async function signOutFlowerUser(): Promise<void> {
  writeLocalSession(null);

  if (shouldUseSupabaseAuth()) {
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

export function currentFlowerUserIsAdmin(): boolean {
  return isAdminUser(getStoredFlowerSession()?.user ?? null);
}

export function needsStaffOnboarding(user: FlowerUser | null | undefined): boolean {
  return Boolean(user && user.role === 'staff' && !user.onboarding_completed && user.is_active);
}

export function needsAdminOnboarding(user: FlowerUser | null | undefined): boolean {
  return Boolean(user && user.role === 'admin' && !user.onboarding_completed && user.is_active);
}

export function needsFlowerOnboarding(user: FlowerUser | null | undefined): boolean {
  return needsStaffOnboarding(user) || needsAdminOnboarding(user);
}

export async function refreshFlowerSession(): Promise<FlowerAuthSession | null> {
  const session = await restoreFlowerSession();
  if (session) {
    writeLocalSession(session);
  }
  return session;
}

/**
 * Subscribes to Supabase auth lifecycle events so the app stays in sync when
 * the SDK silently refreshes an access token or when a session expires / is
 * signed out from another tab. Returns an unsubscribe function; callers MUST
 * invoke it on unmount to avoid leaking the listener.
 */
export function subscribeToFlowerAuthChanges(handlers: {
  onSignedOut: () => void;
}): () => void {
  if (!shouldUseSupabaseAuth()) {
    return () => {};
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      writeLocalSession(null);
      handlers.onSignedOut();
      return;
    }

    // Persist rotated tokens so ensureSupabaseSession() can always re-hydrate
    // the SDK from our own storage without forcing a re-login.
    if (event === 'TOKEN_REFRESHED' && session?.access_token) {
      const stored = readLocalSession();
      if (stored) {
        writeLocalSession({
          ...stored,
          token: session.access_token,
          refresh_token: session.refresh_token ?? stored.refresh_token,
        });
      }
    }
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
