import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export type AuthMode = "firebase" | "misconfigured";

type AuthModeResolution = {
  authMode: AuthMode;
  error: string | null;
};

function isFirebaseClientConfiguredOnServer() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim()
  );
}

export function resolveServerAuthMode(): AuthModeResolution {
  if (!isFirebaseClientConfiguredOnServer()) {
    return {
      authMode: "misconfigured",
      error: "Firebase istemci yapilandirmasi eksik.",
    };
  }

  if (!isFirebaseAdminConfigured()) {
    return {
      authMode: "misconfigured",
      error: "Firebase sunucu yapilandirmasi eksik.",
    };
  }

  return {
    authMode: "firebase",
    error: null,
  };
}
