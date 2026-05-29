const DATABASE_URL_ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "SUPABASE_DB_URL",
  "SUPABASE_POSTGRES_URL",
] as const;

export function resolveDatabaseUrl() {
  for (const key of DATABASE_URL_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

export function hasDatabaseUrl() {
  return resolveDatabaseUrl() !== null;
}

