import { getTokenFromCookies, verifyToken, type AuthUser } from "@/lib/auth";
import {
  getFirebaseSessionCookieFromCookies,
  verifyFirebaseSessionCookie,
} from "@/lib/firebase/session";
import { upsertFirebaseUserFromClaims } from "@/lib/firebase/user-sync";

export async function getAuthenticatedUserFromCookieHeader(
  cookieHeader: string
): Promise<AuthUser | null> {
  const firebaseSessionCookie = getFirebaseSessionCookieFromCookies(cookieHeader);
  if (firebaseSessionCookie) {
    try {
      const claims = await verifyFirebaseSessionCookie(firebaseSessionCookie);
      const firebaseUser = await upsertFirebaseUserFromClaims(claims, claims.name ?? null);
      if (firebaseUser) {
        return firebaseUser;
      }
    } catch {
      // Fall back to legacy auth cookies below.
    }
  }

  const token = getTokenFromCookies(cookieHeader);
  if (!token) {
    return null;
  }

  return verifyToken(token);
}

export async function getAuthenticatedUserFromRequest(request: Request): Promise<AuthUser | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  return getAuthenticatedUserFromCookieHeader(cookieHeader);
}
