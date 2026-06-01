import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StoreSettingsSection from "@/components/data-center/StoreSettingsSection";

const successMock = vi.fn();
const errorMock = vi.fn();
const warningMock = vi.fn();
const infoMock = vi.fn();

vi.mock("@/lib/toast", () => ({
  useToast: () => ({
    success: successMock,
    error: errorMock,
    warning: warningMock,
    info: infoMock,
  }),
}));

const baseSettings = {
  ownWebsite: {
    shippingCost: 89,
    paymentCommission: 3.49,
    packagingBehavior: "seller_pays" as const,
    freeShippingThreshold: 500,
  },
  expenses: {
    monthlyFixedExpenses: 12000,
    marketplaceExpenses: 1800,
    operationalCosts: 2400,
  },
  sellerProfile: {
    businessType: "Limited Şirket",
    defaultTaxAssumptions: 20,
    defaultMarginTarget: 28,
    expectedMonthlyOrderCount: 600,
  },
  calculationDefaults: {
    defaultCommission: 12.5,
    defaultPackagingCost: 16,
    defaultRiskThreshold: 18,
  },
};

function mockFetch(settings = baseSettings) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? "GET";

      if (url.includes("/api/data-center/store-settings") && method === "GET") {
        return new Response(JSON.stringify({ success: true, settings, missingFields: [] }), { status: 200 });
      }

      if (url.includes("/api/data-center/store-settings") && method === "PUT") {
        const payload = init?.body ? JSON.parse(String(init.body)) : settings;
        return new Response(
          JSON.stringify({
            success: true,
            settings: payload,
            missingFields: [],
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    })
  );
}

describe("StoreSettingsSection", () => {
  beforeEach(() => {
    mockFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders the compact two-column store settings layout", async () => {
    render(<StoreSettingsSection />);

    await waitFor(() => {
      expect(
        screen.getByText("Bu bilgiler tüm ürünlerin net kâr hesaplamasında kullanılır.")
      ).not.toBeNull();
    });

    expect(screen.getByText("Kendi Web Siteniz")).not.toBeNull();
    expect(screen.getByText("Mağaza Giderleri")).not.toBeNull();
    expect(screen.getByText("Satıcı Profili")).not.toBeNull();
    expect(screen.getByText("Hesap Varsayılanları")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Mağaza Bilgilerini Kaydet" })).not.toBeNull();
  });

  it("shows inline validation and warning feedback when a required assumption is cleared", async () => {
    render(<StoreSettingsSection />);

    await waitFor(() => {
      expect(screen.getByLabelText("Kargo Maliyeti")).not.toBeNull();
    });

    fireEvent.change(screen.getByLabelText("Kargo Maliyeti"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Mağaza Bilgilerini Kaydet" }));

    expect(screen.getByText("Bu varsayım gerekli.")).not.toBeNull();
    expect(warningMock).toHaveBeenCalled();
  });

  it("saves successfully and triggers the shared toast flow", async () => {
    render(<StoreSettingsSection />);

    await waitFor(() => {
      expect(screen.getByLabelText("Varsayılan Komisyon")).not.toBeNull();
    });

    fireEvent.change(screen.getByLabelText("Varsayılan Komisyon"), { target: { value: "13.75" } });
    fireEvent.click(screen.getByRole("button", { name: "Mağaza Bilgilerini Kaydet" }));

    await waitFor(() => {
      expect(successMock).toHaveBeenCalledWith(
        "Mağaza bilgileri kaydedildi.",
        "Net kâr varsayımları güncellendi."
      );
    });
  });
});
