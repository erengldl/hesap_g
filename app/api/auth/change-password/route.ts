import { getDb } from "@/lib/db";
import { verifyPassword, hashPassword, verifyToken, getTokenFromCookies } from "@/lib/auth";
import { badRequest, unauthorized, serverError, ok } from "@/lib/api-helpers";

export async function POST(request: Request) {
  try {
    // Authenticate from cookie
    const cookieHeader = request.headers.get("cookie") || "";
    const token = getTokenFromCookies(cookieHeader);
    if (!token) return unauthorized();

    const user = await verifyToken(token);
    if (!user) return unauthorized();

    const { currentPassword, newPassword } = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return badRequest("Mevcut sifre ve yeni sifre gerekli.");
    }

    if (newPassword.length < 6) {
      return badRequest("Yeni sifre en az 6 karakter olmalidir.");
    }

    if (currentPassword === newPassword) {
      return badRequest("Yeni sifre mevcut sifre ile ayni olamaz.");
    }

    const db = getDb();
    if (!db) return serverError();

    const row = db.prepare("SELECT password_hash FROM users WHERE user_id = ?").get(user.userId) as {
      password_hash: string;
    } | undefined;

    if (!row) {
      return unauthorized("Kullanici bulunamadi.");
    }

    const isValid = await verifyPassword(currentPassword, row.password_hash);
    if (!isValid) {
      return badRequest("Mevcut sifre hatali.");
    }

    const newHash = await hashPassword(newPassword);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE user_id = ?").run(
      newHash,
      user.userId
    );

    return ok(undefined, { message: "Sifre basariyla guncellendi." });
  } catch (error) {
    console.error("Change password error:", error);
    return serverError();
  }
}
