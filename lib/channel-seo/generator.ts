import {
  buildChannelSeoPrompt,
  buildChannelSeoSystemInstruction,
  CHANNEL_SEO_RESPONSE_SCHEMA,
} from "./prompt";
import { createFallbackChannelSeoContent, normalizeChannelSeoOutput } from "./mapper";
import { validateChannelSeoOptimizationInput } from "./validation";
import type {
  ChannelSeoOptimizationInput,
  ChannelSeoOptimizationOutput,
} from "./types";

const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

export class ChannelSeoGeneratorError extends Error {
  code: "validation_error" | "missing_api_key" | "request_error" | "parse_error" | "blocked_error";
  fallback?: ChannelSeoOptimizationOutput & { generatedBy: "fallback"; model: string | null };

  constructor(
    message: string,
    code: "validation_error" | "missing_api_key" | "request_error" | "parse_error" | "blocked_error",
    fallback?: ChannelSeoOptimizationOutput & { generatedBy: "fallback"; model: string | null }
  ) {
    super(message);
    this.name = "ChannelSeoGeneratorError";
    this.code = code;
    this.fallback = fallback;
  }
}

function resolveGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  return apiKey && apiKey.length > 0 ? apiKey : null;
}

function resolveGeminiModel() {
  const model = process.env.GEMINI_MODEL?.trim();
  return model && model.length > 0 ? model : DEFAULT_GEMINI_MODEL;
}

function safeJsonParse(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const candidates = [withoutFence, trimmed];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      const firstBrace = candidate.indexOf("{");
      const lastBrace = candidate.lastIndexOf("}");
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        try {
          return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as unknown;
        } catch {
          continue;
        }
      }
    }
  }

  return null;
}

function extractTextFromGeminiResponse(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;
  if (typeof record.text === "string" && record.text.trim().length > 0) {
    return record.text;
  }

  const candidates = Array.isArray(record.candidates) ? record.candidates : [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const candidateRecord = candidate as Record<string, unknown>;
    const content = candidateRecord.content;
    if (!content || typeof content !== "object") {
      continue;
    }

    const parts = (content as Record<string, unknown>).parts;
    if (!Array.isArray(parts)) {
      continue;
    }

    const text = parts
      .map((part) => (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string"
        ? String((part as Record<string, unknown>).text)
        : ""))
      .join("");

    if (text.trim().length > 0) {
      return text;
    }
  }

  return null;
}

function buildRequestBody(prompt: string, systemInstruction: string) {
  return {
    system_instruction: {
      parts: [
        {
          text: systemInstruction,
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
      responseJsonSchema: CHANNEL_SEO_RESPONSE_SCHEMA,
    },
  };
}

function createFallback(input: ChannelSeoOptimizationInput): ChannelSeoOptimizationOutput & { generatedBy: "fallback"; model: string | null } {
  const fallback = createFallbackChannelSeoContent({ ...input, generatedBy: "fallback" });
  return {
    ...fallback,
    generatedBy: "fallback",
  };
}

export async function generateChannelSeoContent(
  input: ChannelSeoOptimizationInput
): Promise<ChannelSeoOptimizationOutput> {
  const validation = validateChannelSeoOptimizationInput(input);
  if (!validation.ok) {
    throw new ChannelSeoGeneratorError("SEO optimizasyonu için ürün verisi geçersiz.", "validation_error");
  }

  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    throw new ChannelSeoGeneratorError(
      "Gemini API anahtarı tanımlı değil. SEO optimizasyonu için sunucu ayarlarını kontrol edin.",
      "missing_api_key"
    );
  }

  const model = resolveGeminiModel();
  const prompt = buildChannelSeoPrompt(validation.value);
  const systemInstruction = buildChannelSeoSystemInstruction(validation.value.channel);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(buildRequestBody(prompt, systemInstruction)),
    });

    const responseBody = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const message =
        responseBody && typeof responseBody === "object" && "error" in responseBody && responseBody.error && typeof responseBody.error === "object" && "message" in (responseBody.error as Record<string, unknown>)
          ? String((responseBody.error as Record<string, unknown>).message)
          : `Gemini isteği başarısız oldu (${response.status}).`;
      throw new ChannelSeoGeneratorError(message, "request_error", createFallback(validation.value));
    }

    if (responseBody && typeof responseBody === "object") {
      const promptFeedback = (responseBody as Record<string, unknown>).promptFeedback;
      if (promptFeedback && typeof promptFeedback === "object") {
        const blockReason = (promptFeedback as Record<string, unknown>).blockReason;
        if (typeof blockReason === "string" && blockReason.length > 0) {
          throw new ChannelSeoGeneratorError(
            "Yapay zeka isteği güvenlik filtresine takıldı. Lütfen ürün bilgisini ve talimatları sadeleştirip tekrar deneyin.",
            "blocked_error",
            createFallback(validation.value)
          );
        }
      }
    }

    const text = extractTextFromGeminiResponse(responseBody);
    if (!text) {
      throw new ChannelSeoGeneratorError(
        "Yapay zeka çıktısı beklenen formatta alınamadı, tekrar deneyin.",
        "parse_error",
        createFallback(validation.value)
      );
    }

    const parsed = safeJsonParse(text);
    if (!parsed || typeof parsed !== "object") {
      throw new ChannelSeoGeneratorError(
        "Yapay zeka çıktısı beklenen formatta alınamadı, tekrar deneyin.",
        "parse_error",
        createFallback(validation.value)
      );
    }

    const normalized = normalizeChannelSeoOutput(parsed as Partial<ChannelSeoOptimizationOutput>, validation.value);
    return normalized;
  } catch (error) {
    if (error instanceof ChannelSeoGeneratorError) {
      throw error;
    }

    throw new ChannelSeoGeneratorError(
      "Gemini isteği sırasında bir hata oluştu. Lütfen tekrar deneyin.",
      "request_error",
      createFallback(validation.value)
    );
  }
}

export function createChannelSeoFallback(
  input: ChannelSeoOptimizationInput
): ChannelSeoOptimizationOutput & { generatedBy: "fallback"; model: string | null } {
  return createFallback(input);
}

export function getChannelSeoModelName() {
  return resolveGeminiModel();
}
