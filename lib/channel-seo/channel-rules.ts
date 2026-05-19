import type { SalesChannel } from "./types";

export type ChannelSeoRule = {
  id: SalesChannel;
  label: string;
  titleGuidance: string;
  descriptionGuidance: string;
  promptNotes: string[];
  fallbackTone: string;
};

const CHANNEL_RULES: Record<SalesChannel, ChannelSeoRule> = {
  trendyol: {
    id: "trendyol",
    label: "Trendyol",
    titleGuidance: "Net, satış odaklı, kategori ve ana özellik belirgin olsun. Spam tekrar yapma.",
    descriptionGuidance: "Kısa ama yüzeysel olmayan, fayda + özellik + kullanım alanı dengesini kuran 2-3 cümlelik açıklama yaz.",
    promptNotes: [
      "Kullanıcıyı hızlı karar vermeye yönlendiren kısa ve net bir dil kullan.",
      "Gereksiz tekrar ve aşırı anahtar kelime kullanımından kaçın.",
      "Başlıkta marka varsa doğal kullan, yoksa marka uydurma.",
    ],
    fallbackTone: "satış odaklı ve temiz",
  },
  hepsiburada: {
    id: "hepsiburada",
    label: "HepsiBurada",
    titleGuidance: "Daha açıklayıcı, güven veren ve düzenli bir başlık yaz.",
    descriptionGuidance: "Daha açıklayıcı, güven veren ve düzenli bir açıklama yaz. Gerekirse özellikleri maddeleyerek açıkça ver.",
    promptNotes: [
      "Marka, kullanım alanı ve fayda öne çıksın.",
      "Okunabilirliği yüksek, düzenli ve güven veren bir anlatım kullan.",
      "Teknik detaylar varsa kontrollü şekilde maddeleyebilirsin.",
    ],
    fallbackTone: "açıklayıcı ve güven veren",
  },
  my_website: {
    id: "my_website",
    label: "Kendi Websitem",
    titleGuidance: "Marka dili güçlü olabilir; kategori ve fayda doğal şekilde geçsin.",
    descriptionGuidance: "SEO açısından akıcı, detaylı ve dönüşüm odaklı bir açıklama yaz. Giriş, fayda, kullanım senaryosu ve ana özellikleri doğal sırayla anlat.",
    promptNotes: [
      "Anahtar kelimeleri doğal akış içinde kullan.",
      "Google sıralama garantisi gibi ifadeler kullanma.",
      "Kategori, kullanım senaryosu ve ana faydayı dengeli ver.",
    ],
    fallbackTone: "akıcı ve SEO uyumlu",
  },
};

export function isSalesChannel(value: unknown): value is SalesChannel {
  return (
    value === "trendyol" ||
    value === "hepsiburada" ||
    value === "my_website"
  );
}

export function getChannelRule(channel: SalesChannel): ChannelSeoRule {
  const rule = CHANNEL_RULES[channel];
  if (!rule) {
    throw new Error(`Geçersiz satış kanalı: ${String(channel)}`);
  }
  return rule;
}

export function listChannelSeoRules() {
  return Object.values(CHANNEL_RULES);
}

export function listChannelSeoOptions() {
  return listChannelSeoRules().map(({ id, label }) => ({ id, label }));
}

export function buildChannelRuleSummary(channel: SalesChannel) {
  const rule = getChannelRule(channel);
  return [
    `${rule.label}: ${rule.titleGuidance}`,
    rule.descriptionGuidance,
    ...rule.promptNotes,
  ];
}

export function buildChannelRulesBlock(channel: SalesChannel) {
  const rule = getChannelRule(channel);
  return [
    `${rule.label}:`,
    `- Başlık: ${rule.titleGuidance}`,
    `- Açıklama: ${rule.descriptionGuidance}`,
    ...rule.promptNotes.map((note) => `- ${note}`),
  ].join("\n");
}
