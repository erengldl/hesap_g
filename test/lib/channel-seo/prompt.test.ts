import { describe, expect, it } from "vitest";

import { buildChannelSeoPrompt, buildChannelSeoSystemInstruction } from "@/lib/channel-seo/prompt";

describe("channel seo prompt", () => {
  const input = {
    product: {
      id: "1001",
      name: "Deneme Ürün",
      category: "Elektronik",
      brand: "BTK",
      sku: "SKU-1001",
      barcode: "8690000000001",
      baseDescription: "Mevcut ürün açıklaması.",
      features: ["Hızlı", "Dayanıklı"],
      attributes: { color: "Siyah" },
      price: 199.9,
      stock: 15,
      variants: ["S", "M"],
    },
    channel: "my_website" as const,
    existingTitle: "Eski başlık",
    existingDescription: "Eski açıklama",
    userInstructions: "Daha satış odaklı yaz.",
    tone: "professional" as const,
    keywords: ["seo", "ürün"],
    forbiddenWords: ["garanti"],
  };

  it("includes product name and channel rules", () => {
    const prompt = buildChannelSeoPrompt(input);

    expect(prompt).toContain("Deneme Ürün");
    expect(prompt).toContain("Kanal kuralları");
    expect(prompt).toContain("Kendi Websitem");
    expect(prompt).toContain("garanti");
  });

  it("includes json schema and no-invention rules", () => {
    const prompt = buildChannelSeoPrompt(input);

    expect(prompt).toContain("\"title\"");
    expect(prompt).toContain("\"description\"");
    expect(prompt).toContain("Bilgi uydurma");
    expect(prompt).toContain("JSON dışında açıklama yazma");
  });

  it("builds a strict system instruction", () => {
    const instruction = buildChannelSeoSystemInstruction("my_website");

    expect(instruction).toContain("SEO ve pazaryeri ürün içerik uzmanısın");
    expect(instruction).toContain("Sadece verilen ürün bilgilerine dayan");
    expect(instruction).toContain("Kendi Websitem");
  });
});
