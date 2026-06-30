export type FlowerUserRole = 'staff' | 'admin';

export interface FlowerUser {
  id: string;
  email: string;
  display_name: string;
  role: FlowerUserRole;
}

export interface FlowerAuthSession {
  user: FlowerUser;
  token: string;
  refresh_token?: string;
}
