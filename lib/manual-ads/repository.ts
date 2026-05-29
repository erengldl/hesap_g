import { randomUUID } from "crypto";

import { getDb } from "@/lib/db";

import {
  buildManualAdAssistantReply,
  buildManualAdConversationState,
  buildManualAdSeedReply,
  createInitialManualAdConversationState,
} from "./conversation";
import { calculateManualAdMetrics, getManualAdCampaignDays } from "./metrics";
import { generateManualAdReport, type ManualAdGeneratedReport } from "./report-generator";
import { validateManualAdCampaignInput } from "./validation";
import type {
  ManualAdCampaign,
  ManualAdCampaignDetail,
  ManualAdCampaignInput,
  ManualAdCampaignSummary,
  ManualAdChatMessage,
  ManualAdConversationState,
  ManualAdMessageMetadata,
  ManualAdMetrics,
  ManualAdReport,
  ManualAdReportAnalysis,
  ManualAdReportRecommendations,
  ManualAdDecision,
} from "./types";
import { MANUAL_AD_CREATIVE_FORMAT_LABELS } from "./types";
import { evaluateManualAdDecision } from "./decision-engine";

type ManualAdCampaignRow = {
  id: string;
  user_id: number;
  name: string;
  platform: string;
  start_date: string;
  end_date: string;
  total_spend: number;
  orders_from_ads: number;
  revenue_from_ads: number | null;
  product_name: string | null;
  product_sale_price: number | null;
  estimated_product_cost: number | null;
  estimated_product_profit: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ManualAdMessageRow = {
  id: string;
  campaign_id: string;
  role: "user" | "assistant";
  content: string;
  metadata_json: string | null;
  created_at: string;
};

type ManualAdReportRow = {
  id: string;
  campaign_id: string;
  decision: ManualAdDecision;
  score: number;
  summary: string;
  metrics_json: string;
  conversation_state_json: string;
  analysis_json: string;
  recommendations_json: string;
  created_at: string;
};

type CampaignSummaryRow = ManualAdCampaignRow & {
  message_count: number;
  report_count: number;
  latest_report_id: string | null;
  latest_decision: ManualAdDecision | null;
  latest_score: number | null;
  latest_summary: string | null;
  latest_report_created_at: string | null;
};

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new Error("SQLite veritabanına bağlanılamadı.");
  }
  return db;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function toJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function buildSeedLandingAnswer(input: ManualAdCampaignInput) {
  const parts: string[] = [];

  if (input.productName) {
    parts.push(`Ürün: ${input.productName}`);
  }

  if (typeof input.productSalePrice === "number" && Number.isFinite(input.productSalePrice)) {
    parts.push(`Fiyat: ${input.productSalePrice} TL`);
  }

  if (typeof input.estimatedProductProfit === "number" && Number.isFinite(input.estimatedProductProfit)) {
    parts.push(`Kâr: ${input.estimatedProductProfit} TL`);
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

function mapCampaign(row: ManualAdCampaignRow): ManualAdCampaign {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform as ManualAdCampaign["platform"],
    startDate: row.start_date,
    endDate: row.end_date,
    totalSpend: row.total_spend,
    ordersFromAds: row.orders_from_ads,
    revenueFromAds: row.revenue_from_ads,
    productName: row.product_name,
    productSalePrice: row.product_sale_price,
    estimatedProductCost: row.estimated_product_cost,
    estimatedProductProfit: row.estimated_product_profit,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: ManualAdMessageRow): ManualAdChatMessage {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    role: row.role,
    content: row.content,
    metadata: parseJson<ManualAdMessageMetadata>(row.metadata_json),
    createdAt: row.created_at,
  };
}

function mapReport(row: ManualAdReportRow): ManualAdReport {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    decision: row.decision,
    score: row.score,
    summary: row.summary,
    metrics: parseJson<ManualAdMetrics>(row.metrics_json) ?? calculateManualAdMetrics({
      id: row.campaign_id,
      name: "",
      platform: "other",
      startDate: row.created_at,
      endDate: row.created_at,
      totalSpend: 0,
      ordersFromAds: 0,
      createdAt: row.created_at,
      updatedAt: row.created_at,
    } as ManualAdCampaign),
    conversationState: parseJson<ManualAdConversationState>(row.conversation_state_json) ?? {
      knownIssues: [],
      promptAnswers: {},
      missingFields: [],
    },
    analysis: parseJson<ManualAdReportAnalysis>(row.analysis_json) ?? {
      shortDecision: "",
      efficiencyAssessment: "",
      decisionRationale: "",
      creativeCommentary: "",
      copyCommentary: "",
      audienceCommentary: "",
      budgetCommentary: "",
      landingPageCommentary: "",
      riskNotes: [],
      nextActions: [],
    },
    recommendations: parseJson<ManualAdReportRecommendations>(row.recommendations_json) ?? {
      budgetPlan: "",
      creativeAngles: [],
      copyAngles: [],
      minimumTestDays: 0,
      successCriteria: "",
      nextActions: [],
    },
    createdAt: row.created_at,
  };
}

function mapSummary(row: CampaignSummaryRow): ManualAdCampaignSummary {
  return {
    ...mapCampaign(row),
    messageCount: row.message_count,
    reportCount: row.report_count,
    latestDecision: row.latest_decision,
    latestScore: row.latest_score,
    latestSummary: row.latest_summary,
    latestReportId: row.latest_report_id,
    latestReportCreatedAt: row.latest_report_created_at,
  };
}

function getCampaignRow(db: ReturnType<typeof requireDb>, userId: number, campaignId: string) {
  return db
    .prepare(
      `
        SELECT *
        FROM manual_ad_campaigns
        WHERE id = ? AND user_id = ?
        LIMIT 1
      `
    )
    .get(campaignId, userId) as ManualAdCampaignRow | undefined;
}

function getLatestReportRow(db: ReturnType<typeof requireDb>, campaignId: string) {
  return db
    .prepare(
      `
        SELECT *
        FROM manual_ad_ai_reports
        WHERE campaign_id = ?
        ORDER BY datetime(created_at) DESC, rowid DESC
        LIMIT 1
      `
    )
    .get(campaignId) as ManualAdReportRow | undefined;
}

function getMessages(db: ReturnType<typeof requireDb>, campaignId: string) {
  return db
    .prepare(
      `
        SELECT *
        FROM manual_ad_chat_messages
        WHERE campaign_id = ?
        ORDER BY datetime(created_at) ASC, rowid ASC
      `
    )
    .all(campaignId) as ManualAdMessageRow[];
}

export function listManualAdCampaignSummaries(userId: number) {
  const db = requireDb();
  const rows = db
    .prepare(
      `
        SELECT
          c.*,
          (SELECT COUNT(*) FROM manual_ad_chat_messages m WHERE m.campaign_id = c.id) AS message_count,
          (SELECT COUNT(*) FROM manual_ad_ai_reports r WHERE r.campaign_id = c.id) AS report_count,
          (SELECT r.id FROM manual_ad_ai_reports r WHERE r.campaign_id = c.id ORDER BY datetime(r.created_at) DESC, r.rowid DESC LIMIT 1) AS latest_report_id,
          (SELECT r.decision FROM manual_ad_ai_reports r WHERE r.campaign_id = c.id ORDER BY datetime(r.created_at) DESC, r.rowid DESC LIMIT 1) AS latest_decision,
          (SELECT r.score FROM manual_ad_ai_reports r WHERE r.campaign_id = c.id ORDER BY datetime(r.created_at) DESC, r.rowid DESC LIMIT 1) AS latest_score,
          (SELECT r.summary FROM manual_ad_ai_reports r WHERE r.campaign_id = c.id ORDER BY datetime(r.created_at) DESC, r.rowid DESC LIMIT 1) AS latest_summary,
          (SELECT r.created_at FROM manual_ad_ai_reports r WHERE r.campaign_id = c.id ORDER BY datetime(r.created_at) DESC, r.rowid DESC LIMIT 1) AS latest_report_created_at
        FROM manual_ad_campaigns c
        WHERE c.user_id = ?
        ORDER BY datetime(c.updated_at) DESC, datetime(c.created_at) DESC
      `
    )
    .all(userId) as CampaignSummaryRow[];

  return rows.map(mapSummary);
}

export function getManualAdCampaignSummary(userId: number, campaignId: string) {
  const db = requireDb();
  const row = db
    .prepare(
      `
        SELECT
          c.*,
          (SELECT COUNT(*) FROM manual_ad_chat_messages m WHERE m.campaign_id = c.id) AS message_count,
          (SELECT COUNT(*) FROM manual_ad_ai_reports r WHERE r.campaign_id = c.id) AS report_count,
          (SELECT r.id FROM manual_ad_ai_reports r WHERE r.campaign_id = c.id ORDER BY datetime(r.created_at) DESC, r.rowid DESC LIMIT 1) AS latest_report_id,
          (SELECT r.decision FROM manual_ad_ai_reports r WHERE r.campaign_id = c.id ORDER BY datetime(r.created_at) DESC, r.rowid DESC LIMIT 1) AS latest_decision,
          (SELECT r.score FROM manual_ad_ai_reports r WHERE r.campaign_id = c.id ORDER BY datetime(r.created_at) DESC, r.rowid DESC LIMIT 1) AS latest_score,
          (SELECT r.summary FROM manual_ad_ai_reports r WHERE r.campaign_id = c.id ORDER BY datetime(r.created_at) DESC, r.rowid DESC LIMIT 1) AS latest_summary,
          (SELECT r.created_at FROM manual_ad_ai_reports r WHERE r.campaign_id = c.id ORDER BY datetime(r.created_at) DESC, r.rowid DESC LIMIT 1) AS latest_report_created_at
        FROM manual_ad_campaigns c
        WHERE c.user_id = ? AND c.id = ?
        LIMIT 1
      `
    )
    .get(userId, campaignId) as CampaignSummaryRow | undefined;

  return row ? mapSummary(row) : null;
}

export function listManualAdMessages(campaignId: string) {
  const db = requireDb();
  return getMessages(db, campaignId).map(mapMessage);
}

export function getManualAdCampaignDetail(userId: number, campaignId: string): ManualAdCampaignDetail | null {
  const db = requireDb();
  const campaignRow = getCampaignRow(db, userId, campaignId);
  if (!campaignRow) {
    return null;
  }

  const messages = getMessages(db, campaignId).map(mapMessage);
  const conversationState = buildManualAdConversationState(messages);
  const latestReportRow = getLatestReportRow(db, campaignId);

  return {
    campaign: mapCampaign(campaignRow),
    messages,
    conversationState,
    latestReport: latestReportRow ? mapReport(latestReportRow) : null,
  };
}

export function getManualAdCampaign(userId: number, campaignId: string) {
  const detail = getManualAdCampaignDetail(userId, campaignId);
  return detail?.campaign ?? null;
}

export function createManualAdCampaign(userId: number, input: ManualAdCampaignInput): ManualAdCampaignDetail {
  const validation = validateManualAdCampaignInput(input);
  if (!validation.ok) {
    const error = new Error("Manual ad campaign input is invalid.");
    (error as Error & { validationErrors?: Record<string, string[]> }).validationErrors = validation.errors;
    throw error;
  }

  const db = requireDb();
  const campaignId = randomUUID();
  const campaignDays = getManualAdCampaignDays(validation.value.startDate, validation.value.endDate);
  const seedState = createInitialManualAdConversationState({
    creativeFormat: validation.value.creativeFormat ?? "unknown",
    promptAnswers: {
      ...(validation.value.creativeFormat
        ? { creative_format: MANUAL_AD_CREATIVE_FORMAT_LABELS[validation.value.creativeFormat] }
        : {}),
      budget_daily: `Günlük bütçe yaklaşık ${Math.max(1, Math.round(validation.value.totalSpend / Math.max(1, campaignDays)))} TL.`,
      budget_duration: `${campaignDays} gün`,
      ...(validation.value.productName
        ? {
            landing_product: buildSeedLandingAnswer(validation.value) ?? `Ürün: ${validation.value.productName}`,
          }
        : {}),
    },
  });
  const seedReply = buildManualAdSeedReply(seedState, validation.value);

  const transaction = db.transaction(() => {
    db.prepare(
      `
        INSERT INTO manual_ad_campaigns (
          id, user_id, name, platform, start_date, end_date, total_spend, orders_from_ads,
          revenue_from_ads, product_name, product_sale_price, estimated_product_cost,
          estimated_product_profit, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
    ).run(
      campaignId,
      userId,
      validation.value.name,
      validation.value.platform,
      validation.value.startDate,
      validation.value.endDate,
      validation.value.totalSpend,
      validation.value.ordersFromAds,
      validation.value.revenueFromAds ?? null,
      validation.value.productName ?? null,
      validation.value.productSalePrice ?? null,
      validation.value.estimatedProductCost ?? null,
      validation.value.estimatedProductProfit ?? null,
      validation.value.notes ?? null
    );

    db.prepare(
      `
        INSERT INTO manual_ad_chat_messages (id, campaign_id, role, content, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `
    ).run(randomUUID(), campaignId, "assistant", seedReply.content, toJson(seedReply.metadata));
  });

  transaction();

  const detail = getManualAdCampaignDetail(userId, campaignId);
  if (!detail) {
    throw new Error("Manual ad campaign could not be created.");
  }

  return detail;
}

export function updateManualAdCampaign(
  userId: number,
  campaignId: string,
  input: ManualAdCampaignInput
): ManualAdCampaignDetail | null {
  const validation = validateManualAdCampaignInput(input);
  if (!validation.ok) {
    const error = new Error("Manual ad campaign input is invalid.");
    (error as Error & { validationErrors?: Record<string, string[]> }).validationErrors = validation.errors;
    throw error;
  }

  const db = requireDb();
  const existing = getCampaignRow(db, userId, campaignId);
  if (!existing) {
    return null;
  }

  db.prepare(
    `
      UPDATE manual_ad_campaigns
      SET name = ?,
          platform = ?,
          start_date = ?,
          end_date = ?,
          total_spend = ?,
          orders_from_ads = ?,
          revenue_from_ads = ?,
          product_name = ?,
          product_sale_price = ?,
          estimated_product_cost = ?,
          estimated_product_profit = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `
  ).run(
    validation.value.name,
    validation.value.platform,
    validation.value.startDate,
    validation.value.endDate,
    validation.value.totalSpend,
    validation.value.ordersFromAds,
    validation.value.revenueFromAds ?? null,
    validation.value.productName ?? null,
    validation.value.productSalePrice ?? null,
    validation.value.estimatedProductCost ?? null,
    validation.value.estimatedProductProfit ?? null,
    validation.value.notes ?? null,
    campaignId,
    userId
  );

  return getManualAdCampaignDetail(userId, campaignId);
}

export function deleteManualAdCampaign(userId: number, campaignId: string) {
  const db = requireDb();
  const result = db
    .prepare("DELETE FROM manual_ad_campaigns WHERE id = ? AND user_id = ?")
    .run(campaignId, userId);
  return result.changes > 0;
}

export function appendManualAdMessage(
  campaignId: string,
  role: "user" | "assistant",
  content: string,
  metadata?: ManualAdMessageMetadata | null
) {
  const db = requireDb();
  const id = randomUUID();
  db.prepare(
    `
      INSERT INTO manual_ad_chat_messages (id, campaign_id, role, content, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
  ).run(id, campaignId, role, content, metadata ? toJson(metadata) : null);

  db.prepare(
    `
      UPDATE manual_ad_campaigns
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
  ).run(campaignId);

  const row = db
    .prepare(
      `
        SELECT *
        FROM manual_ad_chat_messages
        WHERE id = ?
        LIMIT 1
      `
    )
    .get(id) as ManualAdMessageRow | undefined;

  if (!row) {
    throw new Error("Manual ad message could not be stored.");
  }

  return mapMessage(row);
}

export function storeManualAdMessage(
  campaignId: string,
  role: "user" | "assistant",
  content: string,
  metadata?: ManualAdMessageMetadata | null
) {
  return appendManualAdMessage(campaignId, role, content, metadata);
}

export function createManualAdConversationReply(campaignId: string, messages: ManualAdChatMessage[]) {
  const conversationState = buildManualAdConversationState(messages);
  const reply = buildManualAdAssistantReply(conversationState);
  const assistantMessage = appendManualAdMessage(campaignId, "assistant", reply.content, reply.metadata);
  return {
    assistantMessage,
    conversationState,
    readyToReport: reply.metadata.readyToReport,
  };
}

export function getManualAdConversationState(campaignId: string) {
  const messages = listManualAdMessages(campaignId);
  return buildManualAdConversationState(messages);
}

export function getLatestManualAdReport(campaignId: string) {
  const db = requireDb();
  const row = getLatestReportRow(db, campaignId);
  return row ? mapReport(row) : null;
}

export function createManualAdReportRecord(
  campaignId: string,
  generated: ManualAdGeneratedReport
) {
  const db = requireDb();
  const reportId = randomUUID();

  db.prepare(
    `
      INSERT INTO manual_ad_ai_reports (
        id, campaign_id, decision, score, summary, metrics_json, conversation_state_json,
        analysis_json, recommendations_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
  ).run(
    reportId,
    campaignId,
    generated.decision,
    generated.score,
    generated.summary,
    toJson(generated.metrics),
    toJson(generated.conversationState),
    toJson(generated.analysis),
    toJson(generated.recommendations)
  );

  db.prepare(
    `
      UPDATE manual_ad_campaigns
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
  ).run(campaignId);

  const row = db
    .prepare(
      `
        SELECT *
        FROM manual_ad_ai_reports
        WHERE id = ?
        LIMIT 1
      `
    )
    .get(reportId) as ManualAdReportRow | undefined;

  if (!row) {
    throw new Error("Manual ad report could not be stored.");
  }

  return mapReport(row);
}

export function generateAndStoreManualAdReport(
  campaign: ManualAdCampaign,
  conversationState: ManualAdConversationState,
  messages: ManualAdChatMessage[]
) {
  const metrics = calculateManualAdMetrics(campaign, conversationState);
  const decision = evaluateManualAdDecision(campaign, metrics, conversationState);
  return generateManualAdReport({
    campaign,
    metrics,
    decision,
    revenueSource:
      campaign.revenueFromAds !== null && campaign.revenueFromAds !== undefined
        ? "manual"
        : campaign.productSalePrice !== null && campaign.productSalePrice !== undefined
          ? "estimated_from_product"
          : "missing",
    conversationState,
    messages,
  }).then((generated) => ({
    generated,
    report: createManualAdReportRecord(campaign.id, generated),
  }));
}
