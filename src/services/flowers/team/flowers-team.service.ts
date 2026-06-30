import { isFlowerDemoMode } from '../../../app/app-mode';
import type { CreateFlowerStaffResult, FlowerTeamMember } from '../../../modules/flowers/shared/types/auth';
import { STAFF_EMAIL_DOMAIN } from '../../../modules/flowers/shared/config/brand';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';
import {
  completeStaffOnboardingLocal,
  createFlowerStaffLocal,
  deleteFlowerTeamMemberLocal,
  listFlowerTeamLocal,
  setFlowerTeamMemberActiveLocal,
} from './flowers-team.local';
import {
  completeStaffOnboardingSupabase,
  createFlowerStaffSupabase,
  deleteFlowerTeamMemberSupabase,
  listFlowerTeamSupabase,
  setFlowerTeamMemberActiveSupabase,
} from './flowers-team.supabase';

export function generateStaffEmailPreview(displayName: string): string {
  const slug = displayName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 28) || 'staff';

  return `${slug}.xxxx@${STAFF_EMAIL_DOMAIN}`;
}

export async function listFlowerTeam(): Promise<FlowerTeamMember[]> {
  if (shouldUseFlowerSupabase(getFlowerStorageMode())) {
    return listFlowerTeamSupabase();
  }

  return listFlowerTeamLocal();
}

export async function createFlowerStaff(displayName: string): Promise<CreateFlowerStaffResult> {
  if (shouldUseFlowerSupabase(getFlowerStorageMode())) {
    return createFlowerStaffSupabase(displayName);
  }

  return createFlowerStaffLocal(displayName);
}

export async function setFlowerTeamMemberActive(memberId: string, isActive: boolean): Promise<void> {
  if (shouldUseFlowerSupabase(getFlowerStorageMode())) {
    await setFlowerTeamMemberActiveSupabase(memberId, isActive);
    return;
  }

  await setFlowerTeamMemberActiveLocal(memberId, isActive);
}

export async function deleteFlowerTeamMember(memberId: string): Promise<void> {
  if (shouldUseFlowerSupabase(getFlowerStorageMode())) {
    await deleteFlowerTeamMemberSupabase(memberId);
    return;
  }

  await deleteFlowerTeamMemberLocal(memberId);
}

export async function completeStaffOnboarding(
  userId: string,
  branchId: string,
  newPassword: string,
): Promise<void> {
  if (shouldUseFlowerSupabase(getFlowerStorageMode())) {
    await completeStaffOnboardingSupabase(branchId, newPassword);
    return;
  }

  if (isFlowerDemoMode()) {
    await completeStaffOnboardingLocal(userId, branchId, newPassword);
    return;
  }

  throw new Error('Staff onboarding is only available in production mode.');
}
