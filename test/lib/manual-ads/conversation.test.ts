import { describe, expect, it } from "vitest";

import {
  buildManualAdAssistantReply,
  buildManualAdConversationState,
  createInitialManualAdConversationState,
  isManualAdReadyForReport,
} from "@/lib/manual-ads/conversation";
import { buildManualAdConversationOpening, MANUAL_AD_INTERVIEW_PROMPTS, MANUAL_AD_INTERVIEW_PROMPT_LIMIT } from "@/lib/manual-ads/prompts";
import type { ManualAdChatMessage, ManualAdCreativeAttachment, ManualAdPromptGroup } from "@/lib/manual-ads/types";

function buildAssistantMessage(promptKey: string, promptGroup: ManualAdPromptGroup, content: string): ManualAdChatMessage {
  return {
    id: `assistant-${promptKey}`,
    campaignId: "campaign-1",
    role: "assistant",
    content,
    metadata: {
      kind: "prompt",
      promptKey,
      promptGroup,
      readyToReport: false,
      missingFields: [],
    },
    createdAt: "2026-05-18T00:00:00.000Z",
  };
}

function buildUserMessage(promptKey: string, content: string): ManualAdChatMessage {
  return {
    id: `user-${promptKey}`,
    campaignId: "campaign-1",
    role: "user",
    content,
    metadata: null,
    createdAt: "2026-05-18T00:00:00.000Z",
  };
}

function buildCreativeAttachment(kind: ManualAdCreativeAttachment["kind"]): ManualAdCreativeAttachment {
  return {
    kind,
    name: kind === "video" ? "creative.mp4" : "creative.png",
    sourceMimeType: kind === "video" ? "video/mp4" : "image/png",
    previewMimeType: "image/jpeg",
    previewDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==",
    sourceSize: 4096,
  };
}

describe("manual ads conversation", () => {
  it("limits the interview to five high-signal prompts", () => {
    expect(MANUAL_AD_INTERVIEW_PROMPTS).toHaveLength(MANUAL_AD_INTERVIEW_PROMPT_LIMIT);
  });

  it("starts with a five-question opening", () => {
    const opening = buildManualAdConversationOpening();
    expect(opening).toContain(`${MANUAL_AD_INTERVIEW_PROMPT_LIMIT}`);
    expect(opening).toContain(MANUAL_AD_INTERVIEW_PROMPTS[0].question);
  });

  it("personalizes the opening with campaign data", () => {
    const opening = buildManualAdConversationOpening({
      name: "Yaz kampanyası",
      platform: "meta",
      productName: "Termos",
      creativeFormat: "video",
      totalSpend: 12000,
      ordersFromAds: 48,
    });

    expect(opening).toContain("Yaz kampanyası");
    expect(opening).toContain("Sosyal");
    expect(opening).toContain("Termos");
    expect(opening).toContain("video");
    expect(opening).toContain("12.000");
    expect(opening).toContain("48");
    expect(opening).toContain(MANUAL_AD_INTERVIEW_PROMPTS[0].question);
  });

  it("opens with a performance signal and skips already known campaign data", () => {
    const seededState = createInitialManualAdConversationState({
      promptAnswers: {
        creative_format: "Video",
        budget_daily: "Günlük bütçe yaklaşık 500 TL.",
        budget_duration: "7 gün",
        landing_product: "Ürün: Termos\nFiyat: 999 TL",
      },
    });

    const opening = buildManualAdConversationOpening(
      {
        name: "Hızlı satış kampanyası",
        platform: "meta",
        productName: "Termos",
        creativeFormat: "video",
        totalSpend: 1000,
        ordersFromAds: 52,
        productSalePrice: 999,
      },
      seededState
    );

    expect(opening).toContain("52 satış");
    expect(opening).toMatch(/güçlü|olumlu/i);
    expect(opening).not.toContain(MANUAL_AD_INTERVIEW_PROMPTS[0].question);
    expect(opening).toContain(MANUAL_AD_INTERVIEW_PROMPTS[1].question);
  });

  it("opens with a clear warning when spend is high and sales are weak", () => {
    const opening = buildManualAdConversationOpening({
      name: "Zayıf kampanya",
      platform: "google",
      productName: "Kulaklık",
      totalSpend: 12500,
      ordersFromAds: 3,
      productSalePrice: 1200,
    });

    expect(opening).toContain("12.500");
    expect(opening).toContain("3 satış");
    expect(opening).toMatch(/zayıf|düzelt|ayır/i);
  });

  it("reaches ready state after the five interview prompts are answered", () => {
    const messages: ManualAdChatMessage[] = [];

    for (const prompt of MANUAL_AD_INTERVIEW_PROMPTS) {
      messages.push(buildAssistantMessage(prompt.key, prompt.group, prompt.question));

      const answers: Record<string, string> = {
        creative_format: "Video. İlk 3 saniyede ürün net görünüyordu. Sosyal kanıt yok.",
        copy_headline: "Başlık: Güçlü teklif\nAna metin: Hemen dene\nCTA: Satın al\nTeklif: %20 indirim",
        audience_target: "Hedef kitle: kadın 25-44\nKitle sıcaklığı: cold\nHedefleme: interest + lookalike",
        budget_daily: "Günlük bütçe: 500\nTest süresi: 7 gün\nÖlçekleme: kademeli artırıldı",
        landing_product: "Ürün: Test ürün\nFiyat: 799\nMarj: yüksek\nGüven: yorum ve iade bilgisi var\nTakılma: kargo bedeli",
      };

      messages.push(buildUserMessage(prompt.key, answers[prompt.key] ?? "bilmiyorum"));
    }

    const state = buildManualAdConversationState(messages);
    expect(state.missingFields).toHaveLength(0);
    expect(isManualAdReadyForReport(state)).toBe(true);

    const reply = buildManualAdAssistantReply(state);
    expect(reply.metadata.readyToReport).toBe(true);
    expect(reply.content).toContain("rapor");
  });

  it("uses uploaded creative attachments to satisfy the creative prompt", () => {
    const creativePrompt = MANUAL_AD_INTERVIEW_PROMPTS[0];
    const messages: ManualAdChatMessage[] = [
      buildAssistantMessage(creativePrompt.key, creativePrompt.group, creativePrompt.question),
      {
        id: "user-creative-upload",
        campaignId: "campaign-1",
        role: "user",
        content: "",
        metadata: {
          attachments: [buildCreativeAttachment("image"), buildCreativeAttachment("video")],
        },
        createdAt: "2026-05-18T00:00:00.000Z",
      },
    ];

    const state = buildManualAdConversationState(messages);
    expect(state.creativeFormat).toBe("video");
    expect(state.creativeDescription).toContain("Yüklenen kreatif");
    expect(state.promptAnswers?.creative_format).toContain("görsel");
  });
});
