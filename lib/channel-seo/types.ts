export type SalesChannel =
  | "trendyol"
  | "hepsiburada"
  | "my_website";

export type ChannelSeoStatus =
  | "not_optimized"
  | "draft"
  | "optimized"
  | "needs_update"
  | "error";

export type ChannelSeoTone = "professional" | "friendly" | "premium" | "persuasive" | "simple";

export type ChannelSeoGeneratedBy = "manual" | "gemini" | "fallback";

export type ChannelSeoProduct = {
  id: string;
  name: string;
  category?: string | null;
  brand?: string | null;
  sku?: string | null;
  barcode?: string | null;
  imageUrl?: string | null;
  baseDescription?: string | null;
  features?: string[] | null;
  attributes?: Record<string, string | number | boolean | null> | null;
  price?: number | null;
  stock?: number | null;
  variants?: string[] | null;
};

export type ChannelSeoContent = {
  id?: string;
  productId: string;
  channel: SalesChannel;
  title: string;
  description: string;
  status: ChannelSeoStatus;
  seoScore?: number | null;
  warnings?: string[] | null;
  notes?: string[] | null;
  keywords?: string[] | null;
  generatedBy?: ChannelSeoGeneratedBy;
  model?: string | null;
  createdAt?: string;
  updatedAt?: string;
  optimizedAt?: string | null;
};

export type ChannelSeoOptimizationInput = {
  product: ChannelSeoProduct;
  channel: SalesChannel;
  existingTitle?: string | null;
  existingDescription?: string | null;
  userInstructions?: string | null;
  tone?: ChannelSeoTone;
  keywords?: string[];
  forbiddenWords?: string[];
};

export type ChannelSeoOptimizationOutput = {
  title: string;
  description: string;
  seoScore: number;
  keywords: string[];
  warnings: string[];
  notes: string[];
};

export type ChannelSeoBulkRequest = {
  productIds: string[];
  channels: SalesChannel[];
  overwriteExisting: boolean;
  userInstructions?: string | null;
  tone?: ChannelSeoTone;
};

export type ChannelSeoBulkResultItem = {
  productId: string;
  channel: SalesChannel;
  status: "success" | "error" | "skipped";
  content?: ChannelSeoOptimizationOutput & {
    generatedBy?: ChannelSeoGeneratedBy;
    model?: string | null;
  };
  error?: string;
};

export type ChannelSeoPagination = {
  page: number;
  pageSize: number;
  total: number;
};

export type ChannelSeoProductWithContents = {
  product: ChannelSeoProduct;
  contents: Record<SalesChannel, ChannelSeoContent | null>;
};

export type ChannelSeoProductListFilters = {
  q?: string;
  category?: string;
  channel: SalesChannel;
  status?: ChannelSeoStatus;
  page: number;
  pageSize: number;
};

export type ChannelSeoProductDetail = {
  product: ChannelSeoProduct;
  contents: Record<SalesChannel, ChannelSeoContent | null>;
};
