import { getDb } from "@/lib/db";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";
import { badRequest, unauthorized, serverError, ok } from "@/lib/api-helpers";

export async function PATCH(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const token = getTokenFromCookies(cookieHeader);
    if (!token) return unauthorized();

    const user = await verifyToken(token);
    if (!user) return unauthorized();

    const { name, company, phone } = (await request.json()) as {
      name?: string;
      company?: string;
      phone?: string;
    };

    if (!name || !name.trim()) {
      return badRequest("Ad soyad alani zorunludur.");
    }

    const db = getDb();
    if (!db) return serverError();

    db.prepare(
      "UPDATE users SET name = ?, company = ?, phone = ?, updated_at = datetime('now') WHERE user_id = ?"
    ).run(name.trim(), company?.trim() || null, phone?.trim() || null, user.userId);

    return ok(undefined, {
      user: {
        ...user,
        name: name.trim(),
      },
      message: "Profil basariyla guncellendi.",
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return serverError();
  }
}
