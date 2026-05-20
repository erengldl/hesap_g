"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Image as ImageIcon,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Send,
  Sparkles,
  Upload,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { GlassCard } from "@/components/ui-custom/GlassComponents";
import { calculateManualAdMetrics } from "@/lib/manual-ads/metrics";
import {
  getManualAdSpeechRecognitionCtor,
  mapManualAdSpeechError,
  normalizeManualAdSpeechText,
  speakManualAdText,
  stopManualAdSpeech,
  supportsManualAdSpeechInput,
  supportsManualAdSpeechOutput,
  type ManualAdSpeechRecognitionLike,
} from "@/lib/manual-ads/voice";
import {
  type ManualAdCampaign,
  type ManualAdChatMessage,
  type ManualAdConversationState,
  type ManualAdCreativeAttachment,
  type ManualAdReport,
} from "@/lib/manual-ads/types";
import { cn } from "@/lib/utils";

import { ManualAdCollectedContextPanel } from "./ManualAdCollectedContextPanel";
import { ManualAdDecisionBadge } from "./ManualAdDecisionBadge";

type ManualAdChatProps = {
  campaign: ManualAdCampaign;
  messages: ManualAdChatMessage[];
  conversationState: ManualAdConversationState;
  readyToReport: boolean;
  latestReport: ManualAdReport | null;
  className?: string;
};

type SendMessageResponse = {
  success: boolean;
  userMessage?: ManualAdChatMessage;
  assistantMessage?: ManualAdChatMessage;
  conversationState?: ManualAdConversationState;
  readyToReport?: boolean;
  latestReport?: ManualAdReport | null;
  error?: string;
};

type GenerateReportResponse = {
  success: boolean;
  report?: ManualAdReport;
  assistantMessage?: ManualAdChatMessage;
  error?: string;
};

const MAX_ATTACHMENT_COUNT = 3;
const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_PREVIEW_DIMENSION = 1280;
const VOICE_PREFERENCES_STORAGE_KEY = "manual-ads-voice-preferences";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "bilinmiyor";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  const kilobytes = value / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function getAttachmentKindLabel(kind: ManualAdCreativeAttachment["kind"]) {
  return kind === "video" ? "Video" : "Görsel";
}

function getAttachmentIcon(kind: ManualAdCreativeAttachment["kind"]) {
  return kind === "video" ? <Video className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />;
}

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Görsel okunamadı."));
    };
    image.src = objectUrl;
  });
}

async function buildImagePreviewDataUrl(file: File) {
  const image = await loadImageElement(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const longestSide = Math.max(sourceWidth, sourceHeight);
  if (!longestSide) {
    throw new Error("Görsel boyutu okunamadı.");
  }

  const scale = Math.min(1, MAX_PREVIEW_DIMENSION / longestSide);
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Görsel önizlemesi oluşturulamadı.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL("image/jpeg", 0.88);
}

async function buildVideoPreviewDataUrl(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Video okunamadı."));
    });

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const seekTime = duration > 0 ? Math.min(0.5, Math.max(0.05, duration * 0.05)) : 0.1;

    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Video karesi alınamadı."));
      video.currentTime = seekTime;
    });

    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const longestSide = Math.max(sourceWidth, sourceHeight);
    const scale = Math.min(1, MAX_PREVIEW_DIMENSION / Math.max(1, longestSide));
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Video önizlemesi oluşturulamadı.");
    }

    context.drawImage(video, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function buildCreativeAttachment(file: File): Promise<ManualAdCreativeAttachment> {
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error(`Dosya boyutu en fazla ${formatBytes(MAX_ATTACHMENT_SIZE_BYTES)} olabilir.`);
  }

  if (file.type.startsWith("image/")) {
    return {
      kind: "image",
      name: file.name,
      sourceMimeType: file.type || "image/*",
      previewMimeType: "image/jpeg",
      previewDataUrl: await buildImagePreviewDataUrl(file),
      sourceSize: file.size,
    };
  }

  if (file.type.startsWith("video/")) {
    return {
      kind: "video",
      name: file.name,
      sourceMimeType: file.type || "video/*",
      previewMimeType: "image/jpeg",
      previewDataUrl: await buildVideoPreviewDataUrl(file),
      sourceSize: file.size,
    };
  }

  throw new Error("Sadece görsel veya video dosyaları yüklenebilir.");
}

function appendDraftTranscript(current: string, transcript: string) {
  const normalizedTranscript = normalizeManualAdSpeechText(transcript);
  if (!normalizedTranscript) {
    return current;
  }

  const trimmedCurrent = current.trimEnd();
  if (!trimmedCurrent) {
    return normalizedTranscript;
  }

  return `${trimmedCurrent} ${normalizedTranscript}`.replace(/\s+/g, " ").trim();
}

function getLatestAssistantMessage(messages: ManualAdChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "assistant") {
      return message;
    }
  }

  return null;
}

function AttachmentCard({
  attachment,
  removable = false,
  onRemove,
}: {
  attachment: ManualAdCreativeAttachment;
  removable?: boolean;
  onRemove?: () => void;
}) {
  const kindLabel = getAttachmentKindLabel(attachment.kind);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-container">
      <div className="relative aspect-video bg-surface-container">
        <Image
          src={attachment.previewDataUrl}
          alt={`${kindLabel} önizleme`}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain"
          unoptimized
          loading="lazy"
        />
        <div className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-panel/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground">
          {getAttachmentIcon(attachment.kind)}
          {kindLabel}
        </div>
        {removable && onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-panel/70 text-foreground transition-colors duration-200 hover:bg-surface-container"
            aria-label={`${attachment.name} dosyasını kaldır`}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="space-y-1 px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-foreground" title={attachment.name}>
          {attachment.name}
        </p>
        <p className="text-xs text-muted">
          {formatBytes(attachment.sourceSize)} · {attachment.sourceMimeType}
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ManualAdChatMessage }) {
  const isAssistant = message.role === "assistant";
  const label = isAssistant ? "Danışman" : "Sen";
  const group = message.metadata?.promptGroup ? ` • ${message.metadata.promptGroup}` : "";
  const attachments = message.metadata?.attachments ?? [];

  return (
    <div className={cn("flex", isAssistant ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[min(100%,42rem)] rounded-2xl border px-4 py-3 shadow-sm",
          isAssistant
            ? "border-primary/15 bg-primary/5 text-foreground"
            : "border-border bg-surface-container text-foreground"
        )}
      >
        <div className="flex items-center justify-between gap-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          <span>
            {label}
            {group}
          </span>
          <span>{formatTime(message.createdAt)}</span>
        </div>
        <p className="mt-2 whitespace-pre-line text-sm leading-6">{message.content}</p>
        {attachments.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {attachments.map((attachment) => (
              <AttachmentCard key={`${message.id}-${attachment.name}-${attachment.sourceSize}`} attachment={attachment} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ManualAdChat({
  campaign,
  messages: initialMessages,
  conversationState: initialConversationState,
  readyToReport: initialReadyToReport,
  latestReport: initialLatestReport,
  className,
}: ManualAdChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [conversationState, setConversationState] = useState(initialConversationState);
  const [readyToReport, setReadyToReport] = useState(initialReadyToReport);
  const [latestReport, setLatestReport] = useState<ManualAdReport | null>(initialLatestReport);
  const [draft, setDraft] = useState("");
  const [selectedAttachments, setSelectedAttachments] = useState<ManualAdCreativeAttachment[]>([]);
  const [isPreparingAttachments, setIsPreparingAttachments] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isAttachmentPanelOpen, setIsAttachmentPanelOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVoiceInputSupported, setIsVoiceInputSupported] = useState(false);
  const [isVoiceOutputSupported, setIsVoiceOutputSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeakingResponse, setIsSpeakingResponse] = useState(false);
  const [autoSpeakResponses, setAutoSpeakResponses] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<ManualAdSpeechRecognitionLike | null>(null);
  const lastSpokenAssistantMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    const scrollContainer = messagesScrollRef.current;
    if (!scrollContainer) {
      return;
    }

    scrollContainer.scrollTo({
      top: scrollContainer.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  useEffect(() => {
    setIsVoiceInputSupported(supportsManualAdSpeechInput());
    setIsVoiceOutputSupported(supportsManualAdSpeechOutput());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(VOICE_PREFERENCES_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as { autoSpeakResponses?: boolean };
      if (typeof parsed.autoSpeakResponses === "boolean") {
        setAutoSpeakResponses(parsed.autoSpeakResponses);
        if (parsed.autoSpeakResponses) {
          lastSpokenAssistantMessageIdRef.current = getLatestAssistantMessage(initialMessages)?.id ?? null;
        }
      }
    } catch {
      // Ignore invalid persisted preferences.
    }
  }, [initialMessages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(VOICE_PREFERENCES_STORAGE_KEY, JSON.stringify({ autoSpeakResponses }));
    } catch {
      // Ignore storage failures.
    }
  }, [autoSpeakResponses]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      stopManualAdSpeech();
    };
  }, []);

  useEffect(() => {
    if (!autoSpeakResponses || !isVoiceOutputSupported) {
      return;
    }

    const latestAssistantMessage = getLatestAssistantMessage(messages);
    if (!latestAssistantMessage || lastSpokenAssistantMessageIdRef.current === latestAssistantMessage.id) {
      return;
    }

    lastSpokenAssistantMessageIdRef.current = latestAssistantMessage.id;
    setIsSpeakingResponse(true);
    const spoken = speakManualAdText(latestAssistantMessage.content, {
      onEnd: () => setIsSpeakingResponse(false),
      onError: () => setIsSpeakingResponse(false),
    });

    if (!spoken) {
      setIsSpeakingResponse(false);
    }
  }, [autoSpeakResponses, isVoiceOutputSupported, messages]);

  async function handleAttachmentSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";

    if (files.length === 0) {
      return;
    }

    setAttachmentError(null);

    const remainingSlots = MAX_ATTACHMENT_COUNT - selectedAttachments.length;
    if (remainingSlots <= 0) {
      setAttachmentError(`En fazla ${MAX_ATTACHMENT_COUNT} medya dosyası yükleyebilirsin.`);
      return;
    }

    const acceptedFiles = files.slice(0, remainingSlots);
    if (files.length > acceptedFiles.length) {
      setAttachmentError(`En fazla ${MAX_ATTACHMENT_COUNT} medya dosyası yükleyebilirsin.`);
    }

    setIsPreparingAttachments(true);
    try {
      const preparedAttachments: ManualAdCreativeAttachment[] = [];
      const buildErrors: string[] = [];
      for (const file of acceptedFiles) {
        try {
          const attachment = await buildCreativeAttachment(file);
          preparedAttachments.push(attachment);
        } catch (attachmentBuildError) {
          buildErrors.push(attachmentBuildError instanceof Error ? attachmentBuildError.message : "Kreatif yüklenemedi.");
        }
      }

      if (preparedAttachments.length > 0) {
        setSelectedAttachments((current) => [...current, ...preparedAttachments]);
      }

      if (buildErrors.length > 0) {
        setAttachmentError(buildErrors[0]);
      }
    } finally {
      setIsPreparingAttachments(false);
    }
  }

  function handleRemoveAttachment(index: number) {
    setSelectedAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setAttachmentError(null);
  }

  function handleClearAttachments() {
    setSelectedAttachments([]);
    setAttachmentError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function toggleAttachmentPanel() {
    setIsAttachmentPanelOpen((current) => !current);
  }

  async function stopVoiceInput() {
    const recognition = recognitionRef.current;
    if (recognition) {
      await new Promise<void>((resolve) => {
        let resolved = false;
        const timeoutId = window.setTimeout(() => {
          finalize();
        }, 1200);

        const finalize = () => {
          if (resolved) {
            return;
          }
          resolved = true;
          window.clearTimeout(timeoutId);
          recognitionRef.current = null;
          setIsListening(false);
          setLiveTranscript("");
          resolve();
        };

        const previousOnEnd = recognition.onend;
        recognition.onend = () => {
          previousOnEnd?.();
          finalize();
        };

        try {
          recognition.stop();
        } catch {
          finalize();
        }
      });
      return;
    }

    recognitionRef.current = null;
    setIsListening(false);
    setLiveTranscript("");
  }

  function startVoiceInput() {
    const RecognitionCtor = getManualAdSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      setVoiceError("Bu tarayıcı sesli girişi desteklemiyor.");
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = "tr-TR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const results = Array.from(event.results).slice(event.resultIndex);
      const finalTranscriptParts: string[] = [];
      const interimTranscriptParts: string[] = [];

      for (const result of results) {
        const transcript = normalizeManualAdSpeechText(result[0]?.transcript ?? "");
        if (!transcript) {
          continue;
        }

        if (result.isFinal) {
          finalTranscriptParts.push(transcript);
        } else {
          interimTranscriptParts.push(transcript);
        }
      }

      const finalTranscript = normalizeManualAdSpeechText(finalTranscriptParts.join(" "));
      const interimTranscript = normalizeManualAdSpeechText(interimTranscriptParts.join(" "));

      if (finalTranscript) {
        setDraft((current) => appendDraftTranscript(current, finalTranscript));
        setLiveTranscript(finalTranscript);
        return;
      }

      setLiveTranscript(interimTranscript);
    };

    recognition.onerror = (event) => {
      setVoiceError(mapManualAdSpeechError(event.error));
      void stopVoiceInput();
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      setLiveTranscript("");
    };

    try {
      stopManualAdSpeech();
      setVoiceError(null);
      setLiveTranscript("");
      recognition.start();
      setIsListening(true);
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceError("Sesli giriş başlatılamadı.");
    }
  }

  function handleToggleVoiceInput() {
    if (!isVoiceInputSupported) {
      setVoiceError("Bu tarayıcı sesli girişi desteklemiyor.");
      return;
    }

    if (isListening) {
      void stopVoiceInput();
      return;
    }

    startVoiceInput();
  }

  function handleToggleVoiceOutput() {
    if (!isVoiceOutputSupported) {
      setVoiceError("Bu tarayıcı sesli okumayı desteklemiyor.");
      return;
    }

    const nextValue = !autoSpeakResponses;
    setAutoSpeakResponses(nextValue);
    setVoiceError(null);

    if (nextValue) {
      lastSpokenAssistantMessageIdRef.current = getLatestAssistantMessage(messages)?.id ?? null;
      return;
    }

    stopManualAdSpeech();
    setIsSpeakingResponse(false);
  }

  function handleSpeakLatestAssistantMessage() {
    if (!isVoiceOutputSupported) {
      setVoiceError("Bu tarayıcı sesli okumayı desteklemiyor.");
      return;
    }

    const latestAssistantMessage = getLatestAssistantMessage(messages);
    if (!latestAssistantMessage) {
      setVoiceError("Okunacak bir yanıt yok.");
      return;
    }

    setVoiceError(null);
    lastSpokenAssistantMessageIdRef.current = latestAssistantMessage.id;
    setIsSpeakingResponse(true);
    const spoken = speakManualAdText(latestAssistantMessage.content, {
      onEnd: () => setIsSpeakingResponse(false),
      onError: () => setIsSpeakingResponse(false),
    });

    if (!spoken) {
      setIsSpeakingResponse(false);
      setVoiceError("Sesli okuma başlatılamadı.");
    }
  }

  function handleStopVoiceOutput() {
    stopManualAdSpeech();
    setIsSpeakingResponse(false);
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await stopVoiceInput();
    const content = draft.trim();
    if ((content.length === 0 && selectedAttachments.length === 0) || isSending || isPreparingAttachments) {
      return;
    }

    setError(null);
    setIsSending(true);
    try {
      const response = await fetch(`/api/manual-ads/${campaign.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          attachments: selectedAttachments,
        }),
      });

      const payload = (await response.json()) as SendMessageResponse;
      if (!response.ok || !payload.success || !payload.userMessage || !payload.assistantMessage) {
        throw new Error(payload.error || "Mesaj kaydedilemedi.");
      }

      setMessages((current) => [...current, payload.userMessage!, payload.assistantMessage!]);
      if (payload.conversationState) {
        setConversationState(payload.conversationState);
      }
      if (typeof payload.readyToReport === "boolean") {
        setReadyToReport(payload.readyToReport);
      }
      if (payload.latestReport) {
        setLatestReport(payload.latestReport);
      }
      setDraft("");
      handleClearAttachments();
      setIsAttachmentPanelOpen(false);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Mesaj gönderilemedi.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleGenerateReport() {
    if (isGenerating) {
      return;
    }

    await stopVoiceInput();
    setError(null);
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/manual-ads/${campaign.id}/generate-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force: true }),
      });

      const payload = (await response.json()) as GenerateReportResponse;
      if (!response.ok || !payload.success || !payload.report) {
        throw new Error(payload.error || "Rapor oluşturulamadı.");
      }

      setLatestReport(payload.report);
      if (payload.assistantMessage) {
        setMessages((current) => [...current, payload.assistantMessage!]);
      }
      router.push(`/reklam-analizi/${campaign.id}/report`);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Rapor oluşturulamadı.");
    } finally {
      setIsGenerating(false);
    }
  }

  const canSend = (draft.trim().length > 0 || selectedAttachments.length > 0) && !isSending && !isPreparingAttachments;
  const latestAssistantMessage = getLatestAssistantMessage(messages);

  return (
    <div className={cn("grid h-full min-h-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]", className)}>
      <div className="flex min-w-0 min-h-0 flex-col gap-4">
        <GlassCard className="border border-border bg-surface-container">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Yapay zeka sohbeti</p>
              <h2 className="text-xl font-semibold text-foreground">{campaign.name}</h2>
              <p className="text-sm leading-6 text-muted">
                Danışman yalnızca eksik ve kritik sinyalleri sorar. Mevcut kampanya verilerini tekrar istemez. Mümkünse ilk yanıtta reklam kreatifini yükle; video, görsel veya ekran görüntüsü olabilir. İstersen sesle cevap verip danışmanın yanıtını da dinleyebilirsin.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ManualAdDecisionBadge decision={latestReport?.decision ?? null} score={latestReport?.score ?? null} />
              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Analiz raporunu oluştur
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger">{error}</div>
          ) : null}
        </GlassCard>

        <GlassCard className="flex min-h-0 flex-1 flex-col border border-border bg-surface-container">
          <div ref={messagesScrollRef} className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        </GlassCard>

        <GlassCard className="shrink-0 border border-border bg-surface-container">
          <form className="space-y-4" onSubmit={handleSend}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Cevap yaz</p>
                <p className="mt-1 text-sm text-muted">Bilmiyorsan doğrudan “bilmiyorum” yazabilirsin. Kreatif varsa dosya olarak ekle.</p>
              </div>
              {readyToReport ? (
                <span className="rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-success">
                  Rapor hazır
                </span>
              ) : (
                <span className="rounded-full border border-warning/20 bg-warning/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-warning">
                  Bağlam toplanıyor
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleToggleVoiceInput}
                disabled={!isVoiceInputSupported}
                aria-pressed={isListening}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors duration-200",
                  isListening
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-border bg-surface-container text-foreground hover:border-primary/30 hover:bg-surface-container",
                  !isVoiceInputSupported && "cursor-not-allowed opacity-50"
                )}
                title={isListening ? "Dinlemeyi durdur" : "Sesle cevap yaz"}
              >
                {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {isListening ? "Dinleniyor" : "Sesle yaz"}
              </button>

              <button
                type="button"
                onClick={handleToggleVoiceOutput}
                disabled={!isVoiceOutputSupported}
                aria-pressed={autoSpeakResponses}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors duration-200",
                  autoSpeakResponses
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-border bg-surface-container text-foreground hover:border-primary/30 hover:bg-surface-container",
                  !isVoiceOutputSupported && "cursor-not-allowed opacity-50"
                )}
                title={autoSpeakResponses ? "Yeni danışman yanıtlarını sesli oku" : "Yanıtları sesli okumayı aç"}
              >
                <Volume2 className="h-3.5 w-3.5" />
                {autoSpeakResponses ? "Ses açık" : "Sesli oku"}
              </button>

              <button
                type="button"
                onClick={handleSpeakLatestAssistantMessage}
                disabled={!isVoiceOutputSupported || !latestAssistantMessage}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border border-border bg-surface-container px-3 py-2 text-xs font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
                )}
                title="Son danışman yanıtını sesli oku"
              >
                {isSpeakingResponse ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                Son yanıtı oku
              </button>

              {isSpeakingResponse ? (
                <button
                  type="button"
                  onClick={handleStopVoiceOutput}
                  className="inline-flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger transition-colors duration-200 hover:bg-danger/15"
                >
                  <VolumeX className="h-3.5 w-3.5" />
                  Oku durdur
                </button>
              ) : null}
            </div>

            {voiceError || liveTranscript ? (
              <div className="rounded-xl border border-border bg-surface-container px-3 py-2 text-xs text-muted">
                {voiceError ? <span className="text-danger">{voiceError}</span> : null}
                {voiceError && liveTranscript ? <span className="mx-2 text-muted/40">•</span> : null}
                {liveTranscript ? (
                  <span>
                    {isListening ? "Dinlenen metin: " : "Son ses girdisi: "}
                    {liveTranscript}
                  </span>
                ) : null}
              </div>
            ) : null}

            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={4}
              placeholder="Kısa ve net cevap yaz..."
              className="w-full rounded-xl border border-border bg-surface-container px-3 py-2.5 text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-muted/60 focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
            />

            <div className="flex flex-wrap gap-2">
              <Link
                href="/reklam-analizi"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-surface-container"
              >
                <ArrowLeft className="h-4 w-4" />
                Listeye dön
              </Link>
              <button
                type="button"
                onClick={toggleAttachmentPanel}
                aria-expanded={isAttachmentPanelOpen}
                aria-controls="manual-ad-attachment-panel"
                className={cn(
                  "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-container text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-surface-container",
                  isAttachmentPanelOpen && "border-primary/30 bg-primary/10 text-primary",
                )}
                title="Kreatif ekle"
              >
                <Plus className={cn("h-4 w-4 transition-transform duration-200", isAttachmentPanelOpen && "rotate-45")} />
              </button>
              <button
                type="submit"
                disabled={!canSend}
                className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Mesajı gönder
              </button>
            </div>

            <div
              id="manual-ad-attachment-panel"
              className={cn(
                "grid overflow-hidden transition-all duration-200 ease-out",
                isAttachmentPanelOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="min-h-0 space-y-3 pt-2">
                <div className="space-y-3 rounded-2xl border border-border bg-surface-container p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Kreatif yükle</p>
                      <p className="mt-1 text-xs text-muted">Video, görsel veya ekran görüntüsü ekleyebilirsin.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isPreparingAttachments || selectedAttachments.length >= MAX_ATTACHMENT_COUNT}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors duration-200 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPreparingAttachments ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Dosya seç
                      </button>
                      {selectedAttachments.length > 0 ? (
                        <button
                          type="button"
                          onClick={handleClearAttachments}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-container px-3 py-1.5 text-xs font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-surface-container"
                        >
                          <X className="h-3.5 w-3.5" />
                          Temizle
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleAttachmentSelect}
                    className="hidden"
                  />

                  {selectedAttachments.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedAttachments.map((attachment, index) => (
                        <AttachmentCard
                          key={`${attachment.name}-${index}-${attachment.sourceSize}`}
                          attachment={attachment}
                          removable
                          onRemove={() => handleRemoveAttachment(index)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-surface-container p-3 text-xs text-muted">
                      Kreatif eklenirse model görseli de analiz eder.
                    </div>
                  )}

                  {attachmentError ? <p className="text-xs text-danger">{attachmentError}</p> : null}
                </div>
              </div>
            </div>
          </form>
        </GlassCard>
      </div>

      <div className="min-w-0 min-h-0 xl:h-full">
        <ManualAdCollectedContextPanel
          campaign={campaign}
          conversationState={conversationState}
          metrics={latestReport?.metrics ?? calculateManualAdMetrics(campaign, conversationState)}
          readyToReport={readyToReport}
          latestReport={latestReport}
          className="h-full min-h-0 overflow-y-auto"
        />
      </div>
    </div>
  );
}
