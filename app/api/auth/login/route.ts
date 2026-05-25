import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPassword, signToken, AuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveServerAuthMode } from "@/lib/firebase/auth-mode";

export async function POST(request: Request) {
  try {
    const authConfig = resolveServerAuthMode();
    if (authConfig.authMode !== "firebase") {
      return NextResponse.json(
        { success: false, error: authConfig.error || "Yerel giris devre disi." },
        { status: 403 }
      );
    }

    const rateLimitResult = checkRateLimit(request, {
      limit: 5,
      windowSeconds: 60,
      prefix: "auth-login",
    });
    if (!rateLimitResult.success) {
      const retryAfter = Math.max(1, Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { success: false, error: "Cok fazla giris denemesi. Lutfen kisa sure sonra tekrar deneyin." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { email, password } = (await request.json()) as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "E-posta ve sifre gerekli." }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "Veritabani baglantisi saglanamadi." }, { status: 500 });
    }

    const user = await db.prepare("SELECT user_id, email, password_hash, name, plan, is_active FROM users WHERE email = ?").get(email) as {
      user_id: number;
      email: string;
      password_hash: string;
      name: string;
      plan: string;
      is_active: number;
    } | undefined;

    if (!user) {
      return NextResponse.json({ success: false, error: "E-posta veya sifre hatali." }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ success: false, error: "Hesabiniz devre disi." }, { status: 403 });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ success: false, error: "E-posta veya sifre hatali." }, { status: 401 });
    }

    // Update last login
    await db.prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(user.user_id);

    const authUser: AuthUser = {
      userId: user.user_id,
      email: user.email,
      name: user.name,
      plan: user.plan,
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
    console.error("Login error:", error);
    return NextResponse.json({ success: false, error: "Sunucu hatasi." }, { status: 500 });
  }
}
