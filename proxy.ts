import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = new Set(["/login", "/register"]);

function hasAuthCookie(request: NextRequest) {
  return request.cookies.has("hg_session") || request.cookies.has("hg_token");
}

export function proxy(request: NextRequest) {
  const { nextUrl } = request;
  const { pathname, search } = nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  const authenticated = hasAuthCookie(request);
  if (authenticated) {
    return NextResponse.next();
  }

  const loginUrl = nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("redirect", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)"],
};
