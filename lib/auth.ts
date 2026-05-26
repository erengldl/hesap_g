import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { getJwtSecret } from "@/lib/jwt-secret";

const TOKEN_COOKIE_NAME = "hg_token";
const TOKEN_EXPIRES_IN = "7d";

export interface AuthUser {
  userId: number;
  authUserId?: string | null;
  email: string;
  name: string;
  plan: string;
  company?: string | null;
  phone?: string | null;
  firebaseUid?: string | null;
  authProvider?: "legacy" | "firebase" | "supabase";
}

// ─── Password utilities ────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT utilities ─────────────────────────────────────────────────────

export async function signToken(user: AuthUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRES_IN)
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return {
      userId: payload.userId as number,
      email: payload.email as string,
      name: payload.name as string,
      plan: (payload.plan as string) || "Premium Plan",
      authProvider: "legacy",
    };
  } catch {
    return null;
  }
}

export function getTokenFromCookies(cookieHeader: string): string | null {
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split("=");
    if (name === TOKEN_COOKIE_NAME) {
      return rest.join("=") || null;
    }
  }
  return null;
}

export function setTokenCookie(token: string): string {
  return `${TOKEN_COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearTokenCookie(): string {
  return `${TOKEN_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

export { TOKEN_COOKIE_NAME };
