import { NextRequest, NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

const PUBLIC_ROUTES = new Set(["/login", "/register", "/auth/callback"]);

export async function proxy(request: NextRequest) {
  const { nextUrl } = request;
  const { pathname, search } = nextUrl;

  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  const { response, user } = await updateSupabaseSession(request);

  if (pathname.startsWith("/api")) {
    return response;
  }

  if (PUBLIC_ROUTES.has(pathname)) {
    return response;
  }

  if (user) {
    return response;
  }

  const loginUrl = nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("redirect", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)"],
};
