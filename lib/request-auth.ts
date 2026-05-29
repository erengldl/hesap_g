import { getTokenFromCookies, verifyToken, type AuthUser } from "@/lib/auth";

export async function getAuthenticatedUserFromRequest(request: Request): Promise<AuthUser | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = getTokenFromCookies(cookieHeader);
  if (!token) {
    return null;
  }

  return verifyToken(token);
}
