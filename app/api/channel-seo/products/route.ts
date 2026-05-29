import { NextRequest, NextResponse } from "next/server";

import { listChannelSeoCategories, listChannelSeoProducts } from "@/lib/channel-seo/repository";
import { isSalesChannel } from "@/lib/channel-seo/channel-rules";
import type { ChannelSeoStatus } from "@/lib/channel-seo/types";
import { validateChannelSeoStatus } from "@/lib/channel-seo/validation";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

function readTextParam(value: string | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function readPageParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const channelInput = readTextParam(searchParams.get("channel")) ?? "my_website";
    if (!isSalesChannel(channelInput)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Satış kanalı geçerli olmalıdır.",
        },
        { status: 400 }
      );
    }

    const statusParam = readTextParam(searchParams.get("status"));
    if (statusParam && statusParam !== "all" && !validateChannelSeoStatus(statusParam)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Durum filtresi geçerli olmalıdır.",
        },
        { status: 400 }
      );
    }

    const page = readPageParam(searchParams.get("page"), 1);
    const pageSize = Math.min(readPageParam(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const q = readTextParam(searchParams.get("q")) ?? undefined;
    const category = readTextParam(searchParams.get("category")) ?? undefined;
    const status = statusParam && statusParam !== "all" ? (statusParam as ChannelSeoStatus) : undefined;

    const products = listChannelSeoProducts({
      q,
      category,
      channel: channelInput,
      status,
      page,
      pageSize,
    });

    return NextResponse.json({
      ok: true,
      data: {
        ...products,
        facets: {
          categories: listChannelSeoCategories(),
        },
      },
    });
  } catch (error) {
    console.error("Channel SEO products error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Ürünler alınamadı.",
      },
      { status: 500 }
    );
  }
}
