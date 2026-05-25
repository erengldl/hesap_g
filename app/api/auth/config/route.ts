import { NextResponse } from "next/server";

import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

type AuthMode = "local" | "firebase" | "misconfigured";

function isFirebaseClientConfiguredOnServer() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim()
  );
}

function resolveAuthMode(): { authMode: AuthMode; error: string | null } {
  const clientConfigured = isFirebaseClientConfiguredOnServer();
  const serverConfigured = isFirebaseAdminConfigured();

  if (!clientConfigured) {
    return { authMode: "local", error: null };
  }

  if (!serverConfigured) {
    return {
      authMode: "misconfigured",
      error: "Firebase sunucu yapilandirmasi eksik.",
    };
  }

  return { authMode: "firebase", error: null };
}

export async function GET() {
  const { authMode, error } = resolveAuthMode();
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
