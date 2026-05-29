import { getDb } from "@/lib/db";
import { getProducts } from "@/lib/database-readers";
import { ok, serverError } from "@/lib/api-helpers";

type KeywordStatsRow = {
  total: number;
  avgVolume: number;
  avgDifficulty: number;
  avgOpportunity: number;
};

function emptyKeywordStats(): KeywordStatsRow {
  return { total: 0, avgVolume: 0, avgDifficulty: 0, avgOpportunity: 0 };
}

function tableQuery<T>(db: ReturnType<typeof getDb>, sql: string, fallback: T) {
  if (!db) return fallback;
  try {
    return db.prepare(sql).all() as T;
  } catch {
    return fallback;
  }
}

function tableGet<T>(db: ReturnType<typeof getDb>, sql: string, fallback: T) {
  if (!db) return fallback;
  try {
    return (db.prepare(sql).get() as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    const db = getDb();
    if (!db) {
      return ok({
        audits: [],
        keywordStats: emptyKeywordStats(),
        recSummary: [],
        products: getProducts().map((product) => ({ id: product.id, name: product.name, sku: product.sku ?? "" })),
      });
    }

    const audits = tableQuery(
      db,
      `
      SELECT id, audit_type, target_type, target_label, status, overall_score,
             critical_issues_count, warning_issues_count, opportunities_count,
             missing_meta_count, schema_status, created_at
      FROM seo_audits
      ORDER BY created_at DESC
      LIMIT 20
    `,
      []
    );

    const keywordStats = tableGet<KeywordStatsRow>(
      db,
      `
      SELECT COUNT(*) as total,
             AVG(volume) as avgVolume,
             AVG(difficulty) as avgDifficulty,
             AVG(opportunity_score) as avgOpportunity
      FROM seo_keyword_research
    `,
      emptyKeywordStats()
    );

    const recSummary = tableQuery<Array<{ status: string; count: number }>>(
      db,
      `
      SELECT status, COUNT(*) as count
      FROM seo_ai_recommendations
      GROUP BY status
    `,
      []
    );

    const products = getProducts().map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku ?? "",
    }));

    return ok({
      audits,
      keywordStats,
      recSummary,
      products,
    });
  } catch (error) {
    console.error("SEO API error:", error);
    return ok({
      audits: [],
      keywordStats: emptyKeywordStats(),
      recSummary: [],
      products: getProducts().map((product) => ({ id: product.id, name: product.name, sku: product.sku ?? "" })),
    });
  }
}
