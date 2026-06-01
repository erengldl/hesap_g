import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataCenterTabs } from "@/components/data-center/DataCenterTabs";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/data-center/ProductDataForm", () => ({
  default: () => null,
}));

vi.mock("@/components/data-center/SalesHistorySection", () => ({
  default: () => <div>Sales history mock</div>,
}));

vi.mock("@/components/data-center/StoreSettingsSection", () => ({
  default: () => <div>Store settings mock</div>,
}));

const populatedStatsPayload = {
  success: true,
  product_count: 2,
  active_product_count: 1,
  average_price: 1375,
  average_profit_margin: 24.8,
  last_bulk_sync_time: "2026-05-30T12:45:00.000Z",
  last_bulk_sync_scope: "all_products",
  last_bulk_sync_count: 2,
  last_bulk_sync_message: "Finans motoru güncellendi.",
};

const populatedProductsPayload = {
  success: true,
  products: [
    {
      id: 101,
      name: "Akıllı Saat",
      sku: "AKL-001",
      cost: 420,
      packaging_cost: 20,
      desi: 1,
      sale_price: 1690,
      stock: 4,
      active_channels: ["trendyol", "my_website"],
      status: "active",
      status_label: "Aktif",
      profit_margin_percent: 32.4,
      last_updated: "2026-05-30T14:00:00.000Z",
    },
    {
      id: 102,
      name: "Bluetooth Kulaklık",
      sku: "BLT-220",
      cost: 300,
      packaging_cost: 15,
      desi: 1,
      sale_price: 1060,
      stock: 18,
      active_channels: ["hepsiburada"],
      status: "draft",
      status_label: "Taslak",
      profit_margin_percent: 14.6,
      last_updated: "2026-05-29T08:30:00.000Z",
    },
  ],
  count: 2,
};

function mockFetchWith(productsPayload: unknown, statsPayload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/api/data-center/status")) {
        return new Response(JSON.stringify(statsPayload), { status: 200 });
      }

      if (url.includes("/api/products")) {
        return new Response(JSON.stringify(productsPayload), { status: 200 });
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    })
  );
}

describe("DataCenterTabs", () => {
  beforeEach(() => {
    mockFetchWith(populatedProductsPayload, populatedStatsPayload);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders the products workspace with helper card, compact stats, and dense financial table", async () => {
    render(<DataCenterTabs />);

    await waitFor(() => {
      expect(screen.getByText("Ürün verisi olmadan kârlılık ve tahmin hesapları başlamaz.")).not.toBeNull();
    });

    expect(screen.getByRole("button", { name: "Ürün Ekle" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Katalog Al" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Yeniden Hesapla" })).not.toBeNull();

    expect(screen.getByText("Toplam Ürün")).not.toBeNull();
    expect(screen.getByText("Aktif Ürün")).not.toBeNull();
    expect(screen.getByText("Ortalama Fiyat")).not.toBeNull();
    expect(screen.getByText("Ortalama Kâr Marjı")).not.toBeNull();

    expect(screen.getByPlaceholderText("Ürün, SKU veya kanal ara")).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "Satış Fiyatı" })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "Maliyet" })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "Marj" })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "Son Güncelleme" })).not.toBeNull();
    expect(screen.getAllByText("Kritik stok").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByLabelText("Akıllı Saat seç")[0]);

    expect(screen.getByText("1 ürün seçili")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Aktif" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Pasif" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Taslak" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Sil" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Temizle" })).not.toBeNull();
  });

  it("shows the explicit empty state when no products exist", async () => {
    mockFetchWith(
      { success: true, products: [], count: 0 },
      {
        success: true,
        product_count: 0,
        active_product_count: 0,
        average_price: 0,
        average_profit_margin: 0,
        last_bulk_sync_time: null,
        last_bulk_sync_scope: null,
        last_bulk_sync_count: 0,
      }
    );

    render(<DataCenterTabs />);

    await waitFor(() => {
      expect(screen.getByText("Henüz ürün eklemediniz")).not.toBeNull();
    });

    expect(
      screen.getByText("Ürün ekleyin veya katalog içe aktarın. Sonra kârlılık ve tahmin modülleri aktif hale gelir.")
    ).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "Ürün Ekle" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Katalog Al" }).length).toBeGreaterThan(0);
  });

  it("switches to the store settings tab shell", async () => {
    render(<DataCenterTabs />);

    await waitFor(() => {
      expect(screen.getByText("Ürün verisi olmadan kârlılık ve tahmin hesapları başlamaz.")).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Mağaza Bilgileri" }));

    expect(screen.getByText("Store settings mock")).not.toBeNull();
  });
});
