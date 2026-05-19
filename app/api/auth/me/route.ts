import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const tokenCookie = cookieHeader
      .split("; ")
      .find((c) => c.startsWith("hg_token="));

    if (!tokenCookie) {
      return NextResponse.json(
        { success: false, error: "Oturum bulunamadi." },
        { status: 401 }
      );
    }

    const token = tokenCookie.split("=")[1];
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Gecersiz oturum." },
        { status: 401 }
      );
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Oturum suresi dolmus." },
        { status: 401 }
      );
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: true, user });
    }

    const profile = db.prepare(`
      SELECT company, phone
      FROM users
      WHERE user_id = ?
      LIMIT 1
    `).get(user.userId) as { company?: string | null; phone?: string | null } | undefined;

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        company: profile?.company ?? null,
        phone: profile?.phone ?? null,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json(
      { success: false, error: "Sunucu hatasi." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("hg_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
