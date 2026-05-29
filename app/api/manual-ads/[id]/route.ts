import { NextResponse } from "next/server";

import { getAuthenticatedUserFromRequest } from "@/lib/request-auth";
import {
  deleteManualAdCampaign,
  getManualAdCampaignDetail,
  updateManualAdCampaign,
} from "@/lib/manual-ads/repository";
import { validateManualAdCampaignInput } from "@/lib/manual-ads/validation";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Oturum bulunamadi." }, { status: 401 });
    }

    const { id } = await params;
    const detail = getManualAdCampaignDetail(user.userId, id);
    if (!detail) {
      return NextResponse.json({ success: false, error: "Kampanya bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...detail,
    });
  } catch (error) {
    console.error("Manual ads detail error:", error);
    return NextResponse.json({ success: false, error: "Kampanya getirilemedi." }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Oturum bulunamadi." }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as unknown;
    const validation = validateManualAdCampaignInput(body);
    if (!validation.ok) {
      return NextResponse.json({ success: false, error: "Doğrulama başarısız.", errors: validation.errors }, { status: 400 });
    }

    const detail = updateManualAdCampaign(user.userId, id, validation.value);
    if (!detail) {
      return NextResponse.json({ success: false, error: "Kampanya bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...detail,
    });
  } catch (error) {
    console.error("Manual ads update error:", error);
    const validationErrors = error instanceof Error && "validationErrors" in error
      ? (error as Error & { validationErrors?: Record<string, string[]> }).validationErrors
      : null;

    if (validationErrors) {
      return NextResponse.json({ success: false, error: "Doğrulama başarısız.", errors: validationErrors }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: "Kampanya güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Oturum bulunamadi." }, { status: 401 });
    }

    const { id } = await params;
    const deleted = deleteManualAdCampaign(user.userId, id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Kampanya bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Manual ads delete error:", error);
    return NextResponse.json({ success: false, error: "Kampanya silinemedi." }, { status: 500 });
  }
}
