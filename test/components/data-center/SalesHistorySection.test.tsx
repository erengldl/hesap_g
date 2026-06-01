import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SalesHistorySection from "@/components/data-center/SalesHistorySection";
import type { Product } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const products: Product[] = [
  {
    id: 1,
    name: "Akıllı Saat",
    sku: "AKL-001",
    barcode: "",
    image_url: "",
    category_id: 10,
    category_path: "Elektronik > Saat",
    description: "",
    cost: 500,
    packaging_cost: 30,
    desi: 1,
    sale_price: 1299,
    stock: 18,
    active_channels: ["trendyol", "hepsiburada"],
    status: "active",
  },
];

const populatedPayload = {
  success: true,
  range_days: 90,
  applied_range: { from: "2026-03-03", to: "2026-05-31" },
  filters: {
    marketplace_options: [
      { marketplace_name: "Trendyol", marketplace_slug: "trendyol", order_count: 21 },
      { marketplace_name: "Hepsiburada", marketplace_slug: "hepsiburada", order_count: 8 },
    ],
  },
  pagination: { page: 1, page_size: 40, total_rows: 2, total_pages: 1 },
  summary: {
    total_orders: 29,
    total_units: 41,
    total_revenue: 23890,
    average_order_value: 823.79,
    unique_products: 1,
    active_marketplaces: 2,
    active_sales_days: 24,
    average_daily_units: 1.7,
  },
  trend: [
    { date: "2026-05-27", orders: 2, units: 3, revenue: 1799, marketplace: "Trendyol", missing: false },
    { date: "2026-05-28", orders: 0, units: 0, revenue: 0, marketplace: null, missing: true },
    { date: "2026-05-29", orders: 1, units: 2, revenue: 1299, marketplace: "Hepsiburada", missing: false },
  ],
  data_quality: {
    label: "Yeterli Veri",
    tone: "profit",
    summary: "Satış geçmişi tahmin modeli için yeterli kapsama sağlıyor.",
    forecast_readiness: "Forecast ve stok planlama için veri hazır görünüyor.",
    active_sales_days: 24,
    missing_days: 6,
    total_days: 30,
    completeness_ratio: 0.8,
    last_order_date: "2026-05-29",
    notes: ["24/30 günde satış hareketi var.", "6 gün satış görünmüyor.", "2 kanal satış sinyali üretiyor."],
  },
  sales_history: [
    {
      order_id: 101,
      order_date: "2026-05-29",
      status: "completed",
      external_order_number: "TY-101",
      external_package_number: "PK-101",
      marketplace_name: "Trendyol",
      marketplace_slug: "trendyol",
      product_id: 1,
      product_name: "Akıllı Saat",
      product_sku: "AKL-001",
      quantity: 2,
      unit_price: 649.5,
      line_total: 1299,
    },
    {
      order_id: 102,
      order_date: "2026-05-28",
      status: "processing",
      external_order_number: "HB-102",
      external_package_number: "PK-102",
      marketplace_name: "Hepsiburada",
      marketplace_slug: "hepsiburada",
      product_id: 1,
      product_name: "Akıllı Saat",
      product_sku: "AKL-001",
      quantity: 1,
      unit_price: 699,
      line_total: 699,
    },
  ],
};

const emptyPayload = {
  success: true,
  range_days: 90,
  applied_range: { from: "2026-03-03", to: "2026-05-31" },
  filters: { marketplace_options: [] },
  pagination: { page: 1, page_size: 40, total_rows: 0, total_pages: 0 },
  summary: {
    total_orders: 0,
    total_units: 0,
    total_revenue: 0,
    average_order_value: 0,
    unique_products: 0,
    active_marketplaces: 0,
    active_sales_days: 0,
    average_daily_units: 0,
  },
  trend: [],
  data_quality: {
    label: "Eksik Veri",
    tone: "loss",
    summary: "Satış geçmişi bulunmadığı için tahmin modeli güvenilir sinyal üretemez.",
    forecast_readiness: "Forecast kullanmadan önce satış verisi içe aktarın.",
    active_sales_days: 0,
    missing_days: 0,
    total_days: 0,
    completeness_ratio: 0,
    last_order_date: null,
    notes: ["Henüz satış hareketi görünmüyor."],
  },
  sales_history: [],
};

describe("SalesHistorySection", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(populatedPayload), { status: 200 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders the analytical sales history layout with quality badge, chart area, and compact table", async () => {
    render(<SalesHistorySection products={products} />);

    await waitFor(() => {
      expect(screen.getByText("Satış geçmişi, tahmin modeli ve stok riski hesaplamalarının temelidir.")).not.toBeNull();
    });

    expect(screen.getAllByText("Yeterli Veri").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Satış Verisi İçe Aktar" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Toplam Sipariş")).not.toBeNull();
    expect(screen.getByText("Toplam Ciro")).not.toBeNull();
    expect(screen.getByText("Aktif Satış Günü")).not.toBeNull();
    expect(screen.getByText("Ort. Günlük Adet")).not.toBeNull();
    expect(screen.getByText("Satış Trendi")).not.toBeNull();
    expect(screen.getByText("Veri kalitesi ve güven seviyesi")).not.toBeNull();
    expect(screen.getByPlaceholderText("Sipariş, ürün veya kanal ara")).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "Sipariş No" })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "Birim Fiyat" })).not.toBeNull();
    expect(screen.getAllByText("Akıllı Saat").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("Sipariş, ürün veya kanal ara"), {
      target: { value: "Hepsiburada" },
    });

    expect(screen.getByText("HB-102")).not.toBeNull();
  });

  it("shows the empty state and product CTA when no sales history exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(emptyPayload), { status: 200 }))
    );

    const onOpenProductsTab = vi.fn();
    render(<SalesHistorySection products={products} onOpenProductsTab={onOpenProductsTab} />);

    await waitFor(() => {
      expect(screen.getByText("Henüz satış geçmişi yok")).not.toBeNull();
    });

    expect(screen.getAllByRole("link", { name: "Satış Verisi İçe Aktar" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Ürünlere Git" }));
    expect(onOpenProductsTab).toHaveBeenCalledTimes(1);
  });
});
