import { getFirebaseAdminAuth } from "@/lib/firebase/admin";

export const FIREBASE_SESSION_COOKIE_NAME = "hg_session";
export const FIREBASE_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const FIREBASE_SESSION_EXPIRES_IN_MS = FIREBASE_SESSION_MAX_AGE_SECONDS * 1000;

type CookiePair = {
  name: string;
  value: string;
};

function parseCookieHeader(cookieHeader: string): CookiePair[] {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...rest] = part.split("=");
      return {
        name,
        value: rest.join("="),
      };
    });
}

export function getFirebaseSessionCookieFromCookies(cookieHeader: string): string | null {
  for (const cookie of parseCookieHeader(cookieHeader)) {
    if (cookie.name === FIREBASE_SESSION_COOKIE_NAME) {
      return cookie.value || null;
    }
  }

  return null;
}

export async function createFirebaseSessionCookie(idToken: string): Promise<string> {
  return getFirebaseAdminAuth().createSessionCookie(idToken, {
    expiresIn: FIREBASE_SESSION_EXPIRES_IN_MS,
  });
}

export async function verifyFirebaseSessionCookie(sessionCookie: string) {
  return getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
}

export function getFirebaseSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: FIREBASE_SESSION_MAX_AGE_SECONDS,
  };
}

export function getClearedFirebaseSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
