type SupabaseConfig = {
  url: string;
  publishableKey: string;
};

function readPublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    ""
  );
}

export function resolveSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const publishableKey = readPublishableKey();

  if (!url || !publishableKey) {
    return null;
  }

  return {
    url,
    publishableKey,
  };
}

export function getSupabaseConfig(): SupabaseConfig {
  const config = resolveSupabaseConfig();

  if (!config) {
    throw new Error("Supabase client config is missing.");
  }

  return config;
}

export function isSupabaseConfigured() {
  return resolveSupabaseConfig() !== null;
}
