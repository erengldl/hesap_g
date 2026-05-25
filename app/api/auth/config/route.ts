import { NextResponse } from "next/server";

import { resolveServerAuthMode } from "@/lib/firebase/auth-mode";

export async function GET() {
  const { authMode, error } = resolveServerAuthMode();
  return NextResponse.json(
    {
      success: true,
      authMode,
      error,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
