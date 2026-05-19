import { getDb } from "@/lib/db";
import { serverError, ok } from "@/lib/api-helpers";

export async function GET() {
  try {
    const db = getDb();
    if (!db) return serverError();

    // Recent audits
    const audits = db.prepare(`
      SELECT id, audit_type, target_type, target_label, status, overall_score,
             critical_issues_count, warning_issues_count, opportunities_count,
             missing_meta_count, schema_status, created_at
      FROM seo_audits
      ORDER BY created_at DESC
      LIMIT 20
    `).all();

    // Keyword stats
    const keywordStats = db.prepare(`
      SELECT COUNT(*) as total,
             AVG(volume) as avgVolume,
             AVG(difficulty) as avgDifficulty,
             AVG(opportunity_score) as avgOpportunity
      FROM seo_keyword_research
    `).get() as { total: number; avgVolume: number; avgDifficulty: number; avgOpportunity: number };

    // Recommendation summary
    const recSummary = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM seo_ai_recommendations
      GROUP BY status
    `).all() as Array<{ status: string; count: number }>;

    // Products available for SEO generation
    const products = db.prepare(`
      SELECT product_id AS id, name, sku
      FROM products
      WHERE status = 'active'
      ORDER BY name
      LIMIT 100
    `).all();

    return ok({
      audits,
      keywordStats,
      recSummary,
      products,
    });
  } catch (error) {
    console.error("SEO API error:", error);
    return serverError();
  }
}
