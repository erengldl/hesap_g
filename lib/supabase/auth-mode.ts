import { isSupabaseConfigured } from "@/lib/supabase/config";

export type AuthMode = "supabase" | "misconfigured";

type AuthModeResolution = {
  authMode: AuthMode;
  error: string | null;
};

export function resolveServerAuthMode(): AuthModeResolution {
  if (!isSupabaseConfigured()) {
    return {
      authMode: "misconfigured",
      error: "Supabase auth yapilandirmasi eksik.",
    };
  }

  return {
    authMode: "supabase",
    error: null,
  };
}
