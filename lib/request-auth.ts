import type { AuthUser } from "@/lib/auth";
import { createSupabaseServerClientFromCookieHeader } from "@/lib/supabase/server";
import { upsertSupabaseUser } from "@/lib/supabase/user-sync";

export async function getAuthenticatedUserFromCookieHeader(
  cookieHeader: string
): Promise<AuthUser | null> {
  if (!cookieHeader.trim()) {
    return null;
  }

  try {
    const supabase = createSupabaseServerClientFromCookieHeader(cookieHeader);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    const appUser = await upsertSupabaseUser(user);
    if (appUser) {
      return appUser;
    }
  } catch {
    return null;
  }

  return null;
}

export async function getAuthenticatedUserFromRequest(request: Request): Promise<AuthUser | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  return getAuthenticatedUserFromCookieHeader(cookieHeader);
}
