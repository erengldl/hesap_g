import { describe, expect, it } from "vitest";

import { looksLikeEnglishReportText } from "@/lib/manual-ads/report-generator";

describe("manual ads report language detection", () => {
  it("flags strongly english report text", () => {
    expect(
      looksLikeEnglishReportText([
        "This campaign is strong and should scale.",
        "The creative looks good and the audience fit is clear.",
        "Budget should increase because the performance is positive.",
      ])
    ).toBe(true);
  });

  it("does not flag Turkish report text", () => {
    expect(
      looksLikeEnglishReportText([
        "Bu kampanya güçlü görünüyor.",
        "Kreatif net ve hedef kitle uyumu iyi.",
        "Bütçeyi kademeli artırmak mantıklı.",
      ])
    ).toBe(false);
  });
});
