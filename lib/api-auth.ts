import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { getAuthenticatedUserFromCookieHeader } from "./request-auth";
import { clearRequestContext, setRequestContext } from "./request-context";

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
  clearRequestContext();
  const cookieHeader = await resolveCookieHeader(request);

  if (!cookieHeader.trim()) {
    return NextResponse.json({ success: false, error: "Oturum gerekli." }, { status: 401 });
  }

  const user = await getAuthenticatedUserFromCookieHeader(cookieHeader);
  if (!user) {
    return NextResponse.json({ success: false, error: "Oturum süresi doldu." }, { status: 401 });
  }

  setRequestContext({
    userId: user.userId,
    authUserId: user.authUserId ?? null,
    email: user.email,
    name: user.name,
    plan: user.plan,
    requestId: randomUUID(),
  });

  return {
    userId: user.userId,
    authUserId: user.authUserId ?? null,
    email: user.email,
    name: user.name,
    plan: user.plan,
  };
}
