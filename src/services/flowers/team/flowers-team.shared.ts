import type { FlowerTeamMember } from '../../../modules/flowers/shared/types/auth';
import { FLOWER_BRANCHES_MOCK } from '../../../modules/flowers/shared/data/flowers.mock';

function branchNameFromId(branchId: string | null): string | null {
  if (!branchId) {
    return null;
  }

  return FLOWER_BRANCHES_MOCK.find((branch) => branch.id === branchId)?.name ?? null;
}

export function mapFlowerProfileRow(row: {
  id: string;
  email: string;
  display_name: string;
  role: string;
  branch_id?: string | null;
  onboarding_completed?: boolean | null;
  is_active?: boolean | null;
  created_at?: string;
  flower_branches?: { name: string } | { name: string }[] | null;
}): FlowerTeamMember {
  const branch = row.flower_branches;
  const branchNameValue = Array.isArray(branch) ? branch[0]?.name : branch?.name;

  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    role: row.role === 'admin' ? 'admin' : 'staff',
    branch_id: row.branch_id ?? null,
    branch_name: branchNameValue ?? branchNameFromId(row.branch_id ?? null),
    onboarding_completed: row.onboarding_completed ?? true,
    is_active: row.is_active ?? true,
    created_at: row.created_at,
  };
}
