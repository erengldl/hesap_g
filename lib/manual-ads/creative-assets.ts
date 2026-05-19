import type { ManualAdChatMessage, ManualAdCreativeAttachment, ManualAdCreativeFormat } from "./types";

export type ManualAdGeminiInlineDataPart = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};

const GEMINI_INLINE_ATTACHMENT_LIMIT = 3;

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function truncateText(value: string, maxLength = 120) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function formatAttachmentName(name: string) {
  const normalized = name.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? truncateText(normalized, 80) : "isimsiz dosya";
}

export function hasManualAdCreativeAttachments(
  attachments: ManualAdCreativeAttachment[] | null | undefined
): attachments is ManualAdCreativeAttachment[] {
  return Array.isArray(attachments) && attachments.length > 0;
}

export function collectManualAdCreativeAttachments(messages: ManualAdChatMessage[]) {
  return messages.flatMap((message) => (Array.isArray(message.metadata?.attachments) ? message.metadata.attachments : []));
}

export function inferManualAdCreativeFormatFromAttachments(
  attachments: ManualAdCreativeAttachment[] | null | undefined
): ManualAdCreativeFormat | null {
  if (!hasManualAdCreativeAttachments(attachments)) {
    return null;
  }

  const kinds = new Set(attachments.map((attachment) => attachment.kind));
  if (kinds.has("video")) {
    return "video";
  }

  if (attachments.length > 1) {
    return "carousel";
  }

  if (kinds.has("image")) {
    return "image";
  }

  return "unknown";
}

export function summarizeManualAdCreativeAttachments(attachments: ManualAdCreativeAttachment[] | null | undefined) {
  if (!hasManualAdCreativeAttachments(attachments)) {
    return null;
  }

  const images = attachments.filter((attachment) => attachment.kind === "image");
  const videos = attachments.filter((attachment) => attachment.kind === "video");
  const parts: string[] = [];

  if (videos.length > 0) {
    parts.push(`${videos.length} video`);
  }

  if (images.length > 0) {
    parts.push(`${images.length} görsel`);
  }

  const fileNames = attachments.slice(0, 3).map((attachment) => formatAttachmentName(attachment.name));
  const namesText = fileNames.length > 0 ? ` (${fileNames.join(", ")})` : "";

  return `${parts.join(", ")}${namesText}`;
}

export function buildManualAdAttachmentContextLines(attachments: ManualAdCreativeAttachment[] | null | undefined) {
  const summary = summarizeManualAdCreativeAttachments(attachments);
  if (!summary) {
    return [];
  }

  return [
    `- Yüklenen kreatif: ${summary}`,
    ...attachments!.slice(0, 3).map((attachment, index) => `- Ek ${index + 1}: ${attachment.kind === "video" ? "video" : "görsel"} · ${formatAttachmentName(attachment.name)}`),
  ];
}

function parseDataUrl(dataUrl: string) {
  const trimmed = dataUrl.trim();
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
}

export function normalizeManualAdCreativeAttachment(input: unknown): ManualAdCreativeAttachment | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const attachment = input as Record<string, unknown>;
  const kind = attachment.kind;
  if (kind !== "image" && kind !== "video") {
    return null;
  }

  const name = isString(attachment.name) ? attachment.name.trim() : "";
  const sourceMimeType = isString(attachment.sourceMimeType) ? attachment.sourceMimeType.trim() : "";
  const previewMimeType = isString(attachment.previewMimeType) ? attachment.previewMimeType.trim() : "";
  const previewDataUrl = isString(attachment.previewDataUrl) ? attachment.previewDataUrl.trim() : "";
  const sourceSize = typeof attachment.sourceSize === "number" && Number.isFinite(attachment.sourceSize) ? Math.max(0, Math.round(attachment.sourceSize)) : null;

  if (!name || !sourceMimeType || !previewMimeType || !previewDataUrl || sourceSize === null) {
    return null;
  }

  const previewPayload = parseDataUrl(previewDataUrl);
  if (!previewPayload || previewPayload.mimeType !== previewMimeType) {
    return null;
  }

  return {
    kind,
    name,
    sourceMimeType,
    previewMimeType,
    previewDataUrl,
    sourceSize,
  };
}

export function sanitizeManualAdCreativeAttachments(input: unknown): ManualAdCreativeAttachment[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map(normalizeManualAdCreativeAttachment).filter((attachment): attachment is ManualAdCreativeAttachment => Boolean(attachment));
}

export function buildManualAdGeminiInlineDataParts(
  attachments: ManualAdCreativeAttachment[] | null | undefined
): ManualAdGeminiInlineDataPart[] {
  if (!hasManualAdCreativeAttachments(attachments)) {
    return [];
  }

  return attachments
    .slice(0, GEMINI_INLINE_ATTACHMENT_LIMIT)
    .map((attachment) => parseDataUrl(attachment.previewDataUrl))
    .filter((part): part is { mimeType: string; data: string } => Boolean(part))
    .map((part) => ({ inlineData: part }));
}
