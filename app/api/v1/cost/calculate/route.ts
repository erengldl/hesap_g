import { NextResponse } from "next/server";
import { handleCostBootstrap, handleCostCalculationRequest } from "./service";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  return handleCostBootstrap(request);
}

export async function POST(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  return handleCostCalculationRequest(request);
}
