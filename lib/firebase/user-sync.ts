import bcrypt from "bcryptjs";
import type { AuthUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const FIREBASE_MANAGED_PASSWORD_HASH = bcrypt.hashSync("firebase-managed-account", 12);

type FirebaseClaims = {
  uid: string;
  email?: string | null;
  name?: string | null;
};

type FirebaseUserRow = {
  user_id: number;
  email: string;
  name: string;
  plan: string;
  company?: string | null;
  phone?: string | null;
  firebase_uid?: string | null;
};

function toAuthUser(row: FirebaseUserRow, firebaseUid: string): AuthUser {
  return {
    userId: row.user_id,
    email: row.email,
    name: row.name,
    plan: row.plan || "Premium Plan",
    company: row.company ?? null,
    phone: row.phone ?? null,
    firebaseUid,
    authProvider: "firebase",
  };
}

export function upsertFirebaseUserFromClaims(
  claims: FirebaseClaims,
  displayName?: string | null
): AuthUser | null {
  const db = getDb();
  if (!db) {
    return null;
  }

  const email = String(claims.email || "").trim().toLowerCase();
  if (!email) {
    return null;
  }

  const name = String(displayName || claims.name || email.split("@")[0] || "Kullanıcı").trim();

  const existingByUid = db
    .prepare(
      "SELECT user_id, email, name, plan, company, phone, firebase_uid FROM users WHERE firebase_uid = ? LIMIT 1"
    )
    .get(claims.uid) as FirebaseUserRow | undefined;

  if (existingByUid) {
    db.prepare(
      "UPDATE users SET email = ?, name = ?, is_active = 1, last_login_at = datetime('now'), updated_at = datetime('now') WHERE user_id = ?"
    ).run(email, name, existingByUid.user_id);

    return toAuthUser(
      {
        ...existingByUid,
        email,
        name,
      },
      claims.uid
    );
  }

  const existingByEmail = db
    .prepare(
      "SELECT user_id, email, name, plan, company, phone, firebase_uid FROM users WHERE email = ? LIMIT 1"
    )
    .get(email) as FirebaseUserRow | undefined;

  if (existingByEmail) {
    db.prepare(
      "UPDATE users SET firebase_uid = ?, name = ?, is_active = 1, last_login_at = datetime('now'), updated_at = datetime('now') WHERE user_id = ?"
    ).run(claims.uid, name, existingByEmail.user_id);

    return toAuthUser(
      {
        ...existingByEmail,
        email,
        name,
        firebase_uid: claims.uid,
      },
      claims.uid
    );
  }

  const result = db.prepare(
    "INSERT INTO users (email, password_hash, name, plan, firebase_uid, last_login_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
  ).run(email, FIREBASE_MANAGED_PASSWORD_HASH, name, "Premium Plan", claims.uid);

  return {
    userId: Number(result.lastInsertRowid),
    email,
    name,
    plan: "Premium Plan",
    company: null,
    phone: null,
    firebaseUid: claims.uid,
    authProvider: "firebase",
  };
}
