import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAuthenticatedUserFromCookieHeader } from "./request-auth";

export type ApiContext = {
  userId: number;
  email: string;
  name: string;
  plan: string;
};

function hasAuthCookie(cookieHeader: string) {
  return /(?:^|;\s*)(hg_session|hg_token)=/.test(cookieHeader);
}

async function resolveCookieHeader(request?: Request) {
  if (request) {
    return request.headers.get("cookie") || "";
  }

  try {
    const cookieStore = await cookies();
    const firebaseSession = cookieStore.get("hg_session")?.value;
    const token = cookieStore.get("hg_token")?.value;

    return [firebaseSession ? `hg_session=${firebaseSession}` : null, token ? `hg_token=${token}` : null]
      .filter((value): value is string => Boolean(value))
      .join("; ");
  } catch {
    return "";
  }
}

export async function requireAuth(request?: Request): Promise<ApiContext | NextResponse> {
  const cookieHeader = await resolveCookieHeader(request);

  if (!hasAuthCookie(cookieHeader)) {
    return NextResponse.json({ success: false, error: "Oturum gerekli." }, { status: 401 });
  }

  const user = await getAuthenticatedUserFromCookieHeader(cookieHeader);
  if (!user) {
    return NextResponse.json({ success: false, error: "Oturum suresi dolmus." }, { status: 401 });
  }

  return {
    userId: user.userId,
    email: user.email,
    name: user.name,
    plan: user.plan,
  };
}
