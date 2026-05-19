import { NextResponse } from "next/server";

import { getAuthenticatedUserFromRequest } from "@/lib/request-auth";
import {
  buildManualAdAssistantReply,
  buildManualAdConversationState,
  isManualAdReadyForReport,
} from "@/lib/manual-ads/conversation";
import { sanitizeManualAdCreativeAttachments, summarizeManualAdCreativeAttachments } from "@/lib/manual-ads/creative-assets";
import { appendManualAdMessage, getManualAdCampaignDetail } from "@/lib/manual-ads/repository";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Oturum bulunamadi." }, { status: 401 });
    }

    const { id } = await params;
    const detail = getManualAdCampaignDetail(user.userId, id);
    if (!detail) {
      return NextResponse.json({ success: false, error: "Kampanya bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      messages: detail.messages,
      conversationState: detail.conversationState,
      readyToReport: Boolean(detail.latestReport) || isManualAdReadyForReport(detail.conversationState),
      latestReport: detail.latestReport,
    });
  } catch (error) {
    console.error("Manual ads messages fetch error:", error);
    return NextResponse.json({ success: false, error: "Mesajlar getirilemedi." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Oturum bulunamadi." }, { status: 401 });
    }

    const { id } = await params;
    const detail = getManualAdCampaignDetail(user.userId, id);
    if (!detail) {
      return NextResponse.json({ success: false, error: "Kampanya bulunamadı." }, { status: 404 });
    }

    const body = (await request.json()) as { content?: string; attachments?: unknown };
    const content = body.content?.trim();
    const attachments = sanitizeManualAdCreativeAttachments(body.attachments);
    if (!content && attachments.length === 0) {
      return NextResponse.json({ success: false, error: "Mesaj içeriği gerekli." }, { status: 400 });
    }

    const attachmentSummary = summarizeManualAdCreativeAttachments(attachments);
    const messageContent = content && content.length > 0
      ? content
      : attachmentSummary
        ? `Kreatif yüklendi: ${attachmentSummary}`
        : "Kreatif eklendi.";

    const lastAssistantMessage = [...detail.messages].reverse().find((message) => message.role === "assistant") ?? null;
    const userMessage = appendManualAdMessage(id, "user", messageContent, {
      kind: "reply",
      promptGroup: lastAssistantMessage?.metadata?.promptGroup,
      promptKey: lastAssistantMessage?.metadata?.promptKey,
      stateSnapshot: detail.conversationState,
      readyToReport: Boolean(detail.latestReport) || isManualAdReadyForReport(detail.conversationState),
      missingFields: detail.conversationState.missingFields,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    const updatedMessages = [...detail.messages, userMessage];
    const conversationState = buildManualAdConversationState(updatedMessages);
    const assistantReply = buildManualAdAssistantReply(conversationState);
    const assistantMessage = appendManualAdMessage(id, "assistant", assistantReply.content, assistantReply.metadata);

    const refreshed = getManualAdCampaignDetail(user.userId, id);
    if (!refreshed) {
      return NextResponse.json({ success: false, error: "Kampanya bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      userMessage,
      assistantMessage,
      conversationState: refreshed.conversationState,
      readyToReport: assistantReply.metadata.readyToReport,
      latestReport: refreshed.latestReport,
    });
  } catch (error) {
    console.error("Manual ads message create error:", error);
    return NextResponse.json({ success: false, error: "Mesaj kaydedilemedi." }, { status: 500 });
  }
}
