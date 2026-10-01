import { requireSupabaseAuthSession } from '../../../lib/auth/flower-auth.service';
import { getSupabaseClient } from '../../../lib/supabase/client';
import type { CreateFlowerStaffResult, FlowerTeamMember } from '../../../modules/flowers/shared/types/auth';
import { mapFlowerProfileRow } from './flowers-team.shared';

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
  await requireSupabaseAuthSession();
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.rpc('create_flower_staff', {
    p_display_name: displayName,
  });

  if (error) {
    throw new Error(error.message || 'Could not create staff account.');
  }

  return data as CreateFlowerStaffResult;
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
  await requireSupabaseAuthSession();
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase.rpc('delete_flower_staff', {
    p_user_id: memberId,
  });

  if (error) {
    throw new Error(error.message || 'Could not delete staff account.');
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
