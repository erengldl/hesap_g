export type ManualAdSpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: ManualAdSpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: ManualAdSpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

export type ManualAdSpeechRecognitionCtor = new () => ManualAdSpeechRecognitionLike;

export type ManualAdSpeechRecognitionResultEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<ManualAdSpeechRecognitionResultListLike>;
};

export type ManualAdSpeechRecognitionResultListLike = ArrayLike<ManualAdSpeechRecognitionResultLike> & {
  item: (index: number) => ManualAdSpeechRecognitionResultLike | null;
  isFinal: boolean;
};

export type ManualAdSpeechRecognitionResultLike = {
  transcript: string;
  confidence?: number;
};

export type ManualAdSpeechRecognitionErrorEventLike = Event & {
  error?: string;
};

function getWindowSpeechRecognitionCtor() {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as Window & {
    SpeechRecognition?: ManualAdSpeechRecognitionCtor;
    webkitSpeechRecognition?: ManualAdSpeechRecognitionCtor;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function getManualAdSpeechRecognitionCtor(): ManualAdSpeechRecognitionCtor | null {
  return getWindowSpeechRecognitionCtor();
}

export function supportsManualAdSpeechInput() {
  return Boolean(getWindowSpeechRecognitionCtor());
}

export function supportsManualAdSpeechOutput() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function normalizeManualAdSpeechText(value: string) {
  return value.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
}

export function mapManualAdSpeechError(error: string | undefined) {
  switch (error) {
    case "no-speech":
      return "Ses algılanmadı. Tekrar dene.";
    case "audio-capture":
      return "Mikrofon bulunamadı.";
    case "not-allowed":
    case "service-not-allowed":
      return "Mikrofon izni verilmedi.";
    case "network":
      return "Ses servisine ulaşılamadı.";
    default:
      return "Sesli giriş başlatılamadı.";
  }
}

export function pickPreferredManualAdVoice(voices: SpeechSynthesisVoice[]) {
  if (voices.length === 0) {
    return null;
  }

  const normalized = (voice: SpeechSynthesisVoice) => voice.lang.toLocaleLowerCase("en-US");

  return (
    voices.find((voice) => normalized(voice) === "tr-tr") ??
    voices.find((voice) => normalized(voice).startsWith("tr")) ??
    voices.find((voice) => voice.name.toLocaleLowerCase("en-US").includes("turkish")) ??
    voices[0] ??
    null
  );
}

export function speakManualAdText(
  text: string,
  options: {
    onEnd?: () => void;
    onError?: () => void;
  } = {}
) {
  if (typeof window === "undefined" || !supportsManualAdSpeechOutput()) {
    options.onError?.();
    return false;
  }

  const content = normalizeManualAdSpeechText(text);
  if (!content) {
    options.onError?.();
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = "tr-TR";
  utterance.rate = 0.98;
  utterance.pitch = 1;
  utterance.onend = () => options.onEnd?.();
  utterance.onerror = () => options.onError?.();

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = pickPreferredManualAdVoice(voices);
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopManualAdSpeech() {
  if (typeof window === "undefined" || !supportsManualAdSpeechOutput()) {
    return;
  }

  window.speechSynthesis.cancel();
}
