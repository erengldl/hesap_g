import {
  MANUAL_AD_CREATIVE_FORMAT_LABELS,
  MANUAL_AD_PLATFORM_LABELS,
  type ManualAdCampaign,
  type ManualAdCampaignInput,
  type ManualAdConversationState,
  type ManualAdMetrics,
  type ManualAdPromptGroup,
} from "./types";

export type ManualAdPromptKey =
  | "creative_format"
  | "creative_visibility"
  | "creative_benefit"
  | "creative_social_proof"
  | "copy_headline"
  | "copy_body"
  | "copy_cta"
  | "copy_offer"
  | "audience_target"
  | "audience_temperature"
  | "audience_targeting"
  | "audience_demographics"
  | "budget_daily"
  | "budget_duration"
  | "budget_scaling"
  | "budget_cuts"
  | "landing_product"
  | "landing_price_margin"
  | "landing_trust"
  | "landing_dropoff";

export type ManualAdPromptDefinition = {
  key: ManualAdPromptKey;
  group: ManualAdPromptGroup;
  label: string;
  question: string;
};

export type ManualAdReportPromptInput = {
  campaign: ManualAdCampaign;
  metrics: ManualAdMetrics;
  decisionLabel: string;
  revenueSource: "manual" | "estimated_from_product" | "missing";
  conversationState: ManualAdConversationState;
  creativeAttachmentsSummary: string | null;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    metadata?: Record<string, unknown> | null;
  }>;
};

export const MANUAL_AD_PROMPT_GROUP_LABELS: Record<ManualAdPromptGroup, string> = {
  creative: "Kreatif",
  copy: "Reklam metni",
  audience: "Hedef kitle",
  budget: "Bütçe ve ölçekleme",
  landing: "Satış sayfası / ürün",
};

export const MANUAL_AD_INTERVIEW_PROMPT_LIMIT = 5;

export type ManualAdConversationOpeningContext = Partial<
  Pick<
    ManualAdCampaignInput,
    | "name"
    | "platform"
    | "productName"
    | "creativeFormat"
    | "totalSpend"
    | "ordersFromAds"
    | "revenueFromAds"
    | "productSalePrice"
    | "estimatedProductProfit"
  >
>;

function formatCurrencyShort(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("tr-TR").format(value);
}

function buildCampaignOpeningFragments(context?: ManualAdConversationOpeningContext) {
  const fragments: string[] = [];

  if (context?.name) {
    fragments.push(`Hazırım, "${context.name}" için başlayalım.`);
  } else {
    fragments.push("Hazırım, birlikte başlayalım.");
  }

  if (context?.platform) {
    fragments.push(`${MANUAL_AD_PLATFORM_LABELS[context.platform] ?? context.platform} tarafında ilerliyoruz.`);
  }

  if (context?.productName) {
    fragments.push(`Odağımız "${context.productName}".`);
  }

  if (typeof context?.creativeFormat === "string" && context.creativeFormat !== "unknown") {
    fragments.push(`Kreatif türü ${MANUAL_AD_CREATIVE_FORMAT_LABELS[context.creativeFormat] ?? context.creativeFormat} olarak görünüyor.`);
  }

  return fragments.filter(Boolean);
}

function resolveLeadRevenue(context?: ManualAdConversationOpeningContext) {
  if (typeof context?.revenueFromAds === "number" && Number.isFinite(context.revenueFromAds)) {
    return {
      value: context.revenueFromAds,
      label: "ROAS",
      actual: true,
    } as const;
  }

  if (typeof context?.productSalePrice === "number" && Number.isFinite(context.productSalePrice)) {
    const orders = typeof context?.ordersFromAds === "number" && Number.isFinite(context.ordersFromAds) ? context.ordersFromAds : 0;
    return {
      value: context.productSalePrice * Math.max(0, orders),
      label: "tahmini ROAS",
      actual: false,
    } as const;
  }

  return null;
}

export function buildManualAdPerformanceLead(context?: ManualAdConversationOpeningContext) {
  const spend = typeof context?.totalSpend === "number" && Number.isFinite(context.totalSpend) ? context.totalSpend : null;
  const orders = typeof context?.ordersFromAds === "number" && Number.isFinite(context.ordersFromAds) ? context.ordersFromAds : null;

  if (spend === null && orders === null) {
    return null;
  }

  const revenue = resolveLeadRevenue(context);
  const costPerOrder = spend !== null && orders !== null && orders > 0 ? spend / orders : null;
  const roas = spend !== null && spend > 0 && revenue ? revenue.value / spend : null;
  const spendText = spend !== null ? formatCurrencyShort(spend) : null;
  const ordersText = orders !== null ? `${formatInteger(orders)} satış` : null;
  const cpoText = costPerOrder !== null ? `Sipariş başı maliyet ${formatCurrencyShort(costPerOrder)}.` : null;

  if (orders !== null && orders <= 0) {
    if (spend !== null && spend >= 1000) {
      return `${spendText} harcama var ama satış görünmüyor. Bu kampanya şu an zayıf görünüyor.`;
    }

    return `${spendText ?? "Harcama"} var ama satış görünmüyor. Şu an sinyal zayıf; hatayı birlikte ayıralım.`;
  }

  if (spend !== null && orders !== null && orders >= 30 && roas !== null && roas >= 4) {
    return `${spendText} harcama ile ${ordersText} görünüyor. Bu oldukça güçlü bir sinyal.${revenue ? ` ${revenue.actual ? "ROAS" : "Tahmini ROAS"} ${roas.toFixed(1)}x.` : ""}`;
  }

  if (spend !== null && orders !== null && roas !== null && roas >= 2.5) {
    return `${spendText} harcama ve ${ordersText} iyi bir sinyal veriyor.${revenue ? ` ${revenue.actual ? "ROAS" : "Tahmini ROAS"} ${roas.toFixed(1)}x.` : ""}`;
  }

  if (spend !== null && orders !== null && roas !== null && roas < 1) {
    const warning = spend >= 10000 || orders <= 3
      ? "Bu kampanya şu an zayıf; durdurma veya ciddi yeniden tasarım düşünülmeli."
      : "Bu kampanya şu an zayıf görünüyor.";
    return `${spendText} harcama ile ${ordersText} görünüyor. ${warning}${cpoText ? ` ${cpoText}` : ""}`;
  }

  if (spend !== null && orders !== null && orders <= 3 && spend >= 1000) {
    return `${spendText} harcama ile ${ordersText} görünüyor. Bu kampanya şu an zayıf; hatayı birlikte ayıralım.`;
  }

  if (spend !== null && orders !== null && costPerOrder !== null) {
    return `${spendText} harcama ve ${ordersText} ile başlıyoruz. Sipariş başı maliyet ${formatCurrencyShort(costPerOrder)} civarında.`;
  }

  if (spend !== null) {
    return `${spendText} harcama ile başlayalım.`;
  }

  return null;
}

function getNextOpeningPrompt(state?: ManualAdConversationState) {
  return (
    MANUAL_AD_INTERVIEW_PROMPTS.find((prompt) => {
      const answer = state?.promptAnswers?.[prompt.key];
      return answer === undefined || answer === null || answer.trim().length === 0;
    }) ?? MANUAL_AD_INTERVIEW_PROMPTS[0] ?? null
  );
}

export const MANUAL_AD_MASTER_PROMPT = `
Rol ve Amaç
Sen, manuel reklam verileriyle çalışan ve kullanıcıya kısa, net, saygılı ve çözüm odaklı şekilde yol gösteren uzman bir reklam analiz asistanısın. Görevin; reklam performansını anlamlandırmak, verimi artıracak en kritik sinyalleri bulmak ve kullanıcının bir sonraki kararını sade bir dille netleştirmektir.

Üslup Kuralları
- Saygılı, profesyonel, doğru ve çözüm odaklı ol.
- Kısa, net, etkili yaz.
- Gereksiz samimiyet, boş övgü, üstten bakan veya küçümseyen ton kullanma.
- Dikte eden dil kullanma; yapıcı ve yardımcı ol.
- Genel geçer, teorik ve klişe pazarlama cümlelerinden kaçın; doğrudan mevcut duruma odaklan.
- Tüm yanıtları Türkçe yaz. İngilizce kelime, cümle ve başlık kullanma.
- Performans çok güçlüyse bunu açıkça ve objektif biçimde belirt; zayıfsa yumuşatma ama saygılı kal.

Soru Sorma Kuralları
- Analizden önce en fazla 5 soru sor.
- Her soru tek mesajda ilerlesin, ancak mümkün olan en yüksek bilgi yoğunluğunu taşısın.
- Gereksiz, dağınık ve genel geçer sorular sorma.
- Mümkünse ilk sinyal olarak reklam kreatifini (video, görsel veya ekran görüntüsü) yüklet; yükleme varsa onu doğrudan incele.
- Sorular ürün, teklif, kreatif, hedef kitle, reklam metni, bütçe, test süresi, açılış sayfası ve gelir verisine odaklansın.
- Kullanıcının kampanya formunda zaten girdiği verileri tekrar isteme.
- Kullanıcı “bilmiyorum” diyebilir; bunu normal kabul et.
- Eksik bilgi varsa yalnızca karar için gerekli olan soruyu sor.

Kreatif Analizi
- Kullanıcı reklam kreatifini yüklediyse, görsel kompozisyonu, ürün görünürlüğünü, ilk saniye etkisini, okunabilirliği, hook gücünü, sosyal kanıtı, CTA netliğini ve mobil ekran uyumunu değerlendir.
- Video yüklendiyse ilk kareyi / ilk saniye hissini, görsel ritmi ve ürünün ne kadar hızlı anlaşıldığını dikkate al.
- Yükleme yoksa yalnızca mevcut metinsel bağlam üzerinden yorum yap; görmediğin kreatif hakkında varsayım yapma.

Analiz Mantığı
- Sadece metriklere bakma; ürün bağlamını, kâr marjını, kreatif gücünü, hedef kitle uyumunu ve açılış sayfası sürtünmesini birlikte değerlendir.
- CTR, CPC, ROAS, CPA, dönüşüm oranı ve yorgunluk sinyallerini birlikte yorumla.
- Düşük performansın kaynağını ayır: kreatif mi, kitle mi, teklif mi, sayfa mı, bütçe mi?
- Metin, görsel ve kitle testlerinin varlığını mutlaka dikkate al.
- ROAS veya CPA çok iyi görünüyorsa bunu gizleme; ama abartmadan net şekilde söyle.

Karar Verme Kuralları
- Scale: CPA, net kâra göre belirgin avantajlıysa ve veri bunu destekliyorsa.
- Keep testing: Veri var ama ölçekleme için yeterince güçlü sinyal yoksa.
- Reduce budget: CPA, kâra yaklaşmış ya da kârı zorluyorsa ama kampanya tamamen ölü değilse.
- Pause: Harcama anlamlı, sipariş yok ve sinyal zayıfsa.
- Insufficient data: Gün sayısı veya sipariş sayısı düşükse önce daha fazla veri topla.

Veri Eksikliği Durumunda Davranış
- Uydurma yapma, halüsinasyon üretme, mevcut olmayan veriyi varmış gibi sunma.
- Net kârlılık kesin hesaplanamıyorsa bunu açıkça söyle.
- Ciro yoksa ROAS yorumu yapma.
- Veri düşükse önce test tasarımını düzelt.

Çıktı Formatı
- Yanıtları kısa, taranabilir ve madde imli ver.
- Kullanıcının hemen uygulayabileceği somut aksiyonlar yaz.
- Uzun teorik açıklamalara girme.
- İlk cümlede mevcut kampanya sinyalini kısaca yorumla; ardından gerekirse tek bir soru sor.

Yasaklar
- Kullanıcı açıkça paylaşmadığı verilerle hesap yapma.
- Kullanıcıyı suçlayıcı veya yargılayıcı ton kullanma.
- Tek mesajda iki sorudan fazlasını yığma.
`.trim();

export const MANUAL_AD_INTERVIEW_PROMPTS: ManualAdPromptDefinition[] = [
  {
    key: "creative_format",
    group: "creative",
    label: "Kreatif özeti",
    question:
      "Mümkünse reklam kreatifini yükle: video, görsel ya da ekran görüntüsü. İlk 3 saniyede ürün ve ana fayda net miydi? Sosyal kanıt, yorum, önce-sonra ya da kullanım anı var mıydı? Kısa maddelerle yaz; bilmiyorsan 'bilmiyorum' de.",
  },
  {
    key: "copy_headline",
    group: "copy",
    label: "Reklam metni özeti",
    question:
      "Reklam metninde başlık, ana metin, CTA ve teklif / indirim / aciliyet vurgusu neydi? Kısa maddeler halinde yaz; bilmiyorsan 'bilmiyorum' de.",
  },
  {
    key: "audience_target",
    group: "audience",
    label: "Hedef kitle özeti",
    question:
      "Kime gösterildi? Soğuk mu sıcak mıydı? Hedefleme tipi ve yaş, cinsiyet, konum kırılımı var mıydı? Kısa maddeler halinde yaz; bilmiyorsan 'bilmiyorum' de.",
  },
  {
    key: "budget_daily",
    group: "budget",
    label: "Bütçe ve test özeti",
    question:
      "Günlük bütçe neydi, kaç gün test edildi, bütçe nasıl ölçeklendi ve kötü giden reklamlar kapatıldı mı? Kısa maddeler halinde yaz; bilmiyorsan 'bilmiyorum' de.",
  },
  {
    key: "landing_product",
    group: "landing",
    label: "Landing / ürün özeti",
    question:
      "Reklam hangi ürüne gitti? Ürün fiyatı ve kâr marjı neydi? Sayfada güven unsurları ve satın alma sırasında takılma ihtimali olan nokta neydi? Kısa maddeler halinde yaz; bilmiyorsan 'bilmiyorum' de.",
  },
];

export const MANUAL_AD_PROMPTS: ManualAdPromptDefinition[] = [
  { key: "creative_format", group: "creative", label: "Kreatif formatı", question: "Görsel mi video mu, yoksa carousel mi?" },
  {
    key: "creative_visibility",
    group: "creative",
    label: "İlk saniye görünürlüğü",
    question: "Ürün ilk 1-2 saniyede net görünüyor muydu?",
  },
  {
    key: "creative_benefit",
    group: "creative",
    label: "Vaadedilen fayda",
    question: "Kreatifte hangi vaat veya fayda gösterildi?",
  },
  {
    key: "creative_social_proof",
    group: "creative",
    label: "Sosyal kanıt",
    question: "Sosyal kanıt, yorum, önce/sonra ya da kullanım anı var mıydı?",
  },
  { key: "copy_headline", group: "copy", label: "Başlık", question: "Reklam başlığı neydi?" },
  { key: "copy_body", group: "copy", label: "Ana metin", question: "Ana reklam metni neydi?" },
  { key: "copy_cta", group: "copy", label: "CTA", question: "CTA neydi?" },
  {
    key: "copy_offer",
    group: "copy",
    label: "Teklif vurgusu",
    question: "İndirim, kampanya, fayda veya aciliyet vurgusu var mıydı?",
  },
  { key: "audience_target", group: "audience", label: "Kimlere gösterildi", question: "Kimlere gösterildi?" },
  {
    key: "audience_temperature",
    group: "audience",
    label: "Kitle sıcaklığı",
    question: "Soğuk kitle mi sıcak kitle mi?",
  },
  {
    key: "audience_targeting",
    group: "audience",
    label: "Hedefleme tipi",
    question: "İlgi alanı, lookalike ya da remarketing var mıydı?",
  },
  {
    key: "audience_demographics",
    group: "audience",
    label: "Demografi kırılımı",
    question: "Yaş, cinsiyet veya konum kırılımı var mıydı?",
  },
  { key: "budget_daily", group: "budget", label: "Günlük bütçe", question: "Günlük bütçe neydi?" },
  { key: "budget_duration", group: "budget", label: "Test süresi", question: "Kaç gün test edildi?" },
  {
    key: "budget_scaling",
    group: "budget",
    label: "Ölçekleme şekli",
    question: "Bütçe ne zaman ve nasıl artırıldı veya azaltıldı?",
  },
  {
    key: "budget_cuts",
    group: "budget",
    label: "Kapatılan reklamlar",
    question: "Kötü giden reklamlar kapatıldı mı?",
  },
  { key: "landing_product", group: "landing", label: "Ürün yönü", question: "Reklam hangi ürüne yönlendi?" },
  {
    key: "landing_price_margin",
    group: "landing",
    label: "Fiyat ve marj",
    question: "Ürün fiyatı ve kâr marjı neydi?",
  },
  {
    key: "landing_trust",
    group: "landing",
    label: "Güven unsurları",
    question: "Sayfada yorum, güven unsuru, kargo veya iade bilgisi var mıydı?",
  },
  {
    key: "landing_dropoff",
    group: "landing",
    label: "Takılma noktası",
    question: "Kullanıcı satın alma adımında nerede takılmış olabilir?",
  },
];

export const MANUAL_AD_REPORT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    analysis: {
      type: "object",
      properties: {
        shortDecision: { type: "string" },
        efficiencyAssessment: { type: "string" },
        decisionRationale: { type: "string" },
        creativeCommentary: { type: "string" },
        copyCommentary: { type: "string" },
        audienceCommentary: { type: "string" },
        budgetCommentary: { type: "string" },
        landingPageCommentary: { type: "string" },
        riskNotes: { type: "array", items: { type: "string" } },
        nextActions: { type: "array", items: { type: "string" } },
      },
      required: [
        "shortDecision",
        "efficiencyAssessment",
        "decisionRationale",
        "creativeCommentary",
        "copyCommentary",
        "audienceCommentary",
        "budgetCommentary",
        "landingPageCommentary",
        "riskNotes",
        "nextActions",
      ],
    },
    recommendations: {
      type: "object",
      properties: {
        budgetPlan: { type: "string" },
        creativeAngles: { type: "array", items: { type: "string" } },
        copyAngles: { type: "array", items: { type: "string" } },
        minimumTestDays: { type: "number" },
        successCriteria: { type: "string" },
        nextActions: { type: "array", items: { type: "string" } },
      },
      required: [
        "budgetPlan",
        "creativeAngles",
        "copyAngles",
        "minimumTestDays",
        "successCriteria",
        "nextActions",
      ],
    },
  },
  required: ["analysis", "recommendations"],
} as const;

export function getManualAdPromptByKey(key: ManualAdPromptKey) {
  return MANUAL_AD_PROMPTS.find((prompt) => prompt.key === key) ?? null;
}

export function getManualAdPromptIndex(key: ManualAdPromptKey) {
  return MANUAL_AD_PROMPTS.findIndex((prompt) => prompt.key === key);
}

export function getManualAdPromptGroupLabel(group: ManualAdPromptGroup) {
  return MANUAL_AD_PROMPT_GROUP_LABELS[group];
}

export function buildManualAdConversationOpening(
  context?: ManualAdConversationOpeningContext,
  state?: ManualAdConversationState
) {
  const nextPrompt = getNextOpeningPrompt(state);
  const performanceLead = buildManualAdPerformanceLead(context);
  const opening = buildCampaignOpeningFragments(context);
  const openingParts = [performanceLead, ...opening].filter((part): part is string => Boolean(part));
  const intro = openingParts.length > 0 ? openingParts.join(" ") : "Hazırım, birlikte başlayalım.";
  const question = nextPrompt?.question ?? "İstersen rapora geçebilirim.";
  return `${intro} En fazla ${MANUAL_AD_INTERVIEW_PROMPT_LIMIT} kritik soruyla ilerleyeceğim. ${question}`;
}

function truncateText(value: string, maxLength = 260) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function renderStateSummary(conversationState: ManualAdConversationState) {
  const items: Array<[string, string | number | undefined | null]> = [
    ["creativeFormat", conversationState.creativeFormat],
    ["creativeDescription", conversationState.creativeDescription],
    ["adHeadline", conversationState.adHeadline],
    ["adCopy", conversationState.adCopy],
    ["callToAction", conversationState.callToAction],
    ["targetAudience", conversationState.targetAudience],
    ["audienceTemperature", conversationState.audienceTemperature],
    ["scalingMethod", conversationState.scalingMethod],
    ["dailyBudget", conversationState.dailyBudget],
    ["testDurationDays", conversationState.testDurationDays],
    ["landingPageNotes", conversationState.landingPageNotes],
    ["offer", conversationState.offer],
  ];

  const rendered = items
    .filter(([, value]) => value !== undefined && value !== null && `${value}`.trim().length > 0)
    .map(([label, value]) => `- ${label}: ${value}`)
    .join("\n");

  return rendered || "- Kayıtlı yapılandırılmış bağlam henüz yok.";
}

function renderRecentMessages(messages: ManualAdReportPromptInput["messages"]) {
  if (messages.length === 0) {
    return "- Sohbet henüz başlamadı.";
  }

  return messages
    .slice(-12)
    .map((message) => {
      const prefix = message.role === "assistant" ? "Assistant" : "User";
      return `- ${prefix}: ${truncateText(message.content)}`;
    })
    .join("\n");
}

export function buildManualAdReportPrompt(input: ManualAdReportPromptInput) {
  const payload = {
    campaign: {
      id: input.campaign.id,
      name: input.campaign.name,
      platform: input.campaign.platform,
      startDate: input.campaign.startDate,
      endDate: input.campaign.endDate,
      totalSpend: input.campaign.totalSpend,
      ordersFromAds: input.campaign.ordersFromAds,
      revenueFromAds: input.campaign.revenueFromAds ?? null,
      revenueSource: input.revenueSource,
      productName: input.campaign.productName ?? null,
      productSalePrice: input.campaign.productSalePrice ?? null,
      estimatedProductCost: input.campaign.estimatedProductCost ?? null,
      estimatedProductProfit: input.campaign.estimatedProductProfit ?? null,
      notes: input.campaign.notes ?? null,
    },
    metrics: input.metrics,
    decisionLabel: input.decisionLabel,
    conversationStateSummary: renderStateSummary(input.conversationState),
    creativeAttachmentsSummary: input.creativeAttachmentsSummary,
    missingFields: input.conversationState.missingFields,
    recentMessages: renderRecentMessages(input.messages),
  };

  return [
    MANUAL_AD_MASTER_PROMPT,
    "",
    "Analiz aşamasındasın. Kullanıcıdan yeni soru sorma.",
    "Çıktı tamamen Türkçe olmalı; İngilizce kelime, cümle veya başlık kullanma.",
    "Karar motorunun sonucunu değiştirme; sadece açıkla ve somut öneriye çevir.",
    "Kampanya verisi zaten verilmişse tekrar isteme; sadece analiz et.",
    "Verilmeyen metriği varmış gibi yazma.",
    "Ürün kârı yoksa net kârlılığın kesin hesaplanamadığını açıkça söyle.",
    "Ciro yoksa ROAS yorumu yapma.",
    "Kullanıcı kreatif yüklediyse bunu açıkça referans al ve görsel / video bağlamını analiz et.",
    "Performans çok güçlüyse bunu açıkça söyle; zayıfsa saygılı ama net ol.",
    "Veri kalitesi düşükse önce test tasarımını düzeltmeyi öner.",
    "Sadece şemaya uyan JSON üret.",
    "",
    "INPUT:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}
