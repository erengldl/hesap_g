import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAuthenticatedUserFromCookieHeader } from "./request-auth";

export type ApiContext = {
  userId: number;
  authUserId?: string | null;
  email: string;
  name: string;
  plan: string;
};

async function resolveCookieHeader(request?: Request) {
  if (request) {
    return request.headers.get("cookie") || "";
  }

  try {
    const cookieStore = await cookies();
    return cookieStore
      .getAll()
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");
  } catch {
    return "";
  }
}

export async function requireAuth(request?: Request): Promise<ApiContext | NextResponse> {
  const cookieHeader = await resolveCookieHeader(request);

  if (!cookieHeader.trim()) {
    return NextResponse.json({ success: false, error: "Oturum gerekli." }, { status: 401 });
  }

  const user = await getAuthenticatedUserFromCookieHeader(cookieHeader);
  if (!user) {
    return NextResponse.json({ success: false, error: "Oturum suresi dolmus." }, { status: 401 });
  }

  return {
    userId: user.userId,
    authUserId: user.authUserId ?? null,
    email: user.email,
    name: user.name,
    plan: user.plan,
  };
}
