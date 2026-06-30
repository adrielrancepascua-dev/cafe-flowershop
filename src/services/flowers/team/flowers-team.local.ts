import type { FlowerTeamMember } from '../../../modules/flowers/shared/types/auth';
import { STAFF_EMAIL_DOMAIN } from '../../../modules/flowers/shared/config/brand';
import { FLOWER_BRANCHES_MOCK, FLOWER_DEMO_USERS } from '../../../modules/flowers/shared/data/flowers.mock';

const TEAM_STORAGE_KEY = 'papers_petals_team_v1';

type StoredTeamMember = FlowerTeamMember & { password?: string };

function readTeam(): StoredTeamMember[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(TEAM_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredTeamMember[]) : [];
  } catch {
    return [];
  }
}

function writeTeam(members: StoredTeamMember[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(members));
}

function branchName(branchId: string | null): string | null {
  if (!branchId) {
    return null;
  }

  return FLOWER_BRANCHES_MOCK.find((branch) => branch.id === branchId)?.name ?? null;
}

export async function listFlowerTeamLocal(): Promise<FlowerTeamMember[]> {
  const demoMembers = FLOWER_DEMO_USERS.map((user) => ({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    branch_id: user.branch_id ?? 'branch-dagupan',
    branch_name: branchName(user.branch_id ?? 'branch-dagupan'),
    onboarding_completed: user.onboarding_completed ?? true,
    is_active: user.is_active ?? true,
  }));

  const extra = readTeam().map((member) => ({
    ...member,
    branch_name: branchName(member.branch_id),
  }));

  return [...demoMembers, ...extra];
}

export async function createFlowerStaffLocal(displayName: string) {
  const domain = STAFF_EMAIL_DOMAIN;
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 20) || 'staff';
  const email = `${slug}.${Date.now().toString(36).slice(-4)}@${domain}`;
  const id = `user-staff-${Date.now()}`;

  const created: StoredTeamMember = {
    id,
    email,
    display_name: displayName,
    role: 'staff',
    branch_id: null,
    branch_name: null,
    onboarding_completed: false,
    is_active: true,
    password: '1234',
    created_at: new Date().toISOString(),
  };

  writeTeam([...readTeam(), created]);

  return {
    id,
    email,
    display_name: displayName,
    role: 'staff' as const,
    temporary_password: '1234',
    onboarding_completed: false as const,
  };
}

export async function setFlowerTeamMemberActiveLocal(memberId: string, isActive: boolean): Promise<void> {
  const next = readTeam().map((member) =>
    member.id === memberId ? { ...member, is_active: isActive } : member,
  );
  writeTeam(next);
}

export async function completeStaffOnboardingLocal(
  userId: string,
  branchId: string,
  newPassword: string,
): Promise<void> {
  const next = readTeam().map((member) =>
    member.id === userId
      ? {
          ...member,
          branch_id: branchId,
          branch_name: FLOWER_BRANCHES_MOCK.find((branch) => branch.id === branchId)?.name ?? null,
          onboarding_completed: true,
          password: newPassword,
        }
      : member,
  );

  if (!next.some((member) => member.id === userId)) {
    throw new Error('Staff account not found in demo storage.');
  }

  writeTeam(next);
}
