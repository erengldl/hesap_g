import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyToken } from "./auth";

export type ApiContext = {
  userId: number;
  email: string;
  name: string;
  plan: string;
};

export async function requireAuth(): Promise<ApiContext | NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get("hg_token")?.value;

  if (!token) {
    return NextResponse.json({ success: false, error: "Oturum gerekli." }, { status: 401 });
  }

  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json({ success: false, error: "Oturum suresi dolmus." }, { status: 401 });
  }

  return {
    userId: user.userId,
    email: user.email,
    name: user.name,
    plan: user.plan,
  };
}
