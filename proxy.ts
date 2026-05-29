import { NextRequest, NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

const PUBLIC_ROUTES = new Set(["/login", "/register", "/auth/callback"]);
const PUBLIC_API_ROUTES = new Set(["/api/auth/config"]);
function buildAuthMisconfiguredResponse(nextUrl: URL, pathname: string, search: string) {
  if (pathname.startsWith("/api")) {
    return NextResponse.json(
      {
        success: false,
        error: "Supabase auth configuration is missing.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }

  const loginUrl = new URL(nextUrl.toString());
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("authError", "config");
  loginUrl.searchParams.set("redirect", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const { nextUrl } = request;
  const { pathname, search } = nextUrl;

  if (!isSupabaseConfigured()) {
    if (PUBLIC_ROUTES.has(pathname) || PUBLIC_API_ROUTES.has(pathname)) {
      return NextResponse.next();
    }

    return buildAuthMisconfiguredResponse(nextUrl, pathname, search);
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
