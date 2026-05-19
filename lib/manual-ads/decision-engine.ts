import type { ManualAdCampaign, ManualAdConversationState, ManualAdDecision, ManualAdMetrics } from "./types";

export type ManualAdDecisionEvaluation = {
  decision: ManualAdDecision;
  score: number;
  summary: string;
  reasons: string[];
  riskNotes: string[];
  nextActions: string[];
};

const MIN_TEST_DAYS = 3;
const MIN_TEST_ORDERS = 3;
const MEANINGFUL_SPEND_THRESHOLD = 1000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value);
}

function formatDecisionLabel(decision: ManualAdDecision) {
  switch (decision) {
    case "scale":
      return "Ölçekle";
    case "keep_testing":
      return "Teste devam et";
    case "reduce_budget":
      return "Bütçeyi azalt";
    case "pause":
      return "Durdur";
    case "insufficient_data":
      return "Veri yetersiz";
  }
}

function buildPerformanceVerdict(campaign: ManualAdCampaign, metrics: ManualAdMetrics) {
  const lowData = metrics.campaignDays < MIN_TEST_DAYS || campaign.ordersFromAds < MIN_TEST_ORDERS;
  const strongByCpa = metrics.breakEvenCPA !== null && metrics.costPerOrder !== null && metrics.costPerOrder <= metrics.breakEvenCPA * 0.6;
  const strongByRoas = metrics.roas !== null && metrics.roas >= 4;
  const positiveByRoas = metrics.roas !== null && metrics.roas >= 2;
  const weakByNoOrders = campaign.ordersFromAds === 0 && campaign.totalSpend >= MEANINGFUL_SPEND_THRESHOLD;
  const weakByRoas = metrics.roas !== null && metrics.roas < 1;

  if (strongByCpa || strongByRoas) {
    return lowData ? "Performans güçlü görünüyor; veri hâlâ sınırlı." : "Performans güçlü.";
  }

  if (positiveByRoas) {
    return lowData ? "Performans olumlu görünüyor; veri hâlâ sınırlı." : "Performans olumlu.";
  }

  if (weakByNoOrders || weakByRoas) {
    return "Performans zayıf.";
  }

  return "Performans karışık.";
}

function buildScore(campaign: ManualAdCampaign, metrics: ManualAdMetrics) {
  let score = 50;

  if (metrics.dataQuality === "high") {
    score += 12;
  } else if (metrics.dataQuality === "medium") {
    score += 4;
  } else {
    score -= 10;
  }

  if (metrics.campaignDays < MIN_TEST_DAYS) {
    score -= 12;
  }

  if (campaign.ordersFromAds === 0) {
    score -= 24;
  } else if (campaign.ordersFromAds < MIN_TEST_ORDERS) {
    score -= 8;
  }

  if (metrics.breakEvenCPA !== null && metrics.costPerOrder !== null) {
    const ratio = metrics.costPerOrder / Math.max(1, metrics.breakEvenCPA);
    if (ratio <= 0.6) {
      score += 24;
    } else if (ratio <= 0.85) {
      score += 14;
    } else if (ratio <= 1.05) {
      score -= 2;
    } else if (ratio <= 1.25) {
      score -= 12;
    } else {
      score -= 22;
    }
  } else if (metrics.roas !== null) {
    if (metrics.roas >= 3) {
      score += 10;
    } else if (metrics.roas >= 1.5) {
      score += 4;
    } else if (metrics.roas < 1) {
      score -= 12;
    }
  }

  if (metrics.estimatedProfitAfterAds !== null) {
    if (metrics.estimatedProfitAfterAds > 0) {
      score += 8;
    } else if (metrics.estimatedProfitAfterAds < 0) {
      score -= 16;
    }
  }

  return clamp(round(score), 0, 100);
}

function buildNextActions(decision: ManualAdDecision, metrics: ManualAdMetrics, conversationState?: ManualAdConversationState) {
  const actions: string[] = [];

  if (decision === "scale") {
    actions.push("Kazanan kreatifi ve mesajı koruyarak bütçeyi kademeli artır.");
    actions.push("Aynı kitlede küçük bir varyasyonla ikinci test aç.");
  } else if (decision === "keep_testing") {
    actions.push("Bütçeyi sabit tut ve en az bir test döngüsü daha çalıştır.");
    actions.push("Kreatif ve metin varyasyonlarını ayrı ayrı test et.");
  } else if (decision === "reduce_budget") {
    actions.push("Bütçeyi azalt ve en düşük verimli reklam setlerini kapat.");
    actions.push("Yeni testlerde farklı bir kreatif açısı dene.");
  } else if (decision === "pause") {
    actions.push("Kampanyayı durdur ve önce kreatif / teklif / açılış sayfası sorununu düzelt.");
    actions.push("Yeniden açmadan önce yeni bir test planı hazırla.");
  } else {
    actions.push("Önce daha fazla sipariş ve bağlam verisi topla.");
    actions.push("Kreatif, mesaj ve hedef kitle notlarını tamamla.");
  }

  if (metrics.breakEvenCPA === null) {
    actions.push("Ürün başı net kâr verisini ekleyerek karar kalitesini artır.");
  }

  if (!conversationState?.adCopy) {
    actions.push("Reklam metnini netleştir; başlık, CTA ve indirim vurgusunu yaz.");
  }

  return actions;
}

function buildRiskNotes(campaign: ManualAdCampaign, metrics: ManualAdMetrics, decision: ManualAdDecision) {
  const notes: string[] = [];

  if (metrics.breakEvenCPA === null) {
    notes.push("Ürün başı net kâr eksik olduğu için net kârlılık kesin hesaplanamaz.");
  }

  if (campaign.revenueFromAds === null || campaign.revenueFromAds === undefined) {
    notes.push("Ciro girişi yok; ROAS yorumu sınırlı kalır.");
  }

  if (metrics.campaignDays < MIN_TEST_DAYS || campaign.ordersFromAds < MIN_TEST_ORDERS) {
    notes.push("Örneklem küçük olduğu için karar güveni düşüktür.");
  }

  if (decision === "pause") {
    notes.push("Bu kampanya mevcut haliyle bütçe tüketiyor olabilir.");
  } else if (decision === "reduce_budget") {
    notes.push("Mevcut bütçe temposu verimlilik eşiğini zorlayabilir.");
  }

  return notes;
}

function buildSummary(decision: ManualAdDecision, metrics: ManualAdMetrics, campaign: ManualAdCampaign) {
  const cpoText = metrics.costPerOrder === null ? "hesaplanamadı" : `${metrics.costPerOrder.toFixed(2)} TL`;
  const breakEvenText = metrics.breakEvenCPA === null ? "net kâr verisi yok" : `${metrics.breakEvenCPA.toFixed(2)} TL`;
  const roasText = metrics.roas === null ? "ROAS yok" : `${metrics.roas.toFixed(2)}x ROAS`;
  const performanceVerdict = buildPerformanceVerdict(campaign, metrics);

  switch (decision) {
    case "scale":
      return `${performanceVerdict} Sipariş başı maliyet (${cpoText}) break-even seviyenin belirgin altında. ${roasText} ve test verisi yeterli görünüyor; ölçekleme mantıklı.`;
    case "keep_testing":
      return `${performanceVerdict} Sinyaller olumlu ama henüz karar sert değil. ${cpoText} ve ${breakEvenText} birbirine yakın ya da veri hâlâ sınırlı; aynı bütçeyle testi sürdür.`;
    case "reduce_budget":
      return `${performanceVerdict} Sipariş başı maliyet ${breakEvenText} seviyesini zorluyor. Bütçe temposunu düşürüp daha net bir kreatif testi yap.`;
    case "pause":
      return `${performanceVerdict} Harcama artmış ancak performans karşılık vermiyor. ${cpoText} mevcut ürün ekonomisine göre zayıf; kampanyayı durdurup yeniden tasarla.`;
    case "insufficient_data":
      return `${performanceVerdict} Veri seti şu anda erken aşamada. ${campaign.ordersFromAds} sipariş ve ${metrics.campaignDays} gün ile karar kalitesi sınırlı; testi sürdürmeden önce daha fazla bağlam topla.`;
  }
}

export function evaluateManualAdDecision(
  campaign: ManualAdCampaign,
  metrics: ManualAdMetrics,
  conversationState?: ManualAdConversationState
): ManualAdDecisionEvaluation {
  const lowData = metrics.campaignDays < MIN_TEST_DAYS || campaign.ordersFromAds < MIN_TEST_ORDERS;
  const highSpendWithoutOrders = campaign.ordersFromAds === 0 && campaign.totalSpend >= MEANINGFUL_SPEND_THRESHOLD;
  const score = buildScore(campaign, metrics);
  const reasons: string[] = [];
  let decision: ManualAdDecision = "keep_testing";

  if (highSpendWithoutOrders) {
    decision = "pause";
    reasons.push("Sipariş yok ve harcama anlamlı seviyede.");
  } else if (lowData) {
    decision = metrics.costPerOrder !== null && metrics.breakEvenCPA !== null && metrics.costPerOrder <= metrics.breakEvenCPA * 0.85 ? "keep_testing" : "insufficient_data";
    reasons.push("Gün sayısı veya sipariş sayısı karar için düşük.");
  } else if (metrics.breakEvenCPA !== null && metrics.costPerOrder !== null) {
    if (metrics.costPerOrder <= metrics.breakEvenCPA * 0.6) {
      decision = "scale";
      reasons.push("Sipariş başı maliyet break-even'ın %60'ından düşük.");
    } else if (metrics.costPerOrder <= metrics.breakEvenCPA * 0.85) {
      decision = "keep_testing";
      reasons.push("Sipariş başı maliyet break-even'a yakın ama hâlâ kabul edilebilir.");
    } else if (metrics.costPerOrder <= metrics.breakEvenCPA) {
      decision = "reduce_budget";
      reasons.push("Sipariş başı maliyet break-even seviyesini yakalıyor.");
    } else if (metrics.estimatedProfitAfterAds !== null && metrics.estimatedProfitAfterAds < 0) {
      decision = "pause";
      reasons.push("Ad sonrası tahmini kâr negatife dönmüş.");
    } else {
      decision = "reduce_budget";
      reasons.push("Sipariş başı maliyet break-even üstüne çıktı.");
    }
  } else if (metrics.roas !== null) {
    if (metrics.roas >= 2.5 && campaign.ordersFromAds >= MIN_TEST_ORDERS) {
      decision = "keep_testing";
      reasons.push("ROAS iyi görünüyor ama net kâr verisi eksik.");
    } else if (metrics.roas < 1) {
      decision = campaign.totalSpend >= MEANINGFUL_SPEND_THRESHOLD ? "reduce_budget" : "keep_testing";
      reasons.push("ROAS 1'in altında.");
    } else {
      decision = "keep_testing";
      reasons.push("Ciro verisi var ancak karar için ek sinyal gerekiyor.");
    }
  } else {
    decision = lowData ? "insufficient_data" : "keep_testing";
    reasons.push("Ciro veya ürün kârı verisi yeterli değil.");
  }

  if (decision === "scale" && lowData) {
    decision = "keep_testing";
    reasons.push("Veri düşük olduğu için ölçekleme yerine test sürdürme seçildi.");
  }

  const riskNotes = buildRiskNotes(campaign, metrics, decision);
  const nextActions = buildNextActions(decision, metrics, conversationState);

  return {
    decision,
    score: decision === "scale"
      ? clamp(score, 72, 96)
      : decision === "keep_testing"
        ? clamp(score, 56, 75)
        : decision === "reduce_budget"
          ? clamp(score, 34, 55)
          : decision === "pause"
            ? clamp(score, 8, 32)
            : clamp(score, 28, 58),
    summary: buildSummary(decision, metrics, campaign),
    reasons,
    riskNotes,
    nextActions,
  };
}

export function getManualAdDecisionLabel(decision: ManualAdDecision) {
  return formatDecisionLabel(decision);
}
