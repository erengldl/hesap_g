import { cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let adminApp: App | null = null;
let cachedServiceAccount: ServiceAccount | null = null;

type RawServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
};

function readServiceAccount(): ServiceAccount {
  if (cachedServiceAccount) {
    return cachedServiceAccount;
  }

  const rawJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim() ||
    "";

  if (!rawJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must be set for Firebase auth.");
  }

  const parsed = JSON.parse(rawJson) as RawServiceAccount;
  const projectId = parsed.projectId || parsed.project_id;
  const clientEmail = parsed.clientEmail || parsed.client_email;
  const privateKey = parsed.privateKey || parsed.private_key;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase service account JSON is missing required fields.");
  }

  cachedServiceAccount = {
    projectId,
    clientEmail,
    privateKey,
  };
  return cachedServiceAccount;
}

export function isFirebaseAdminConfigured() {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim()
  );
}

export function getFirebaseAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0]!;
    return adminApp;
  }

  adminApp = initializeApp({
    credential: cert(readServiceAccount()),
  });

  return adminApp;
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}
