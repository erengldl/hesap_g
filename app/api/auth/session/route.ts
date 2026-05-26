import { NextResponse } from "next/server";

export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    { success: false, error: "Supabase auth aktif. Bu endpoint kullanilmiyor." },
    { status: 410 }
  );
}
