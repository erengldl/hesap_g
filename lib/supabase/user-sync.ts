import bcrypt from "bcryptjs";
import type { User } from "@supabase/supabase-js";

import type { AuthUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const SUPABASE_MANAGED_PASSWORD_HASH = bcrypt.hashSync("supabase-managed-account", 12);

type AppUserRow = {
  user_id: number;
  email: string;
  name: string;
  plan: string;
  company?: string | null;
  phone?: string | null;
  auth_user_id?: string | null;
};

let authUserIdColumnReady = false;
let authUserIdColumnPromise: Promise<void> | null = null;

function resolveDisplayName(user: User, fallbackEmail: string) {
  const metadata = user.user_metadata ?? {};
  const metadataName =
    typeof metadata.name === "string" && metadata.name.trim()
      ? metadata.name.trim()
      : typeof metadata.full_name === "string" && metadata.full_name.trim()
        ? metadata.full_name.trim()
        : typeof metadata.display_name === "string" && metadata.display_name.trim()
          ? metadata.display_name.trim()
          : "";

  return metadataName || fallbackEmail.split("@")[0] || "Kullanici";
}

function toAuthUser(row: AppUserRow, authUserId: string): AuthUser {
  return {
    userId: row.user_id,
    authUserId,
    email: row.email,
    name: row.name,
    plan: row.plan || "Premium Plan",
    company: row.company ?? null,
    phone: row.phone ?? null,
    authProvider: "supabase",
  };
}

async function ensureAuthUserIdColumn() {
  if (authUserIdColumnReady) {
    return;
  }

  if (!authUserIdColumnPromise) {
    authUserIdColumnPromise = (async () => {
      const db = getDb();
      const existing = (await db.prepare(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_user_id'
        ) AS exists
      `).get()) as { exists?: boolean } | undefined;

      if (!existing?.exists) {
        await db.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id TEXT");
        await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id)");
      }

      authUserIdColumnReady = true;
    })().finally(() => {
      if (!authUserIdColumnReady) {
        authUserIdColumnPromise = null;
      }
    });
  }

  await authUserIdColumnPromise;
}

export async function upsertSupabaseUser(user: User): Promise<AuthUser | null> {
  const authUserId = String(user.id || "").trim();
  const email = String(user.email || "").trim().toLowerCase();

  if (!authUserId || !email) {
    return null;
  }

  await ensureAuthUserIdColumn();

  const db = getDb();
  const name = resolveDisplayName(user, email);

  const existingByAuthId = (await db.prepare(
    "SELECT user_id, email, name, plan, company, phone, auth_user_id FROM users WHERE auth_user_id = ? LIMIT 1"
  ).get(authUserId)) as AppUserRow | undefined;

  if (existingByAuthId) {
    await db.prepare(
      "UPDATE users SET email = ?, name = ?, is_active = 1, last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
    ).run(email, name, existingByAuthId.user_id);

    return toAuthUser(
      {
        ...existingByAuthId,
        email,
        name,
        auth_user_id: authUserId,
      },
      authUserId
    );
  }

  const existingByEmail = (await db.prepare(
    "SELECT user_id, email, name, plan, company, phone, auth_user_id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1"
  ).get(email)) as AppUserRow | undefined;

  if (existingByEmail) {
    await db.prepare(
      "UPDATE users SET auth_user_id = ?, name = ?, is_active = 1, last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
    ).run(authUserId, name, existingByEmail.user_id);

    return toAuthUser(
      {
        ...existingByEmail,
        email,
        name,
        auth_user_id: authUserId,
      },
      authUserId
    );
  }

  const result = await db.prepare(
    "INSERT INTO users (email, password_hash, name, plan, auth_user_id, last_login_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
  ).run(email, SUPABASE_MANAGED_PASSWORD_HASH, name, "Premium Plan", authUserId);

  return {
    userId: Number(result.lastInsertRowid),
    authUserId,
    email,
    name,
    plan: "Premium Plan",
    company: null,
    phone: null,
    authProvider: "supabase",
  };
}
