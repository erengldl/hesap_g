import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAuthenticatedUserFromCookieHeader } from "@/lib/request-auth";
import { TOKEN_COOKIE_NAME } from "@/lib/auth";

const EXPIRED_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 0,
};

function getSupabaseCookieNames(cookieHeader: string) {
  const names = new Set<string>();

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const name = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex).trim() : trimmed;
    if (name.startsWith("sb-")) {
      names.add(name);
    }
  }

  return [...names];
}

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const user = await getAuthenticatedUserFromCookieHeader(cookieHeader);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Oturum bulunamadi." },
        { status: 401 }
      );
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: true, user });
    }

    const profile = await db.prepare(`
      SELECT company, phone
      FROM users
      WHERE user_id = ?
      LIMIT 1
    `).get(user.userId) as { company?: string | null; phone?: string | null } | undefined;

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        company: profile?.company ?? null,
        phone: profile?.phone ?? null,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json(
      { success: false, error: "Sunucu hatası." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const response = NextResponse.json({ success: true });
  response.cookies.set(TOKEN_COOKIE_NAME, "", EXPIRED_COOKIE_OPTIONS);
  response.cookies.set("hg_session", "", EXPIRED_COOKIE_OPTIONS);

  for (const cookieName of getSupabaseCookieNames(cookieHeader)) {
    response.cookies.set(cookieName, "", EXPIRED_COOKIE_OPTIONS);
  }

  return response;
}
