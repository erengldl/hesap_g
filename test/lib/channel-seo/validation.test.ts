import { describe, expect, it } from "vitest";

import {
  validateChannelSeoContentInput,
  validateChannelSeoSavePayload,
  validateChannelSeoBulkRequest,
} from "@/lib/channel-seo/validation";

describe("channel seo validation", () => {
  it("rejects empty product id", () => {
    const result = validateChannelSeoContentInput({
      productId: "",
      channel: "my_website",
      title: "Başlık",
      description: "Açıklama",
      status: "draft",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.productId).toContain("productId boş olamaz.");
    }
  });

  it("rejects invalid channel", () => {
    const result = validateChannelSeoContentInput({
      productId: "123",
      channel: "invalid",
      title: "Başlık",
      description: "Açıklama",
      status: "draft",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.channel).toContain("Satış kanalı geçerli olmalıdır.");
    }
  });

  it("rejects blank title and description when saving", () => {
    const result = validateChannelSeoSavePayload({
      items: [
        {
          productId: "123",
          channel: "my_website",
          title: "",
          description: "",
          status: "draft",
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors["items[0].title"]).toContain("Başlık boş olamaz.");
      expect(result.errors["items[0].description"]).toContain("Açıklama boş olamaz.");
    }
  });

  it("rejects invalid bulk requests", () => {
    const result = validateChannelSeoBulkRequest({
      productIds: [],
      channels: [],
      overwriteExisting: false,
    });

    expect(result.ok).toBe(false);
  });
});
