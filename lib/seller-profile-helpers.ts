import { getDb, getOne } from "@/lib/db";
import { requireCurrentAuthUserId } from "@/lib/tenant";

export const DEFAULT_SELLER_PROFILE = {
  company_type: "Şahıs Şirketi",
  tax_bracket: 20,
  expected_monthly_order_count: 500,
} as const;

export async function getCurrentSellerProfileId() {
  const authUserId = requireCurrentAuthUserId();
  const row = await getOne<{ profile_id: number }>(
    `
      SELECT profile_id
      FROM seller_profiles
      WHERE user_id = ?
      ORDER BY profile_id ASC
      LIMIT 1
    `,
    [authUserId],
  );

  return row?.profile_id ?? null;
}

export async function getOrCreateCurrentSellerProfileId() {
  const authUserId = requireCurrentAuthUserId();
  const existingProfileId = await getCurrentSellerProfileId();
  if (existingProfileId) {
    return existingProfileId;
  }

  const db = getDb();
  if (!db) {
    throw new Error("Veritabanı bağlantısı kullanılamıyor.");
  }

  await db.prepare(`
    INSERT INTO seller_profiles (
      company_type,
      tax_bracket,
      expected_monthly_order_count,
      user_id
    ) VALUES (?, ?, ?, ?)
  `).run(
    DEFAULT_SELLER_PROFILE.company_type,
    DEFAULT_SELLER_PROFILE.tax_bracket,
    DEFAULT_SELLER_PROFILE.expected_monthly_order_count,
    authUserId,
  );

  const createdProfileId = await getCurrentSellerProfileId();
  if (!createdProfileId) {
    throw new Error("Satıcı profili oluşturulamadı.");
  }

  return createdProfileId;
}
