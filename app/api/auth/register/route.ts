import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword, signToken, AuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const rateLimitResult = checkRateLimit(request, {
      limit: 4,
      windowSeconds: 60,
      prefix: "auth-register",
    });
    if (!rateLimitResult.success) {
      const retryAfter = Math.max(1, Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { success: false, error: "Cok fazla kayit denemesi. Lutfen kisa sure sonra tekrar deneyin." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { email, password, name } = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: "E-posta, sifre ve ad soyad gerekli." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Sifre en az 6 karakter olmalidir." },
        { status: 400 }
      );
    }

    if (!email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Gecerli bir e-posta adresi giriniz." },
        { status: 400 }
      );
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Veritabani baglantisi saglanamadi." },
        { status: 500 }
      );
    }

    const existing = await db.prepare("SELECT user_id FROM users WHERE email = ?").get(email) as { user_id: number } | undefined;
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Bu e-posta adresi zaten kayitli." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const result = await db.prepare(
      "INSERT INTO users (email, password_hash, name, plan) VALUES (?, ?, ?, ?)"
    ).run(email, passwordHash, name, "Premium Plan");

    const authUser: AuthUser = {
      userId: Number(result.lastInsertRowid),
      email,
      name,
      plan: "Premium Plan",
    };

    const token = await signToken(authUser);

    const response = NextResponse.json({
      success: true,
      user: authUser,
    });

    response.cookies.set("hg_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { success: false, error: "Sunucu hatasi." },
      { status: 500 }
    );
  }
}
