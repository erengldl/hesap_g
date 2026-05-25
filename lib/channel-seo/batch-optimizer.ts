import { createChannelSeoJob, finishChannelSeoJob, getChannelSeoContent, getChannelSeoProductDetail, updateChannelSeoJob } from "./repository";
import { generateChannelSeoContent, getChannelSeoModelName, ChannelSeoGeneratorError } from "./generator";
import { validateChannelSeoBulkRequest } from "./validation";
import type {
  ChannelSeoBulkRequest,
  ChannelSeoBulkResultItem,
  ChannelSeoOptimizationOutput,
  SalesChannel,
} from "./types";

export type ChannelSeoBulkOptimizationResult = {
  summary: {
    total: number;
    success: number;
    error: number;
    skipped: number;
  };
  items: ChannelSeoBulkResultItem[];
  jobId: number;
};

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function toBulkContent(output: ChannelSeoOptimizationOutput, model: string | null) {
  return {
    ...output,
    generatedBy: "gemini" as const,
    model,
  };
}

function buildMissingProductItems(productId: string, channels: SalesChannel[], message: string) {
  return channels.map(
    (channel): ChannelSeoBulkResultItem => ({
      productId,
      channel,
      status: "error",
      error: message,
    })
  );
}

function buildErrorItem(
  productId: string,
  channel: SalesChannel,
  message: string,
  content?: ChannelSeoBulkResultItem["content"]
): ChannelSeoBulkResultItem {
  return {
    productId,
    channel,
    status: "error",
    error: message,
    ...(content ? { content } : {}),
  };
}

export async function runChannelSeoBulkOptimization(
  input: ChannelSeoBulkRequest
): Promise<ChannelSeoBulkOptimizationResult> {
  const validation = validateChannelSeoBulkRequest(input);
  if (!validation.ok) {
    const message = validation.errors.productIds?.[0] ?? validation.errors.channels?.[0] ?? validation.errors.tone?.[0] ?? "Toplu optimizasyon isteği geçersiz.";
    throw new Error(message);
  }

  const { productIds, channels, overwriteExisting, userInstructions, tone } = validation.value;
  const total = productIds.length * channels.length;
  const jobId = await createChannelSeoJob({ totalCount: total, channels, model: getChannelSeoModelName() });
  const items: ChannelSeoBulkResultItem[] = [];
  const summary = { total, success: 0, error: 0, skipped: 0 };
  const productChunks = chunkArray(productIds, 3);
  const modelName = getChannelSeoModelName();

  for (const productChunk of productChunks) {
    const chunkResults = await Promise.all(
      productChunk.map(async (productId) => {
        const detail = await getChannelSeoProductDetail(productId);
        if (!detail) {
          summary.error += channels.length;
          return buildMissingProductItems(productId, channels, "Ürün bulunamadı.");
        }

        const productItems: ChannelSeoBulkResultItem[] = [];

        for (const channel of channels) {
          const existing = await getChannelSeoContent(productId, channel);
          if (!overwriteExisting && existing?.status === "optimized") {
            summary.skipped += 1;
            productItems.push({
              productId,
              channel,
              status: "skipped",
            });
            continue;
          }

          try {
            const generated = await generateChannelSeoContent({
              product: detail.product,
              channel,
              existingTitle: existing?.title ?? null,
              existingDescription: existing?.description ?? null,
              userInstructions: userInstructions ?? null,
              tone,
              keywords: existing?.keywords ?? undefined,
              forbiddenWords: undefined,
            });

            summary.success += 1;
            productItems.push({
              productId,
              channel,
              status: "success",
              content: toBulkContent(generated, modelName),
            });
          } catch (error) {
            summary.error += 1;
            if (error instanceof ChannelSeoGeneratorError && error.fallback) {
              productItems.push({
                productId,
                channel,
                status: "error",
                error: error.message,
                content: {
                  ...error.fallback,
                  generatedBy: "fallback",
                  model: null,
                },
              });
              continue;
            }

            productItems.push(buildErrorItem(productId, channel, error instanceof Error ? error.message : "SEO içeriği üretilemedi."));
          }
        }

        return productItems;
      })
    );

    for (const resultGroup of chunkResults) {
      items.push(...resultGroup);
    }

    await updateChannelSeoJob(jobId, summary);
  }

  await finishChannelSeoJob(jobId, summary);

  return {
    summary,
    items,
    jobId,
  };
}
