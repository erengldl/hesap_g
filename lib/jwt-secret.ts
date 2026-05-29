const DEV_JWT_SECRET = "hesap-g-dev-secret-change-in-production-min-32-chars";

export function getJwtSecret(): Uint8Array {
  const configuredSecret = process.env.JWT_SECRET?.trim();
  const secret = configuredSecret || (process.env.NODE_ENV === "production" ? "" : DEV_JWT_SECRET);

  if (!secret) {
    throw new Error("JWT_SECRET must be set in production.");
  }

  return new TextEncoder().encode(secret);
}
