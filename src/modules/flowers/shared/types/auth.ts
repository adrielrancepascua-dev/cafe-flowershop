export type FlowerUserRole = 'staff' | 'admin' | 'co_admin';

export interface FlowerUser {
  id: string;
  email: string;
  display_name: string;
  role: FlowerUserRole;
  branch_id: string | null;
  branch_name: string | null;
  onboarding_completed: boolean;
  is_active: boolean;
}

export interface FlowerTeamMember extends FlowerUser {
  created_at?: string;
}

export interface CreateFlowerStaffResult {
  id: string;
  email: string;
  display_name: string;
  role: 'staff';
  temporary_password: string;
  onboarding_completed: false;
}
export interface FlowerAuthSession {
  user: FlowerUser;
  token: string;
  refresh_token?: string;
}

export function formatFlowerRoleLabel(role: FlowerUserRole | string): string {
  if (role === 'admin') {
    return 'Admin';
  }
  if (role === 'co_admin') {
    return 'Co-admin';
  }
  return 'Staff';
}
