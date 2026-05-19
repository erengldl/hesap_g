import { afterEach, describe, expect, it, vi } from "vitest";

import { generateChannelSeoContent, ChannelSeoGeneratorError } from "@/lib/channel-seo/generator";

const baseInput = {
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("channel seo generator", () => {
  it("parses a valid gemini json response", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "test-model";

    const responseBody = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  title: "Deneme Ürün - SEO Başlık",
                  description: "Satış odaklı açıklama.",
                  seoScore: 84,
                  keywords: ["seo", "ürün"],
                  warnings: [],
                  notes: ["Kısa not"],
                }),
              },
            ],
          },
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => responseBody,
      }))
    );

    const output = await generateChannelSeoContent(baseInput);

    expect(output.title).toBe("Deneme Ürün - SEO Başlık");
    expect(output.description).toBe("Satış odaklı açıklama.");
    expect(output.seoScore).toBe(84);
    expect(output.keywords).toEqual(["seo", "ürün"]);
  });

  it("fills missing fields with safe fallback content", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "test-model";

    const responseBody = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  title: "",
                  description: "",
                  seoScore: 20,
                  keywords: [],
                  warnings: [],
                  notes: [],
                }),
              },
            ],
          },
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => responseBody,
      }))
    );

    const output = await generateChannelSeoContent(baseInput);

    expect(output.title.length).toBeGreaterThan(0);
    expect(output.description.length).toBeGreaterThan(0);
    expect(output.seoScore).toBeGreaterThanOrEqual(0);
  });

  it("throws a generator error with fallback for broken json", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "test-model";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "bozuk json" }],
              },
            },
          ],
        }),
      }))
    );

    await expect(generateChannelSeoContent(baseInput)).rejects.toMatchObject({
      name: "ChannelSeoGeneratorError",
    });

    try {
      await generateChannelSeoContent(baseInput);
    } catch (error) {
      expect(error).toBeInstanceOf(ChannelSeoGeneratorError);
      if (error instanceof ChannelSeoGeneratorError) {
        expect(error.fallback).toBeDefined();
        expect(error.fallback?.title.length).toBeGreaterThan(0);
      }
    }
  });
});
