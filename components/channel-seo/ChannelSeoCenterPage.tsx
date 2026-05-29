"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { ChannelSeoToolbar } from "./ChannelSeoToolbar";
import { ChannelSeoBulkActions } from "./ChannelSeoBulkActions";
import { ChannelSeoProductTable } from "./ChannelSeoProductTable";
import { ChannelSeoProductDrawer } from "./ChannelSeoProductDrawer";
import { ChannelSeoLoadingState } from "./ChannelSeoLoadingState";
import { ChannelSeoEmptyState } from "./ChannelSeoEmptyState";
import { ChannelSeoErrorPanel } from "./ChannelSeoErrorPanel";
import { ChannelSeoProgressModal } from "./ChannelSeoProgressModal";
import { ChannelSeoStatusBadge } from "./ChannelSeoStatusBadge";
import { listChannelSeoOptions } from "@/lib/channel-seo/channel-rules";
import { buildChannelSeoQualityWarnings, createChannelSeoContentRecord } from "@/lib/channel-seo/mapper";
import { calculateChannelSeoLocalScore } from "@/lib/channel-seo/validation";
import type {
  ChannelSeoContent,
  ChannelSeoGeneratedBy,
  ChannelSeoPagination,
  ChannelSeoProduct,
  ChannelSeoProductWithContents,
  SalesChannel,
  ChannelSeoStatus,
} from "@/lib/channel-seo/types";
import type { ChannelSeoCategoryOption, ChannelSeoChannelOption } from "./ChannelSeoToolbar";
import type { ChannelSeoProductRowModel } from "./ChannelSeoProductRow";

type ApiListResponse = {
  ok: boolean;
  data?: {
    items: ChannelSeoProductWithContents[];
    pagination: ChannelSeoPagination;
    facets?: {
      categories?: ChannelSeoCategoryOption[];
    };
  };
  error?: string;
  details?: Record<string, string[]>;
};

type ApiOptimizeResponse = {
  ok: boolean;
  data?: {
    productId: string;
    channel: SalesChannel;
    title: string;
    description: string;
    seoScore: number;
    localScore?: number;
    keywords: string[];
    warnings: string[];
    notes: string[];
    generatedBy: ChannelSeoGeneratedBy;
    model: string | null;
    status: ChannelSeoStatus;
    optimizedAt: string;
    skipped?: boolean;
  };
  error?: string;
};

type ApiBulkResponse = {
  ok: boolean;
  data?: {
    summary: {
      total: number;
      success: number;
      error: number;
      skipped: number;
    };
    items: Array<{
      productId: string;
      channel: SalesChannel;
      status: "success" | "error" | "skipped";
      content?: {
        title: string;
        description: string;
        seoScore: number;
        keywords: string[];
        warnings: string[];
        notes: string[];
        generatedBy?: ChannelSeoGeneratedBy;
        model?: string | null;
      };
      error?: string;
    }>;
    jobId: number;
  };
  error?: string;
};

type DraftRecord = ChannelSeoContent & {
  localScore?: number | null;
  fallbackReason?: string | null;
};

const CHANNEL_OPTIONS: ChannelSeoChannelOption[] = listChannelSeoOptions();
const DEFAULT_CHANNEL: SalesChannel = "my_website";
const DEFAULT_PAGE_SIZE = 25;
const BULK_CHUNK_SIZE = 20;

function createEmptyContent(productId: string, channel: SalesChannel): DraftRecord {
  return {
    productId,
    channel,
    title: "",
    description: "",
    status: "not_optimized",
    seoScore: null,
    warnings: null,
    notes: null,
    keywords: null,
    generatedBy: "manual",
    model: null,
    optimizedAt: null,
    localScore: null,
  };
}

function buildContentFromServer(productId: string, channel: SalesChannel, content: ChannelSeoContent | null): DraftRecord {
  if (!content) {
    return createEmptyContent(productId, channel);
  }

  return {
    ...content,
    productId: content.productId || productId,
    channel,
    title: content.title,
    description: content.description,
    status: content.status,
    seoScore: content.seoScore ?? null,
    warnings: content.warnings ?? null,
    notes: content.notes ?? null,
    keywords: content.keywords ?? null,
    generatedBy: content.generatedBy ?? "manual",
    model: content.model ?? null,
    optimizedAt: content.optimizedAt ?? null,
    localScore: content.seoScore ?? null,
  };
}

function groupByChannel(productIds: string[], getChannel: (productId: string) => SalesChannel) {
  const map = new Map<SalesChannel, string[]>();
  for (const productId of productIds) {
    const channel = getChannel(productId);
    const items = map.get(channel) ?? [];
    items.push(productId);
    map.set(channel, items);
  }
  return map;
}

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function buildApiErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function createContentFromOptimizeResponse(
  productId: string,
  channel: SalesChannel,
  data: NonNullable<ApiOptimizeResponse["data"]>
): DraftRecord {
  return {
    ...createChannelSeoContentRecord({
      productId,
      channel,
      output: {
        title: data.title,
        description: data.description,
        seoScore: data.seoScore,
        keywords: data.keywords,
        warnings: data.warnings,
        notes: data.notes,
      },
      generatedBy: data.generatedBy,
      model: data.model,
      status: "draft",
      optimizedAt: data.optimizedAt,
    }),
    localScore: data.localScore ?? data.seoScore,
  } as DraftRecord;
}

export function ChannelSeoCenterPage() {
  const [items, setItems] = useState<ChannelSeoProductWithContents[]>([]);
  const [pagination, setPagination] = useState<ChannelSeoPagination>({ page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0 });
  const [categories, setCategories] = useState<ChannelSeoCategoryOption[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<SalesChannel>(DEFAULT_CHANNEL);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<ChannelSeoStatus | "all">("all");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [channelByProduct, setChannelByProduct] = useState<Record<string, SalesChannel>>({});
  const [drafts, setDrafts] = useState<Record<string, DraftRecord>>({});
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingOptimizeKeys, setLoadingOptimizeKeys] = useState<Record<string, boolean>>({});
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const [bulkProgress, setBulkProgress] = useState<{
    open: boolean;
    title: string;
    current: number;
    total: number;
    success: number;
    error: number;
    skipped: number;
  }>({
    open: false,
    title: "",
    current: 0,
    total: 0,
    success: 0,
    error: 0,
    skipped: 0,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    async function loadProducts() {
      setLoading(true);
      setErrorMessage(null);

      const params = new URLSearchParams({
        channel: selectedChannel,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (debouncedQuery) {
        params.set("q", debouncedQuery);
      }
      if (category) {
        params.set("category", category);
      }
      if (status !== "all") {
        params.set("status", status);
      }

      try {
        const response = await fetch(`/api/channel-seo/products?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await readJson<ApiListResponse>(response)) ?? { ok: false, error: "Yanıt alınamadı." };

        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error ?? "Ürünler alınamadı.");
        }

        if (ignore) {
          return;
        }

        setItems(payload.data.items);
        setPagination(payload.data.pagination);
        setCategories(payload.data.facets?.categories ?? []);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        if (!ignore) {
          setErrorMessage(buildApiErrorMessage(loadError, "Ürünler yüklenemedi."));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [category, debouncedQuery, page, pageSize, reloadTick, selectedChannel, status]);

  useEffect(() => {
    if (activeProductId && !items.some((item) => String(item.product.id) === activeProductId)) {
      setActiveProductId(null);
    }
  }, [activeProductId, items]);

  useEffect(() => {
    setSelectedIds([]);
    setActiveProductId(null);
  }, [category, debouncedQuery, page, pageSize, selectedChannel, status]);

  const reloadCurrentPage = useCallback(() => {
    setReloadTick((value) => value + 1);
  }, []);

  const optimizeSingleProduct = useCallback(
    async (product: ChannelSeoProduct, channel: SalesChannel, allowFallback = false) => {
      const key = `${product.id}:${channel}`;
      setLoadingOptimizeKeys((current) => ({ ...current, [key]: true }));
      setErrorMessage(null);

      try {
        const payload = {
          productId: product.id,
          channel,
          overwriteExisting: true,
          userInstructions: null,
        };
        const response = await fetch("/api/channel-seo/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = (await readJson<ApiOptimizeResponse>(response)) ?? { ok: false, error: "Yanıt alınamadı." };

        if (!response.ok || !result.ok || !result.data) {
          if (result.data && allowFallback) {
            const fallback = createContentFromOptimizeResponse(product.id, channel, result.data);
            setDrafts((current) => ({
              ...current,
              [key]: {
                ...fallback,
                fallbackReason: result.error ?? "Yapay zeka çıktısı beklenen formatta alınamadı, tekrar deneyin.",
              },
            }));
            return;
          }

          throw new Error(result.error ?? "SEO içeriği üretilemedi.");
        }

        const record = createContentFromOptimizeResponse(product.id, channel, result.data);
        setDrafts((current) => ({
          ...current,
          [key]: {
            ...record,
            fallbackReason: null,
          },
        }));
        setActiveProductId(product.id);
      } catch (error) {
        const message = buildApiErrorMessage(error, "SEO içeriği üretilemedi.");
        setErrorMessage(message);
        setDrafts((current) => ({
          ...current,
          [key]: {
            ...(current[key] ?? createEmptyContent(product.id, channel)),
            fallbackReason: message,
          },
        }));
      } finally {
        setLoadingOptimizeKeys((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }
    },
    []
  );

  const saveSingleProduct = useCallback(
    async (product: ChannelSeoProduct, channel: SalesChannel) => {
      const key = `${product.id}:${channel}`;
      const draft =
        drafts[key] ??
        buildContentFromServer(product.id, channel, items.find((item) => String(item.product.id) === product.id)?.contents[channel] ?? null);
      if (!draft.title.trim() || !draft.description.trim()) {
        setErrorMessage("Başlık ve açıklama boş kaydedilemez.");
        return;
      }

      setSavingKeys((current) => ({ ...current, [key]: true }));
      setErrorMessage(null);

      try {
        const payload = {
          items: [
            {
              productId: product.id,
              channel,
              title: draft.title,
              description: draft.description,
              status: draft.generatedBy === "gemini" ? "optimized" : draft.status,
              seoScore: draft.seoScore ?? draft.localScore ?? null,
              keywords: draft.keywords ?? null,
              warnings: draft.warnings ?? null,
              notes: draft.notes ?? null,
              generatedBy: draft.generatedBy ?? "manual",
              model: draft.model ?? null,
              optimizedAt: draft.generatedBy === "gemini" ? new Date().toISOString() : draft.optimizedAt ?? null,
            },
          ],
        };

        const response = await fetch("/api/channel-seo/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result =
          (await readJson<{ ok: boolean; data?: { saved: ChannelSeoContent[] }; error?: string }>(response)) ?? { ok: false, error: "Yanıt alınamadı." };

        if (!response.ok || !result.ok || !result.data) {
          throw new Error(result.error ?? "Kayıt işlemi tamamlanamadı.");
        }

        setDrafts((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        await reloadCurrentPage();
      } catch (error) {
        const message = buildApiErrorMessage(error, "Kayıt işlemi tamamlanamadı.");
        setErrorMessage(message);
        setDrafts((current) => ({
          ...current,
          [key]: {
            ...(current[key] ?? createEmptyContent(product.id, channel)),
            fallbackReason: message,
          },
        }));
      } finally {
        setSavingKeys((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }
    },
    [drafts, items, reloadCurrentPage]
  );

  const rows = useMemo<ChannelSeoProductRowModel[]>(() => {
    return items.map((item) => {
      const productId = item.product.id;
      const activeChannel = channelByProduct[productId] ?? selectedChannel;
      const key = `${productId}:${activeChannel}`;
      const serverContent = item.contents[activeChannel];
      const draft = drafts[key];
      const content = draft ?? buildContentFromServer(productId, activeChannel, serverContent);
      const qualityWarnings = buildChannelSeoQualityWarnings(item.product);
      const selected = selectedIds.includes(productId);
      const localScore = content.localScore ?? calculateChannelSeoLocalScore({
        product: item.product,
        channel: activeChannel,
        title: content.title,
        description: content.description,
        keywords: content.keywords ?? undefined,
        forbiddenWords: undefined,
      });

      return {
        product: item.product,
        content,
        activeChannel,
        activeChannelLabel: CHANNEL_OPTIONS.find((option) => option.id === activeChannel)?.label ?? activeChannel,
        selected,
        dirty: Boolean(drafts[key]),
        localScore,
        qualityWarnings,
        rowError: drafts[key]?.fallbackReason ?? null,
        loadingOptimize: Boolean(loadingOptimizeKeys[key]),
        loadingSave: Boolean(savingKeys[key]),
        onToggleSelect: () => {
          setSelectedIds((current) =>
            current.includes(productId) ? current.filter((value) => value !== productId) : [...current, productId]
          );
        },
        onChannelChange: (channel) => {
          setChannelByProduct((current) => ({ ...current, [productId]: channel }));
        },
        onTitleChange: (value) => {
          setDrafts((current) => {
            const existing = current[key] ?? buildContentFromServer(productId, activeChannel, serverContent);
            return {
              ...current,
              [key]: {
                ...existing,
                title: value,
                status: existing.status === "optimized" ? "needs_update" : "draft",
                generatedBy: existing.generatedBy === "gemini" ? "gemini" : "manual",
                fallbackReason: null,
                localScore: calculateChannelSeoLocalScore({
                  product: item.product,
                  channel: activeChannel,
                  title: value,
                  description: existing.description,
                  keywords: existing.keywords ?? undefined,
                  forbiddenWords: undefined,
                }),
              },
            };
          });
        },
        onDescriptionChange: (value) => {
          setDrafts((current) => {
            const existing = current[key] ?? buildContentFromServer(productId, activeChannel, serverContent);
            return {
              ...current,
              [key]: {
                ...existing,
                description: value,
                status: existing.status === "optimized" ? "needs_update" : "draft",
                generatedBy: existing.generatedBy === "gemini" ? "gemini" : "manual",
                fallbackReason: null,
                localScore: calculateChannelSeoLocalScore({
                  product: item.product,
                  channel: activeChannel,
                  title: existing.title,
                  description: value,
                  keywords: existing.keywords ?? undefined,
                  forbiddenWords: undefined,
                }),
              },
            };
          });
        },
        onOptimize: () => {
          void optimizeSingleProduct(item.product, activeChannel);
        },
        onSave: () => {
          void saveSingleProduct(item.product, activeChannel);
        },
        onPreview: () => {
          setActiveProductId(productId);
        },
        onRevert: () => {
          setDrafts((current) => {
            const next = { ...current };
            delete next[key];
            return next;
          });
        },
        onRetry: drafts[key]?.fallbackReason ? () => void optimizeSingleProduct(item.product, activeChannel, true) : undefined,
      } satisfies ChannelSeoProductRowModel;
    });
  }, [channelByProduct, drafts, items, loadingOptimizeKeys, optimizeSingleProduct, saveSingleProduct, savingKeys, selectedChannel, selectedIds]);

  const activeRow = useMemo(() => {
    if (!activeProductId) {
      return null;
    }

    const item = items.find((entry) => String(entry.product.id) === activeProductId);
    if (!item) {
      return null;
    }

    const productId = item.product.id;
    const activeChannel = channelByProduct[productId] ?? selectedChannel;
    const key = `${productId}:${activeChannel}`;
    const serverContent = item.contents[activeChannel];
    const draft = drafts[key];
    const content = draft ?? buildContentFromServer(productId, activeChannel, serverContent);
    const qualityWarnings = buildChannelSeoQualityWarnings(item.product);
    const localScore = content.localScore ?? calculateChannelSeoLocalScore({
      product: item.product,
      channel: activeChannel,
      title: content.title,
      description: content.description,
      keywords: content.keywords ?? undefined,
      forbiddenWords: undefined,
    });

    return {
      product: item.product,
      content,
      activeChannel,
      activeChannelLabel: CHANNEL_OPTIONS.find((option) => option.id === activeChannel)?.label ?? activeChannel,
      dirty: Boolean(drafts[key]),
      localScore,
      qualityWarnings,
      rowError: drafts[key]?.fallbackReason ?? null,
      optimizing: Boolean(loadingOptimizeKeys[key]),
      saving: Boolean(savingKeys[key]),
      onChannelChange: (channel: SalesChannel) => {
        setChannelByProduct((current) => ({ ...current, [productId]: channel }));
      },
      onTitleChange: (value: string) => {
        setDrafts((current) => {
          const existing = current[key] ?? buildContentFromServer(productId, activeChannel, serverContent);
          return {
            ...current,
            [key]: {
              ...existing,
              title: value,
              status: existing.status === "optimized" ? "needs_update" : "draft",
              generatedBy: existing.generatedBy === "gemini" ? "gemini" : "manual",
              fallbackReason: null,
              localScore: calculateChannelSeoLocalScore({
                product: item.product,
                channel: activeChannel,
                title: value,
                description: existing.description,
                keywords: existing.keywords ?? undefined,
                forbiddenWords: undefined,
              }),
            },
          };
        });
      },
      onDescriptionChange: (value: string) => {
        setDrafts((current) => {
          const existing = current[key] ?? buildContentFromServer(productId, activeChannel, serverContent);
          return {
            ...current,
            [key]: {
              ...existing,
              description: value,
              status: existing.status === "optimized" ? "needs_update" : "draft",
              generatedBy: existing.generatedBy === "gemini" ? "gemini" : "manual",
              fallbackReason: null,
              localScore: calculateChannelSeoLocalScore({
                product: item.product,
                channel: activeChannel,
                title: existing.title,
                description: value,
                keywords: existing.keywords ?? undefined,
                forbiddenWords: undefined,
              }),
            },
          };
        });
      },
      onOptimize: () => {
        void optimizeSingleProduct(item.product, activeChannel, true);
      },
      onSave: () => {
        void saveSingleProduct(item.product, activeChannel);
      },
      onCopy: () => {
        void copyActiveContent(content);
      },
      onRevert: () => {
        setDrafts((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      },
    };
  }, [activeProductId, channelByProduct, drafts, items, loadingOptimizeKeys, optimizeSingleProduct, saveSingleProduct, selectedChannel, savingKeys]);

  const selectedCount = selectedIds.length;
  const dirtyCount = Object.keys(drafts).length;
  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / pageSize));
  const allSelected = rows.length > 0 && rows.every((row) => row.selected);
  const someSelected = rows.some((row) => row.selected);
  const hasActiveFilters = Boolean(query.trim() || category || status !== "all");

  useEffect(() => {
    if (!dirtyCount) {
      return;
    }

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirtyCount]);

  async function loadAllProductIds() {
    const collected: Array<{ productId: string; channel: SalesChannel }> = [];
    const pageSizeForScan = 50;
    let scanPage = 1;
    let total = 0;

    while (true) {
      const params = new URLSearchParams({
        channel: selectedChannel,
        page: String(scanPage),
        pageSize: String(pageSizeForScan),
      });
      if (debouncedQuery) {
        params.set("q", debouncedQuery);
      }
      if (category) {
        params.set("category", category);
      }
      if (status !== "all") {
        params.set("status", status);
      }

      const response = await fetch(`/api/channel-seo/products?${params.toString()}`, { cache: "no-store" });
      const payload = (await readJson<ApiListResponse>(response)) ?? { ok: false, error: "Yanıt alınamadı." };
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error ?? "Ürünler alınamadı.");
      }

      total = payload.data.pagination.total;
      for (const item of payload.data.items) {
        const productId = String(item.product.id);
        collected.push({ productId, channel: channelByProduct[productId] ?? selectedChannel });
      }

      if (payload.data.items.length < pageSizeForScan || collected.length >= total) {
        break;
      }

      scanPage += 1;
    }

    return collected;
  }

  async function runBulkOptimization(productIdsWithChannels: Array<{ productId: string; channel: SalesChannel }>, title: string) {
    if (productIdsWithChannels.length === 0) {
      return;
    }

    const channelMap = new Map(productIdsWithChannels.map((item) => [item.productId, item.channel] as const));
    const grouped = groupByChannel(Array.from(channelMap.keys()), (productId) => channelMap.get(productId) ?? selectedChannel);

    const totalProducts = productIdsWithChannels.length;
    let processed = 0;
    let success = 0;
    let errorCount = 0;
    let skipped = 0;

    setBulkProgress({
      open: true,
      title,
      current: 0,
      total: totalProducts,
      success: 0,
      error: 0,
      skipped: 0,
    });
    setErrorMessage(null);

    try {
      for (const [channel, ids] of grouped.entries()) {
        const chunks = chunkArray(ids, BULK_CHUNK_SIZE);
        for (const chunk of chunks) {
          const response = await fetch("/api/channel-seo/bulk-optimize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productIds: chunk,
              channels: [channel],
              overwriteExisting: true,
              tone: "professional",
              userInstructions: null,
            }),
          });
          const payload = (await readJson<ApiBulkResponse>(response)) ?? { ok: false, error: "Yanıt alınamadı." };

          if (!response.ok || !payload.ok || !payload.data) {
            throw new Error(payload.error ?? "Toplu optimizasyon tamamlanamadı.");
          }

          processed += chunk.length;
          success += payload.data.summary.success;
          errorCount += payload.data.summary.error;
          skipped += payload.data.summary.skipped;
          setBulkProgress({
            open: true,
            title,
            current: processed,
            total: totalProducts,
            success,
            error: errorCount,
            skipped,
          });

          payload.data.items.forEach((item) => {
            const key = `${item.productId}:${item.channel}`;
            if (item.status === "skipped") {
              return;
            }

            if (item.content) {
              const record = {
                ...createChannelSeoContentRecord({
                productId: item.productId,
                channel: item.channel,
                output: {
                  title: item.content.title,
                  description: item.content.description,
                  seoScore: item.content.seoScore,
                  keywords: item.content.keywords,
                  warnings: item.content.warnings,
                  notes: item.content.notes,
                },
                generatedBy: item.content.generatedBy ?? "manual",
                model: item.content.model ?? null,
                status: "draft",
                optimizedAt: new Date().toISOString(),
                }),
                localScore: item.content.seoScore,
              } as DraftRecord;
              setDrafts((current) => ({
                ...current,
                [key]: {
                  ...record,
                  fallbackReason: item.status === "error" ? item.error ?? "İşlem sırasında hata oluştu." : null,
                },
              }));
            } else if (item.error) {
              setDrafts((current) => ({
                ...current,
                [key]: {
                  ...(current[key] ?? createEmptyContent(item.productId, item.channel)),
                  fallbackReason: item.error ?? "İşlem sırasında hata oluştu.",
                },
              }));
            }
          });
        }
      }
    } catch (error) {
      const message = buildApiErrorMessage(error, "Toplu optimizasyon tamamlanamadı.");
      setErrorMessage(message);
      setBulkProgress((current) => ({
        ...current,
        title: `${title} - tamamlanamadı`,
      }));
      return;
    }

    setBulkProgress((current) => ({
      ...current,
      current: totalProducts,
      success,
      error: errorCount,
      skipped,
    }));
  }

  async function handleOptimizeSelected() {
    const productIds = rows.filter((row) => row.selected).map((row) => ({ productId: row.product.id, channel: row.activeChannel }));
    await runBulkOptimization(productIds, "Seçilen ürünler optimize ediliyor");
  }

  async function handleOptimizeAll() {
    const allIds = await loadAllProductIds();
    await runBulkOptimization(allIds, "Filtrelenen tüm ürünler optimize ediliyor");
  }

  async function handleSaveSelected() {
    const selectedRows = rows.filter((row) => row.selected);
    if (selectedRows.length === 0) {
      return;
    }

    setErrorMessage(null);
    const payloadItems = selectedRows.map((row) => {
      const key = `${row.product.id}:${row.activeChannel}`;
      const draft = drafts[key] ?? buildContentFromServer(row.product.id, row.activeChannel, items.find((item) => String(item.product.id) === row.product.id)?.contents[row.activeChannel] ?? null);

      return {
        productId: row.product.id,
        channel: row.activeChannel,
        title: draft.title,
        description: draft.description,
        status: draft.generatedBy === "gemini" ? "optimized" : draft.status,
        seoScore: draft.seoScore ?? draft.localScore ?? null,
        keywords: draft.keywords ?? null,
        warnings: draft.warnings ?? null,
        notes: draft.notes ?? null,
        generatedBy: draft.generatedBy ?? "manual",
        model: draft.model ?? null,
        optimizedAt: draft.generatedBy === "gemini" ? new Date().toISOString() : draft.optimizedAt ?? null,
      };
    });

    if (payloadItems.some((item) => !item.title.trim() || !item.description.trim())) {
      setErrorMessage("Başlık ve açıklama boş kaydedilemez.");
      return;
    }

    try {
      const response = await fetch("/api/channel-seo/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payloadItems }),
      });
      const result = (await readJson<{ ok: boolean; data?: { saved: ChannelSeoContent[] }; error?: string; details?: Record<string, string[]> }>(response)) ?? {
        ok: false,
        error: "Yanıt alınamadı.",
      };

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.error ?? "Kayıt işlemi tamamlanamadı.");
      }

      setDrafts((current) => {
        const next = { ...current };
        for (const row of selectedRows) {
          delete next[`${row.product.id}:${row.activeChannel}`];
        }
        return next;
      });
      await reloadCurrentPage();
    } catch (error) {
      const message = buildApiErrorMessage(error, "Kayıt işlemi tamamlanamadı.");
      setErrorMessage(message);
    }
  }

  function clearChanges() {
    setDrafts({});
    setSelectedIds([]);
    setErrorMessage(null);
    setActiveProductId(null);
  }

  async function copyActiveContent(content: ChannelSeoContent) {
    const text = [content.title, content.description].filter((item) => item.trim().length > 0).join("\n\n");
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Silent fallback.
    }
  }

  const activeRowProduct = activeRow ? items.find((entry) => String(entry.product.id) === activeProductId)?.product ?? null : null;
  const activeRowContent = activeRow?.content ?? null;

  return (
    <div className="page-shell space-y-4">
      <ChannelSeoToolbar
        title="SEO"
        description="Veri merkezindeki ürünleri satış kanallarına göre optimize et."
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={(value) => {
          setCategory(value);
          setPage(1);
        }}
        status={status}
        onStatusChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
        selectedChannel={selectedChannel}
        onChannelChange={(value) => {
          setSelectedChannel(value);
          setPage(1);
        }}
        pageSize={pageSize}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
        categories={categories}
        channels={CHANNEL_OPTIONS}
        selectedCount={selectedCount}
        dirtyCount={dirtyCount}
        totalCount={pagination.total}
        loading={loading}
      />

      <ChannelSeoBulkActions
        selectedCount={selectedCount}
        dirtyCount={dirtyCount}
        totalCount={pagination.total}
        onOptimizeSelected={() => void handleOptimizeSelected()}
        onOptimizeAll={() => void handleOptimizeAll()}
        onSaveSelected={() => void handleSaveSelected()}
        onClear={clearChanges}
        optimizeDisabled={loading || items.length === 0}
        saveDisabled={loading || dirtyCount === 0}
      />

      {errorMessage ? <ChannelSeoErrorPanel message={errorMessage} onRetry={() => void reloadCurrentPage()} /> : null}

      <div className={`grid gap-4 ${activeRowProduct && activeRowContent && activeRow ? "lg:grid-cols-[minmax(0,1fr)_420px]" : "lg:grid-cols-1"}`}>
        <div className="min-w-0 space-y-4">
          {loading && items.length === 0 ? (
            <ChannelSeoLoadingState />
          ) : pagination.total === 0 && !hasActiveFilters ? (
            <ChannelSeoEmptyState
              title="Henüz optimize edilmiş içerik yok"
              description="İlk ürünleri optimize ederek SEO başlıklarını ve açıklamalarını oluşturabilirsiniz."
              action={
                <Link
                  href="/veri-merkezi"
                  className="inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary transition-colors duration-200 hover:bg-primary/15"
                >
                  Veri Merkezine Git
                </Link>
              }
            />
          ) : items.length === 0 ? (
            <ChannelSeoEmptyState
              title="Aranan kriterlere uygun ürün bulunamadı"
              description="Filtreleri daraltmış olabilirsiniz. Aramayı veya kategori/durum seçimlerini temizleyip tekrar deneyin."
              onResetFilters={() => {
                setQuery("");
                setCategory("");
                setStatus("all");
                setPage(1);
              }}
            />
          ) : (
            <ChannelSeoProductTable
              rows={rows}
              channelOptions={CHANNEL_OPTIONS}
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              totalPages={totalPages}
              loading={loading}
              onNextPage={() => setPage((value) => Math.min(totalPages, value + 1))}
              onPreviousPage={() => setPage((value) => Math.max(1, value - 1))}
              onToggleAll={() => {
                const visibleIds = rows.map((row) => row.product.id);
                setSelectedIds((current) => {
                  const currentSet = new Set(current);
                  const allVisibleSelected = visibleIds.every((id) => currentSet.has(id));
                  if (allVisibleSelected) {
                    visibleIds.forEach((id) => currentSet.delete(id));
                  } else {
                    visibleIds.forEach((id) => currentSet.add(id));
                  }
                  return Array.from(currentSet);
                });
              }}
              allSelected={allSelected}
              someSelected={someSelected}
            />
          )}
        </div>

        {activeRowProduct && activeRowContent && activeRow ? (
          <ChannelSeoProductDrawer
            product={activeRowProduct}
            content={activeRowContent}
            activeChannel={activeRow.activeChannel}
            activeChannelLabel={activeRow.activeChannelLabel ?? CHANNEL_OPTIONS.find((option) => option.id === selectedChannel)?.label ?? selectedChannel}
            channelOptions={CHANNEL_OPTIONS}
            dirty={activeRow.dirty}
            localScore={activeRow.localScore ?? null}
            qualityWarnings={activeRow.qualityWarnings}
            rowError={activeRow.rowError ?? null}
            optimizing={activeRow.optimizing ?? false}
            saving={activeRow.saving ?? false}
            onClose={() => setActiveProductId(null)}
            onChannelChange={(channel) => {
              setChannelByProduct((current) => ({ ...current, [activeRowProduct.id]: channel }));
            }}
            onTitleChange={(value) => {
              activeRow.onTitleChange(value);
            }}
            onDescriptionChange={(value) => {
              activeRow.onDescriptionChange(value);
            }}
            onOptimize={() => {
              void optimizeSingleProduct(activeRowProduct, activeRow.activeChannel, true);
            }}
            onSave={() => {
              void saveSingleProduct(activeRowProduct, activeRow.activeChannel);
            }}
            onCopy={() => {
              void copyActiveContent(activeRowContent);
            }}
            onRevert={() => {
              const key = `${activeRowProduct.id}:${activeRow.activeChannel}`;
              setDrafts((current) => {
                const next = { ...current };
                delete next[key];
                return next;
              });
            }}
          />
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-2 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <ChannelSeoStatusBadge status="not_optimized" />
          <ChannelSeoStatusBadge status="draft" />
          <ChannelSeoStatusBadge status="optimized" />
          <ChannelSeoStatusBadge status="needs_update" />
          <ChannelSeoStatusBadge status="error" />
        </div>
        <p>
          Gemini üretimi sunucu tarafında çalışır. Kaydedilmemiş değişiklikler sayfa kapatılırsa kaybolabilir.
        </p>
      </div>

      <ChannelSeoProgressModal
        open={bulkProgress.open}
        title={bulkProgress.title}
        current={bulkProgress.current}
        total={bulkProgress.total}
        success={bulkProgress.success}
        error={bulkProgress.error}
        skipped={bulkProgress.skipped}
        onClose={() => setBulkProgress((current) => ({ ...current, open: false }))}
      />
    </div>
  );
}
