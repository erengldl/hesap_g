import { describe, expect, it } from "vitest";

import { getChannelRule, isSalesChannel, listChannelSeoRules } from "@/lib/channel-seo/channel-rules";

describe("channel seo rules", () => {
  it("returns rules for every supported channel", () => {
    const rules = listChannelSeoRules();

    expect(rules).toHaveLength(3);
    expect(rules.map((rule) => rule.id)).toEqual([
      "trendyol",
      "hepsiburada",
      "my_website",
    ]);
  });

  it("accepts supported sales channels", () => {
    expect(isSalesChannel("my_website")).toBe(true);
    expect(isSalesChannel("invalid-channel")).toBe(false);
  });

  it("throws for invalid channels", () => {
    expect(() => getChannelRule("my_website")).not.toThrow();
    expect(() => getChannelRule("invalid-channel" as never)).toThrow("Geçersiz satış kanalı");
  });
});
