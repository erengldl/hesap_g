export type ClientAuthMode = "supabase" | "misconfigured";

export type PublicAuthConfig = {
  authMode: ClientAuthMode;
  error: string | null;
};

const FALLBACK_AUTH_CONFIG: PublicAuthConfig = {
  authMode: "misconfigured",
  error: "Kimlik dogrulama yapilandirmasi alinamadi.",
};

let authConfigPromise: Promise<PublicAuthConfig> | null = null;

export async function loadPublicAuthConfig(): Promise<PublicAuthConfig> {
  if (authConfigPromise) {
    return authConfigPromise;
  }

  authConfigPromise = fetch("/api/auth/config", {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        return FALLBACK_AUTH_CONFIG;
      }

      const data = (await response.json().catch(() => null)) as Partial<PublicAuthConfig> | null;
      const authMode = data?.authMode;

      if (authMode === "supabase" || authMode === "misconfigured") {
        return {
          authMode,
          error: typeof data?.error === "string" ? data.error : null,
        } satisfies PublicAuthConfig;
      }

      return FALLBACK_AUTH_CONFIG;
    })
    .catch(() => FALLBACK_AUTH_CONFIG);

  return authConfigPromise;
}
