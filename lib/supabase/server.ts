import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/supabase/config";

type CookiePair = {
  name: string;
  value: string;
};

function parseCookieHeader(cookieHeader: string): CookiePair[] {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...rest] = part.split("=");
      return {
        name,
        value: rest.join("="),
      };
    });
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components may expose a read-only cookie store. Proxy handles refresh persistence.
        }
      },
    },
  });
}

export function createSupabaseServerClientFromCookieHeader(cookieHeader: string): SupabaseClient {
  const { url, publishableKey } = getSupabaseConfig();
  const parsedCookies = parseCookieHeader(cookieHeader);

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return parsedCookies;
      },
      setAll() {
        // No-op. Proxy is responsible for refreshing persisted cookies.
      },
    },
  });
}

export function createStatelessSupabaseClient() {
  const { url, publishableKey } = getSupabaseConfig();

  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
