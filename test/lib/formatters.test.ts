import { describe, it, expect } from "vitest";
import { formatCurrency, formatDecimal, formatNumber, formatPercent } from "@/lib/formatters";

describe("formatters", () => {
  describe("formatCurrency", () => {
    it("should format numbers as TRY currency", () => {
      expect(formatCurrency(1499.99)).toContain("1.499");
      expect(formatCurrency(0)).toContain("0");
      expect(formatCurrency(-250)).toContain("-₺250");
    });

    it("should handle large numbers", () => {
      const result = formatCurrency(1000000);
      expect(result).toContain("1.000.000");
    });
  });

  describe("formatNumber", () => {
    it("should format integers with TR locale", () => {
      expect(formatNumber(1234)).toContain("1.234");
      expect(formatNumber(0)).toBe("0");
    });

    it("should handle negative numbers", () => {
      const result = formatNumber(-500);
      expect(result).toContain("-");
    });
  });

  describe("formatDecimal", () => {
    it("should format decimals with configurable precision", () => {
      expect(formatDecimal(2.666)).toBe("2,7");
      expect(formatDecimal(2, 1)).toBe("2");
      expect(formatDecimal(2.5, 2, 2)).toBe("2,50");
    });
  });

  describe("formatPercent", () => {
    it("should format percentage values", () => {
      expect(formatPercent(25.5)).toContain("25");
      expect(formatPercent(0)).toContain("0");
    });
  });
});
