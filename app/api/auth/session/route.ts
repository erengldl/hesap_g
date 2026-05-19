import { NextResponse } from "next/server";

import { isFirebaseAdminConfigured, getFirebaseAdminAuth } from "@/lib/firebase/admin";
import {
  createFirebaseSessionCookie,
  getClearedFirebaseSessionCookieOptions,
  getFirebaseSessionCookieOptions,
} from "@/lib/firebase/session";
import { upsertFirebaseUserFromClaims } from "@/lib/firebase/user-sync";

type SessionExchangeBody = {
  idToken?: string;
  name?: string;
  displayName?: string;
};

export async function POST(request: Request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json(
        { success: false, error: "Firebase sunucu yapilandirmasi eksik." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as SessionExchangeBody;
    const idToken = String(body.idToken || "").trim();

    if (!idToken) {
      return NextResponse.json(
        { success: false, error: "Firebase kimlik belirteci gerekli." },
        { status: 400 }
      );
    }

    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifyIdToken(idToken, true);
    const user = upsertFirebaseUserFromClaims(
      decoded,
      body.displayName ?? body.name ?? decoded.name ?? null
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Kullanici local veritabaninda olusturulamadi." },
        { status: 500 }
      );
    }

    const sessionCookie = await createFirebaseSessionCookie(idToken);
    const response = NextResponse.json({
      success: true,
      user,
    });

    response.cookies.set("hg_session", sessionCookie, getFirebaseSessionCookieOptions());
    response.cookies.set("hg_token", "", getClearedFirebaseSessionCookieOptions());

    return response;
  } catch (error) {
    console.error("Firebase session exchange error:", error);
    return NextResponse.json(
      { success: false, error: "Sunucu hatasi." },
      { status: 500 }
    );
  }
}
