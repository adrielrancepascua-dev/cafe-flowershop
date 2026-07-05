import { requireSupabaseAuthSession } from '../../../lib/auth/flower-auth.service';
import { getSupabaseClient } from '../../../lib/supabase/client';
import type { CreateFlowerStaffResult, FlowerTeamMember } from '../../../modules/flowers/shared/types/auth';
import { mapFlowerProfileRow } from './flowers-team.shared';

async function requireSessionToken(): Promise<string> {
  await requireSupabaseAuthSession();
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('You must be signed in as admin.');
  }

  return data.session.access_token;
}

export async function listFlowerTeamSupabase(): Promise<FlowerTeamMember[]> {
  await requireSupabaseAuthSession();
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('flower_profiles')
    .select(
      'id, email, display_name, role, branch_id, onboarding_completed, is_active, created_at, flower_branches ( name )',
    )
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapFlowerProfileRow(row));
}

export async function createFlowerStaffSupabase(displayName: string): Promise<CreateFlowerStaffResult> {
  const token = await requireSessionToken();
  const response = await fetch('/api/create-flower-staff', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ display_name: displayName }),
  });

  const payload = (await response.json()) as CreateFlowerStaffResult & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? 'Could not create staff account.');
  }

  return payload;
}

export async function setFlowerTeamMemberActiveSupabase(
  memberId: string,
  isActive: boolean,
): Promise<void> {
  await requireSupabaseAuthSession();
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase
    .from('flower_profiles')
    .update({ is_active: isActive })
    .eq('id', memberId)
    .eq('role', 'staff');

  if (error) {
    throw error;
  }
}

export async function deleteFlowerTeamMemberSupabase(memberId: string): Promise<void> {
  const token = await requireSessionToken();
  const response = await fetch('/api/delete-flower-staff', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: memberId }),
  });

  const payload = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? 'Could not delete staff account.');
  }
}

export async function completeStaffOnboardingSupabase(
  branchId: string,
  newPassword: string,
): Promise<void> {
  await requireSupabaseAuthSession();
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (passwordError) {
    throw passwordError;
  }

  const { error: rpcError } = await supabase.rpc('complete_staff_onboarding', {
    p_branch_id: branchId,
  });

  if (rpcError) {
    throw rpcError;
  }
}

export async function completeAdminOnboardingSupabase(newPassword: string): Promise<void> {
  await requireSupabaseAuthSession();
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (passwordError) {
    throw passwordError;
  }

  const { error: rpcError } = await supabase.rpc('complete_admin_onboarding');

  if (rpcError) {
    throw rpcError;
  }
}
