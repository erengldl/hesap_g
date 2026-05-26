import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const loginUrl = new URL(requestUrl.toString());
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("authError", "callback");
      return NextResponse.redirect(loginUrl);
    }
  }

  const redirectUrl = new URL(requestUrl.toString());
  redirectUrl.pathname = next.startsWith("/") ? next : "/dashboard";
  redirectUrl.search = "";

  return NextResponse.redirect(redirectUrl);
}
