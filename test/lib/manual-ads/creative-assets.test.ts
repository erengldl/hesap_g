import { describe, expect, it } from "vitest";

import {
  buildManualAdGeminiInlineDataParts,
  inferManualAdCreativeFormatFromAttachments,
  sanitizeManualAdCreativeAttachments,
  summarizeManualAdCreativeAttachments,
} from "@/lib/manual-ads/creative-assets";
import type { ManualAdCreativeAttachment } from "@/lib/manual-ads/types";

function buildAttachment(kind: ManualAdCreativeAttachment["kind"], name: string): ManualAdCreativeAttachment {
  return {
    kind,
    name,
    sourceMimeType: kind === "video" ? "video/mp4" : "image/png",
    previewMimeType: "image/jpeg",
    previewDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==",
    sourceSize: 2048,
  };
}

describe("manual ads creative assets", () => {
  it("infers video creative when a video attachment is present", () => {
    const attachments = [buildAttachment("image", "creative.png"), buildAttachment("video", "creative.mp4")];

    expect(inferManualAdCreativeFormatFromAttachments(attachments)).toBe("video");
    expect(summarizeManualAdCreativeAttachments(attachments)).toContain("video");
  });

  it("sanitizes invalid creative attachment payloads", () => {
    const attachments = sanitizeManualAdCreativeAttachments([
      buildAttachment("image", "creative.png"),
      {
        kind: "image",
        name: "",
        sourceMimeType: "image/png",
        previewMimeType: "image/jpeg",
        previewDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==",
        sourceSize: 2048,
      },
    ]);

    expect(attachments).toHaveLength(1);
  });

  it("builds Gemini inline data parts from attachment previews", () => {
    const parts = buildManualAdGeminiInlineDataParts([buildAttachment("image", "creative.png")]);

    expect(parts).toHaveLength(1);
    expect(parts[0]?.inlineData.mimeType).toBe("image/jpeg");
  });
});
