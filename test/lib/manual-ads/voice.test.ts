import { describe, expect, it } from "vitest";

import {
  mapManualAdSpeechError,
  normalizeManualAdSpeechText,
  pickPreferredManualAdVoice,
} from "@/lib/manual-ads/voice";

describe("manual ads voice helpers", () => {
  it("normalizes spoken text whitespace", () => {
    expect(normalizeManualAdSpeechText("  Merhaba   dünya\u00a0!  ")).toBe("Merhaba dünya !");
  });

  it("maps common speech recognition errors to Turkish messages", () => {
    expect(mapManualAdSpeechError("not-allowed")).toBe("Mikrofon izni verilmedi.");
    expect(mapManualAdSpeechError("no-speech")).toBe("Ses algılanmadı. Tekrar dene.");
  });

  it("prefers a Turkish voice when available", () => {
    const voices = [
      { lang: "en-US", name: "English" } as SpeechSynthesisVoice,
      { lang: "tr-TR", name: "Turkish" } as SpeechSynthesisVoice,
      { lang: "de-DE", name: "German" } as SpeechSynthesisVoice,
    ];

    expect(pickPreferredManualAdVoice(voices)?.name).toBe("Turkish");
  });
});
