import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ok } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/api-auth";

type KeywordStatsRow = {
  total: number;
  avgVolume: number;
  avgDifficulty: number;
  avgOpportunity: number;
};

function emptyKeywordStats(): KeywordStatsRow {
  return { total: 0, avgVolume: 0, avgDifficulty: 0, avgOpportunity: 0 };
}

async function tableQuery<T>(db: ReturnType<typeof getDb>, sql: string, params: Array<unknown>, fallback: T = [] as T) {
  if (!db) return fallback;
  try {
    return await db.prepare(sql).all(...params) as T;
  } catch {
    return fallback;
  }
}

async function tableGet<T>(db: ReturnType<typeof getDb>, sql: string, params: Array<unknown>, fallback: T) {
  if (!db) return fallback;
  try {
    return (await db.prepare(sql).get(...params) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const authUserId = session.authUserId?.trim() || "";
    if (!authUserId) {
      return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
    }

    const db = await getDb();
    if (!db) {
      return ok({
        audits: [],
        keywordStats: emptyKeywordStats(),
        recSummary: [],
        products: [],
      });
    }

    const audits = await tableQuery(
      db,
      `
      SELECT id, audit_type, target_type, target_label, status, overall_score,
             critical_issues_count, warning_issues_count, opportunities_count,
             missing_meta_count, schema_status, created_at
      FROM seo_audits
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `,
      [authUserId]
    );

    const keywordStats = await tableGet<KeywordStatsRow>(
      db,
      `
      SELECT COUNT(*) as total,
             AVG(volume) as avgVolume,
             AVG(difficulty) as avgDifficulty,
             AVG(opportunity_score) as avgOpportunity
      FROM seo_keyword_research
      WHERE user_id = ?
    `,
      [authUserId],
      emptyKeywordStats()
    );

    const recSummary = await tableQuery<Array<{ status: string; count: number }>>(
      db,
      `
      SELECT status, COUNT(*) as count
      FROM seo_ai_recommendations
      WHERE user_id = ?
      GROUP BY status
    `,
      [authUserId]
    );

    const products = await tableQuery<Array<{ id: number; name: string; sku: string | null }>>(
      db,
      `
      SELECT product_id AS id, name, sku
      FROM products
      WHERE user_id = ?
      ORDER BY product_id DESC
    `,
      [authUserId]
    );

    return ok({
      audits,
      keywordStats,
      recSummary,
      products: products.map((product) => ({ id: product.id, name: product.name, sku: product.sku ?? "" })),
    });
  } catch (error) {
    console.error("SEO API error:", error);
    return ok({
      audits: [],
      keywordStats: emptyKeywordStats(),
      recSummary: [],
      products: [],
    });
  }
}
