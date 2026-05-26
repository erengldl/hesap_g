export const TOKEN_COOKIE_NAME = "hg_token";

export interface AuthUser {
  userId: number;
  authUserId?: string | null;
  email: string;
  name: string;
  plan: string;
  company?: string | null;
  phone?: string | null;
  authProvider?: "supabase";
}
