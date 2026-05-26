import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SeoPage from "@/app/seo/page";

describe("SeoPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nested SEO payloads returned by the API route", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            audits: [
              {
                id: 1,
                audit_type: "product",
                target_type: "product",
                target_label: "Demo Ürün",
                status: "completed",
                overall_score: 84,
                critical_issues_count: 0,
                warning_issues_count: 1,
                opportunities_count: 2,
                missing_meta_count: 0,
                schema_status: "valid",
                created_at: "2026-05-27T12:00:00.000Z",
              },
            ],
            keywordStats: {
              total: 12,
              avgVolume: 2200,
              avgDifficulty: 41,
              avgOpportunity: 77,
            },
            recSummary: [
              { status: "completed", count: 3 },
              { status: "applied", count: 2 },
              { status: "pending", count: 1 },
            ],
            products: [{ id: 101, name: "Demo Ürün", sku: "DEMO-001" }],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      ) as Response
    );

    render(<SeoPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/seo", { cache: "no-store" });
    });

    expect(await screen.findByText("Kelime özeti")).not.toBeNull();
    expect(screen.getByText("Öneriler")).not.toBeNull();
    expect(screen.getAllByText("Demo Ürün").length).toBeGreaterThan(0);
    expect(screen.queryByText("Henüz analiz yok")).toBeNull();
  });
});
