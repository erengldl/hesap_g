import { getDb } from "@/lib/db";
import { getChannelRule, listChannelSeoOptions } from "./channel-rules";
import type {
  ChannelSeoContent,
  ChannelSeoPagination,
  ChannelSeoProductDetail,
  ChannelSeoProductListFilters,
  ChannelSeoProductWithContents,
  SalesChannel,
  ChannelSeoProduct,
} from "./types";

type ProductRow = {
  product_id: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  category_name: string | null;
  category_path: string | null;
  description: string | null;
  cost: number | null;
  sale_price: number | null;
  stock_qty: number | null;
};

type ChannelSeoContentRow = {
  id: number;
  product_id: number;
  channel: string;
  title: string;
  description: string;
  status: string;
  seo_score: number | null;
  warnings_json: string | null;
  notes_json: string | null;
  keywords_json: string | null;
  generated_by: string | null;
  model: string | null;
  created_at: string | null;
  updated_at: string | null;
  optimized_at: string | null;
};

type ProductQueryRow = ProductRow & {
  channel_status: string | null;
  channel_title: string | null;
  channel_description: string | null;
  channel_content_id: number | null;
  channel_generated_by: string | null;
  channel_model: string | null;
  channel_seo_score: number | null;
  channel_warnings_json: string | null;
  channel_notes_json: string | null;
  channel_keywords_json: string | null;
  channel_created_at: string | null;
  channel_updated_at: string | null;
  channel_optimized_at: string | null;
};

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new Error("SQLite veritabanına bağlanılamadı.");
  }
  return db;
}

function normalizeText(value: string | null | undefined) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function readStringArray(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    const items = parsed.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter((item) => item.length > 0);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

function buildContentMap() {
  const map: Record<SalesChannel, ChannelSeoContent | null> = {
    trendyol: null,
    hepsiburada: null,
    my_website: null,
  };
  return map;
}

function mapContentRow(row: ChannelSeoContentRow): ChannelSeoContent | null {
  if (!row.channel || !row.title || !row.description) {
    return null;
  }

  const channel = row.channel;
  if (channel !== "trendyol" && channel !== "hepsiburada" && channel !== "my_website") {
    return null;
  }

  return {
    id: String(row.id),
    productId: String(row.product_id),
    channel,
    title: row.title,
    description: row.description,
    status: row.status === "optimized" || row.status === "needs_update" || row.status === "error" || row.status === "not_optimized" ? row.status : "draft",
    seoScore: typeof row.seo_score === "number" ? row.seo_score : null,
    warnings: readStringArray(row.warnings_json),
    notes: readStringArray(row.notes_json),
    keywords: readStringArray(row.keywords_json),
    generatedBy: row.generated_by === "manual" || row.generated_by === "gemini" || row.generated_by === "fallback" ? row.generated_by : undefined,
    model: normalizeText(row.model),
    createdAt: normalizeText(row.created_at) ?? undefined,
    updatedAt: normalizeText(row.updated_at) ?? undefined,
    optimizedAt: normalizeText(row.optimized_at),
  };
}

function mapProductRow(row: ProductRow): ChannelSeoProduct {
  return {
    id: String(row.product_id),
    name: row.name,
    category: normalizeText(row.category_path ?? row.category_name),
    brand: null,
    sku: normalizeText(row.sku),
    barcode: normalizeText(row.barcode),
    imageUrl: normalizeText(row.image_url),
    baseDescription: normalizeText(row.description),
    features: null,
    attributes: null,
    price: typeof row.sale_price === "number" ? row.sale_price : null,
    stock: typeof row.stock_qty === "number" ? row.stock_qty : null,
    variants: null,
  };
}

function buildProductSelectSql(selectedChannel: SalesChannel, filters: ChannelSeoProductListFilters) {
  const whereClauses: string[] = [];
  const params: Array<string | number> = [];
  const q = normalizeText(filters.q)?.toLowerCase() ?? null;
  const category = normalizeText(filters.category)?.toLowerCase() ?? null;

  if (q) {
    const like = `%${q}%`;
    whereClauses.push(`(
      LOWER(COALESCE(p.name, '')) LIKE ?
      OR LOWER(COALESCE(p.sku, '')) LIKE ?
      OR LOWER(COALESCE(p.barcode, '')) LIKE ?
      OR LOWER(COALESCE(p.description, '')) LIKE ?
      OR LOWER(COALESCE(c.name, '')) LIKE ?
      OR LOWER(COALESCE(p.category_path, c.path, '')) LIKE ?
      OR LOWER(COALESCE(pc.title, '')) LIKE ?
      OR LOWER(COALESCE(pc.description, '')) LIKE ?
    )`);
    params.push(like, like, like, like, like, like, like, like);
  }

  if (category) {
    whereClauses.push(`LOWER(COALESCE(p.category_path, c.path, c.name, '')) LIKE ?`);
    params.push(`${category}%`);
  }

  if (filters.status) {
    if (filters.status === "not_optimized") {
      whereClauses.push(`COALESCE(pc.status, 'not_optimized') = 'not_optimized'`);
    } else {
      whereClauses.push(`COALESCE(pc.status, 'not_optimized') = ?`);
      params.push(filters.status);
    }
  }

  whereClauses.push(`1 = 1`);

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  return {
    where,
    params,
    selectedChannel,
  };
}

function buildProductRowSql() {
  return `
    SELECT
      p.product_id,
      p.name,
      p.sku,
      p.barcode,
      p.image_url,
      c.name AS category_name,
      COALESCE(p.category_path, c.path, c.name) AS category_path,
      p.description,
      p.cost,
      COALESCE(
        (
          SELECT pms.sale_price
          FROM product_marketplace_settings pms
          JOIN marketplaces m ON m.marketplace_id = pms.marketplace_id
          WHERE pms.product_id = p.product_id AND m.slug IN ('own_website', 'website')
          ORDER BY pms.marketplace_id ASC
          LIMIT 1
        ),
        (
          SELECT pms.sale_price
          FROM product_marketplace_settings pms
          WHERE pms.product_id = p.product_id
          ORDER BY pms.marketplace_id ASC
          LIMIT 1
        )
      ) AS sale_price,
      (
        SELECT COALESCE(SUM(id.stock_qty - COALESCE(id.reserved_qty, 0)), 0)
        FROM inventory_daily id
        WHERE id.product_id = p.product_id
          AND id.inventory_date = (
            SELECT MAX(id2.inventory_date)
            FROM inventory_daily id2
            WHERE id2.product_id = p.product_id
          )
      ) AS stock_qty,
      pc.id AS channel_content_id,
      pc.title AS channel_title,
      pc.description AS channel_description,
      pc.status AS channel_status,
      pc.seo_score AS channel_seo_score,
      pc.warnings_json AS channel_warnings_json,
      pc.notes_json AS channel_notes_json,
      pc.keywords_json AS channel_keywords_json,
      pc.generated_by AS channel_generated_by,
      pc.model AS channel_model,
      pc.created_at AS channel_created_at,
      pc.updated_at AS channel_updated_at,
      pc.optimized_at AS channel_optimized_at
    FROM products p
    LEFT JOIN categories c ON c.category_id = p.category_id
    LEFT JOIN product_channel_seo_contents pc
      ON pc.product_id = CAST(p.product_id AS TEXT)
     AND pc.channel = ?
  `;
}

function getProductContentRows(db: ReturnType<typeof requireDb>, productIds: string[]) {
  if (productIds.length === 0) {
    return [] as ChannelSeoContentRow[];
  }

  const placeholders = productIds.map(() => "?").join(", ");
  return db
    .prepare(
      `
        SELECT *
        FROM product_channel_seo_contents
        WHERE product_id IN (${placeholders})
      `
    )
    .all(...productIds) as ChannelSeoContentRow[];
}

export function listChannelSeoChannels() {
  return listChannelSeoOptions();
}

export function listChannelSeoCategories() {
  const db = requireDb();
  const rows = db
    .prepare(
      `
        SELECT DISTINCT
          COALESCE(NULLIF(TRIM(COALESCE(p.category_path, c.path, c.name, '')), ''), 'Kategorisiz') AS value,
          COALESCE(NULLIF(TRIM(COALESCE(p.category_path, c.path, c.name, '')), ''), 'Kategorisiz') AS label
        FROM products p
        LEFT JOIN categories c ON c.category_id = p.category_id
        ORDER BY label ASC
      `
    )
    .all() as Array<{ value: string; label: string }>;

  return rows;
}

export function getChannelSeoProductDetail(productId: string): ChannelSeoProductDetail | null {
  const db = requireDb();
  const row = db
    .prepare(
      `
        SELECT
          p.product_id,
          p.name,
          p.sku,
          p.barcode,
          p.image_url,
          c.name AS category_name,
          COALESCE(p.category_path, c.path, c.name) AS category_path,
          p.description,
          p.cost,
          COALESCE(
            (
              SELECT pms.sale_price
              FROM product_marketplace_settings pms
              JOIN marketplaces m ON m.marketplace_id = pms.marketplace_id
              WHERE pms.product_id = p.product_id AND m.slug IN ('own_website', 'website')
              ORDER BY pms.marketplace_id ASC
              LIMIT 1
            ),
            (
              SELECT pms.sale_price
              FROM product_marketplace_settings pms
              WHERE pms.product_id = p.product_id
              ORDER BY pms.marketplace_id ASC
              LIMIT 1
            )
          ) AS sale_price,
          (
            SELECT COALESCE(SUM(id.stock_qty - COALESCE(id.reserved_qty, 0)), 0)
            FROM inventory_daily id
            WHERE id.product_id = p.product_id
              AND id.inventory_date = (
                SELECT MAX(id2.inventory_date)
                FROM inventory_daily id2
                WHERE id2.product_id = p.product_id
              )
          ) AS stock_qty
        FROM products p
        LEFT JOIN categories c ON c.category_id = p.category_id
        WHERE p.product_id = ?
        LIMIT 1
      `
    )
    .get(productId) as ProductRow | undefined;

  if (!row) {
    return null;
  }

  const contents = buildContentMap();
  const contentRows = db
    .prepare(
      `
        SELECT *
        FROM product_channel_seo_contents
        WHERE product_id = ?
        ORDER BY channel ASC
      `
    )
    .all(productId) as ChannelSeoContentRow[];

  for (const contentRow of contentRows) {
    const content = mapContentRow(contentRow);
    if (content) {
      contents[content.channel] = content;
    }
  }

  return {
    product: mapProductRow(row),
    contents,
  };
}

export function getChannelSeoProductById(productId: string) {
  return getChannelSeoProductDetail(productId);
}

export function listChannelSeoProducts(filters: ChannelSeoProductListFilters): {
  items: ChannelSeoProductWithContents[];
  pagination: ChannelSeoPagination;
} {
  const db = requireDb();
  const page = Number.isFinite(filters.page) && filters.page > 0 ? Math.floor(filters.page) : 1;
  const pageSize = Number.isFinite(filters.pageSize) && filters.pageSize > 0 ? Math.min(Math.floor(filters.pageSize), 50) : 25;
  const offset = (page - 1) * pageSize;
  const { where, params, selectedChannel } = buildProductSelectSql(filters.channel, filters);

  const countRow = db
    .prepare(
      `
        SELECT COUNT(*) AS total
        FROM products p
        LEFT JOIN categories c ON c.category_id = p.category_id
        LEFT JOIN product_channel_seo_contents pc
          ON pc.product_id = CAST(p.product_id AS TEXT)
         AND pc.channel = ?
        ${where}
      `
    )
    .get(selectedChannel, ...params) as { total: number } | undefined;

  const rows = db
    .prepare(
      `
        ${buildProductRowSql()}
        ${where}
        ORDER BY p.product_id DESC
        LIMIT ? OFFSET ?
      `
    )
    .all(selectedChannel, ...params, pageSize, offset) as ProductQueryRow[];

  const productIds = rows.map((row) => String(row.product_id));
  const contentRows = getProductContentRows(db, productIds);
  const contentMap = new Map<string, Record<SalesChannel, ChannelSeoContent | null>>();

  for (const productIdValue of productIds) {
    contentMap.set(productIdValue, buildContentMap());
  }

  for (const contentRow of contentRows) {
    const content = mapContentRow(contentRow);
    if (!content) {
      continue;
    }
    const map = contentMap.get(String(contentRow.product_id));
    if (map) {
      map[content.channel] = content;
    }
  }

  const items = rows.map((row) => {
    const contents = contentMap.get(String(row.product_id)) ?? buildContentMap();
    const selectedChannelContent = mapContentRow({
      id: row.channel_content_id ?? 0,
      product_id: row.product_id,
      channel: selectedChannel,
      title: row.channel_title ?? "",
      description: row.channel_description ?? "",
      status: row.channel_status ?? "not_optimized",
      seo_score: row.channel_seo_score,
      warnings_json: row.channel_warnings_json,
      notes_json: row.channel_notes_json,
      keywords_json: row.channel_keywords_json,
      generated_by: row.channel_generated_by,
      model: row.channel_model,
      created_at: row.channel_created_at,
      updated_at: row.channel_updated_at,
      optimized_at: row.channel_optimized_at,
    });

    if (selectedChannelContent) {
      contents[selectedChannel] = selectedChannelContent;
    }

    return {
      product: mapProductRow(row),
      contents,
    };
  });

  return {
    items,
    pagination: {
      page,
      pageSize,
      total: Number(countRow?.total ?? 0),
    },
  };
}

export function getChannelSeoContentsByProductIds(productIds: string[]) {
  const db = requireDb();
  const rows = getProductContentRows(db, productIds);
  const contents = new Map<string, Record<SalesChannel, ChannelSeoContent | null>>();

  for (const productId of productIds) {
    contents.set(productId, buildContentMap());
  }

  for (const row of rows) {
    const content = mapContentRow(row);
    if (!content) {
      continue;
    }
    const current = contents.get(String(row.product_id));
    if (current) {
      current[content.channel] = content;
    }
  }

  return contents;
}

export function getChannelSeoContent(productId: string, channel: SalesChannel): ChannelSeoContent | null {
  const db = requireDb();
  const row = db
    .prepare(
      `
        SELECT *
        FROM product_channel_seo_contents
        WHERE product_id = ? AND channel = ?
        LIMIT 1
      `
    )
    .get(productId, channel) as ChannelSeoContentRow | undefined;

  return row ? mapContentRow(row) : null;
}

export function upsertChannelSeoContents(items: ChannelSeoContent[]) {
  const db = requireDb();
  const saved: ChannelSeoContent[] = [];
  const nowIso = new Date().toISOString();
  const insertOrUpdate = db.prepare(`
    INSERT INTO product_channel_seo_contents (
      product_id,
      channel,
      title,
      description,
      status,
      seo_score,
      warnings_json,
      notes_json,
      keywords_json,
      generated_by,
      model,
      created_at,
      updated_at,
      optimized_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP, ?)
    ON CONFLICT(product_id, channel) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      status = excluded.status,
      seo_score = excluded.seo_score,
      warnings_json = excluded.warnings_json,
      notes_json = excluded.notes_json,
      keywords_json = excluded.keywords_json,
      generated_by = excluded.generated_by,
      model = excluded.model,
      updated_at = CURRENT_TIMESTAMP,
      optimized_at = COALESCE(excluded.optimized_at, product_channel_seo_contents.optimized_at)
  `);

  const productExists = db.prepare("SELECT product_id FROM products WHERE product_id = ? LIMIT 1");
  const transaction = db.transaction((records: ChannelSeoContent[]) => {
    for (const item of records) {
      const exists = productExists.get(Number(item.productId)) as { product_id: number } | undefined;
      if (!exists) {
        throw new Error(`Ürün bulunamadı: ${item.productId}`);
      }

      const optimizedAt =
        item.optimizedAt ??
        (item.status === "optimized" || item.status === "needs_update" ? nowIso : null);
      const warnings = item.warnings && item.warnings.length > 0 ? JSON.stringify(item.warnings) : null;
      const notes = item.notes && item.notes.length > 0 ? JSON.stringify(item.notes) : null;
      const keywords = item.keywords && item.keywords.length > 0 ? JSON.stringify(item.keywords) : null;

      insertOrUpdate.run(
        item.productId,
        item.channel,
        item.title,
        item.description,
        item.status,
        typeof item.seoScore === "number" ? Math.round(item.seoScore) : null,
        warnings,
        notes,
        keywords,
        item.generatedBy ?? "manual",
        item.model ?? null,
        item.createdAt ?? nowIso,
        optimizedAt
      );

      const savedRow = db
        .prepare(
          `
            SELECT *
            FROM product_channel_seo_contents
            WHERE product_id = ? AND channel = ?
            LIMIT 1
          `
        )
        .get(item.productId, item.channel) as ChannelSeoContentRow | undefined;

      if (savedRow) {
        const mapped = mapContentRow(savedRow);
        if (mapped) {
          saved.push(mapped);
        }
      }
    }
  });

  transaction(items);

  return saved;
}

export function createChannelSeoJob(input: {
  totalCount: number;
  channels: SalesChannel[];
  model?: string | null;
}) {
  const db = requireDb();
  const result = db
    .prepare(
      `
        INSERT INTO product_channel_seo_jobs (
          status,
          total_count,
          success_count,
          error_count,
          skipped_count,
          model,
          channels_json,
          created_at
        ) VALUES ('running', ?, 0, 0, 0, ?, ?, CURRENT_TIMESTAMP)
      `
    )
    .run(input.totalCount, input.model ?? null, JSON.stringify(input.channels));

  return Number(result.lastInsertRowid);
}

export function finishChannelSeoJob(jobId: number, summary: { success: number; error: number; skipped: number }) {
  const db = requireDb();
  db.prepare(
    `
      UPDATE product_channel_seo_jobs
      SET status = 'completed',
          success_count = ?,
          error_count = ?,
          skipped_count = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
  ).run(summary.success, summary.error, summary.skipped, jobId);
}

export function updateChannelSeoJob(jobId: number, summary: { success: number; error: number; skipped: number }) {
  const db = requireDb();
  db.prepare(
    `
      UPDATE product_channel_seo_jobs
      SET success_count = ?,
          error_count = ?,
          skipped_count = ?
      WHERE id = ?
    `
  ).run(summary.success, summary.error, summary.skipped, jobId);
}

export function getChannelSeoRuleForContent(channel: SalesChannel) {
  return getChannelRule(channel);
}
