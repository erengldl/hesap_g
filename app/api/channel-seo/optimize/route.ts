import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

import { isSalesChannel } from "@/lib/channel-seo/channel-rules";
import { buildChannelSeoQualityWarnings } from "@/lib/channel-seo/mapper";
import { generateChannelSeoContent, getChannelSeoModelName, ChannelSeoGeneratorError } from "@/lib/channel-seo/generator";
import { getChannelSeoContent, getChannelSeoProductDetail } from "@/lib/channel-seo/repository";
import { calculateChannelSeoLocalScore, validateChannelSeoTone } from "@/lib/channel-seo/validation";
import type { SalesChannel, ChannelSeoTone } from "@/lib/channel-seo/types";

export const dynamic = "force-dynamic";

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function buildOptimizationPayload(input: {
  productId: string;
  channel: SalesChannel;
  title: string;
  description: string;
  keywords: string[];
  generatedBy: "gemini" | "fallback";
  model: string | null;
  warnings: string[];
  notes: string[];
  seoScore: number;
  localScore: number;
}) {
  return {
    productId: input.productId,
    channel: input.channel,
    title: input.title,
    description: input.description,
    seoScore: input.seoScore,
    localScore: input.localScore,
    keywords: input.keywords,
    warnings: input.warnings,
    notes: input.notes,
    generatedBy: input.generatedBy,
    model: input.model,
    status: "draft" as const,
    optimizedAt: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ã„Â°stek gÃƒÂ¶vdesi okunamadÃ„Â±.",
        },
        { status: 400 }
      );
    }

    const productId = readText(body.productId);
    if (!productId) {
      return NextResponse.json(
        {
          ok: false,
          error: "productId boÃ…Å¸ olamaz.",
        },
        { status: 400 }
      );
    }

    const channel = readText(body.channel);
    if (!isSalesChannel(channel)) {
      return NextResponse.json(
        {
          ok: false,
          error: "SatÃ„Â±Ã…Å¸ kanalÃ„Â± geÃƒÂ§erli olmalÃ„Â±dÃ„Â±r.",
        },
        { status: 400 }
      );
    }

    const overwriteExisting = body.overwriteExisting !== false;
    const userInstructions = readText(body.userInstructions) || null;
    const tone = body.tone;
    if (tone !== undefined && tone !== null && !validateChannelSeoTone(tone)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ton geÃƒÂ§erli olmalÃ„Â±dÃ„Â±r.",
        },
        { status: 400 }
      );
    }

    const keywords = readStringArray(body.keywords);
    const forbiddenWords = readStringArray(body.forbiddenWords);

    const detail = await getChannelSeoProductDetail(productId);
    if (!detail) {
      return NextResponse.json(
        {
          ok: false,
          error: "ÃƒÅ“rÃƒÂ¼n bulunamadÃ„Â±.",
        },
        { status: 404 }
      );
    }

    const existing = await getChannelSeoContent(productId, channel);
    if (existing && existing.status === "optimized" && !overwriteExisting) {
      return NextResponse.json({
        ok: true,
        data: {
          productId,
          channel,
          title: existing.title,
          description: existing.description,
          seoScore: existing.seoScore ?? 0,
          keywords: existing.keywords ?? [],
          warnings: existing.warnings ?? [],
          notes: existing.notes ?? [],
          generatedBy: existing.generatedBy ?? "manual",
          model: existing.model ?? null,
          status: existing.status,
          optimizedAt: existing.optimizedAt ?? existing.updatedAt ?? null,
          skipped: true,
        },
      });
    }

    const validatedTone: ChannelSeoTone | undefined = validateChannelSeoTone(tone) ? (tone as ChannelSeoTone) : undefined;

    const optimizationInput = {
      product: detail.product,
      channel,
      existingTitle: existing?.title ?? null,
      existingDescription: existing?.description ?? null,
      userInstructions,
      tone: validatedTone,
      keywords,
      forbiddenWords,
    };

    try {
      const generated = await generateChannelSeoContent(optimizationInput);
      const qualityWarnings = buildChannelSeoQualityWarnings(detail.product);
      const payload = buildOptimizationPayload({
        productId,
        channel,
        title: generated.title,
        description: generated.description,
        keywords: generated.keywords,
        generatedBy: "gemini",
        model: getChannelSeoModelName(),
        warnings: Array.from(new Set([...qualityWarnings, ...generated.warnings])),
        notes: generated.notes,
        seoScore: generated.seoScore,
        localScore: calculateChannelSeoLocalScore({
          product: detail.product,
          channel,
          title: generated.title,
          description: generated.description,
          keywords: generated.keywords,
          forbiddenWords,
        }),
      });

      return NextResponse.json({
        ok: true,
        data: payload,
      });
    } catch (error) {
      if (error instanceof ChannelSeoGeneratorError && error.code === "missing_api_key") {
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
          },
          { status: 503 }
        );
      }

      if (error instanceof ChannelSeoGeneratorError && error.fallback) {
        const qualityWarnings = buildChannelSeoQualityWarnings(detail.product);
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
            data: buildOptimizationPayload({
              productId,
              channel,
              title: error.fallback.title,
              description: error.fallback.description,
              keywords: error.fallback.keywords,
              generatedBy: "fallback",
              model: error.fallback.model,
              warnings: Array.from(new Set([...qualityWarnings, ...error.fallback.warnings])),
              notes: error.fallback.notes,
              seoScore: error.fallback.seoScore,
              localScore: calculateChannelSeoLocalScore({
                product: detail.product,
                channel,
                title: error.fallback.title,
                description: error.fallback.description,
                keywords: error.fallback.keywords,
                forbiddenWords,
              }),
            }),
          },
          { status: error.code === "parse_error" ? 502 : 500 }
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("Channel SEO optimize error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "SEO iÃƒÂ§eriÃ„Å¸i ÃƒÂ¼retilemedi.",
      },
      { status: 500 }
    );
  }
}
