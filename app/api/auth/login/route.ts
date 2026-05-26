import { NextResponse } from "next/server";
import { resolveServerAuthMode } from "@/lib/supabase/auth-mode";

export async function POST(request: Request) {
  void request;
  const authConfig = resolveServerAuthMode();
  return NextResponse.json(
    { success: false, error: authConfig.error || "Supabase auth aktif. Bu endpoint kullanılmıyor." },
    { status: 410 }
  );
}
