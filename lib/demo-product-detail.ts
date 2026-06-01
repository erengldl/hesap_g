import { DEMO_PRODUCTS } from "@/lib/demo-data";
import { buildProductDescriptionFallback, summarizeProductTrend } from "@/lib/product-history";

type DemoProduct = (typeof DEMO_PRODUCTS)[number];

type DemoTrendRow = {
  date: string;
  label: string;
  units: number;
  revenue: number;
  order_count: number;
};

type DemoOrderRow = {
  order_id: number;
  order_date: string;
  marketplace_name: string;
  external_order_number: string | null;
  external_package_number: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  status: string | null;
  merchant_sku: string | null;
  barcode: string | null;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function roundWhole(value: number) {
  return Math.max(0, Math.round(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = Math.abs(Math.trunc(seed)) % 2147483647;
  if (state === 0) {
    state = 1;
  }

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function stripTime(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveDemoProduct(productId: number): DemoProduct {
  return (
    DEMO_PRODUCTS.find((item) => item.id === productId) ??
    DEMO_PRODUCTS[(Math.max(1, productId) - 1) % DEMO_PRODUCTS.length] ??
    DEMO_PRODUCTS[0]
  );
}

function buildDemoSalesTrend(productId: number, product: DemoProduct, days: 30 | 90): DemoTrendRow[] {
  const end = stripTime(new Date());
  const start = addDays(end, -(days - 1));
  const slope = [0.16, 0.08, -0.05, 0.11, 0.18][(productId - 1) % 5] ?? 0.08;
  const phase = (((productId * 53) % 360) * Math.PI) / 180;
  const baseUnits = clamp(
    roundWhole(4.5 + product.sale_price / 180 + Math.max(0, 1200 - product.cost) / 280 + product.desi * 1.2 + productId * 0.35),
    3,
    24
  );
  const weeklyWeights = [0.82, 0.9, 0.98, 1.04, 1.15, 1.28, 1.18];

  const series: DemoTrendRow[] = [];
  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const currentDate = addDays(start, dayIndex);
    const dateKey = toDateKey(currentDate);
    const rand = seededRandom(hashText(`${productId}:${days}:${dateKey}`));
    const weekly = weeklyWeights[currentDate.getDay()] ?? 1;
    const monthly = 1 + 0.15 * Math.sin(dayIndex / 11 + phase);
    const trend = 1 + slope * (dayIndex / Math.max(1, days - 1) - 0.45);
    const promoWave = dayIndex >= Math.floor(days * 0.7) && dayIndex <= Math.floor(days * 0.84) ? 1.12 : 1;
    const noise = 0.86 + rand() * 0.3;
    const units = Math.max(0, Math.round(baseUnits * weekly * monthly * trend * promoWave * noise));
    const revenue = round2(units * product.sale_price * (0.985 + rand() * 0.03));
    const orderCount = units > 0 ? Math.max(1, Math.round(units / (1 + rand() * 1.4))) : 0;

    series.push({
      date: dateKey,
      label: new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(currentDate),
      units,
      revenue,
      order_count: orderCount,
    });
  }

  return series;
}

function buildDemoOrderHistory(productId: number, product: DemoProduct, limit = 24): DemoOrderRow[] {
  const end = stripTime(new Date());
  const channelCycle = [
    { marketplace_name: "Trendyol", prefix: "TY" },
    { marketplace_name: "Hepsiburada", prefix: "HB" },
    { marketplace_name: "Kendi Websitem", prefix: "WEB" },
  ];
  const statusCycle = ["completed", "completed", "completed", "completed", "processing", "returned", "cancelled"];

  const rows: DemoOrderRow[] = [];
  for (let index = 0; index < limit; index += 1) {
    const currentDate = addDays(end, -index);
    const dateKey = toDateKey(currentDate);
    const rand = seededRandom(hashText(`${productId}:order:${dateKey}`));
    const channel = channelCycle[(productId + index) % channelCycle.length] ?? channelCycle[0];
    const quantity = 1 + Math.floor(rand() * 3);
    const unitPrice = round2(product.sale_price * (0.97 + rand() * 0.08));
    const lineTotal = round2(quantity * unitPrice);
    const status = statusCycle[Math.min(statusCycle.length - 1, Math.floor(rand() * statusCycle.length))];
    const orderToken = `${channel.prefix}-${productId}-${dateKey.replace(/-/g, "")}-${String(index + 1).padStart(2, "0")}`;

    rows.push({
      order_id: productId * 1000 + index + 1,
      order_date: dateKey,
      marketplace_name: channel.marketplace_name,
      external_order_number: `DEMO-${orderToken}`,
      external_package_number: `DEMO-${orderToken}-PKG`,
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      status,
      merchant_sku: product.sku ?? null,
      barcode: product.barcode ?? product.sku ?? null,
    });
  }

  return rows;
}

function buildDemoChannels(product: DemoProduct) {
  const channelSpecs = [
    {
      marketplace_id: 1,
      channelName: "Trendyol",
      slug: "trendyol",
      saleMultiplier: 1,
      shipping: 18,
      commissionRate: 0.16,
      platformFee: 13.2,
      paymentGateway: 0,
      adCost: 0,
      mode: "marketplace_rate",
      shippingCompanyId: 1,
    },
    {
      marketplace_id: 2,
      channelName: "Hepsiburada",
      slug: "hepsiburada",
      saleMultiplier: 0.995,
      shipping: 20,
      commissionRate: 0.14,
      platformFee: 18.6,
      paymentGateway: 0,
      adCost: 0,
      mode: "marketplace_rate",
      shippingCompanyId: 2,
    },
    {
      marketplace_id: 3,
      channelName: "Kendi Websitem",
      slug: "my_website",
      saleMultiplier: 1.02,
      shipping: 24,
      commissionRate: 0.035,
      platformFee: 0,
      paymentGateway: 26.4,
      adCost: 80,
      mode: "manual",
      shippingCompanyId: null as number | null,
    },
  ] as const;

  return channelSpecs.map((spec) => {
    const salePrice = round2(product.sale_price * spec.saleMultiplier);
    const commission = round2(salePrice * spec.commissionRate);
    const totalCost = round2(
      product.cost +
      product.packaging_cost +
      spec.shipping +
      commission +
      spec.platformFee +
      spec.paymentGateway +
      spec.adCost
    );
    const netProfit = round2(salePrice - totalCost);
    const margin = salePrice > 0 ? round2((netProfit / salePrice) * 100) : 0;

    return {
      channelName: spec.channelName,
      slug: spec.slug,
      salePrice,
      buyboxPrice: round2(salePrice * 0.95),
      shippingCompanyId: spec.shippingCompanyId,
      shipping: spec.shipping,
      commission,
      mode: spec.mode,
      totalCost,
      netProfit,
      margin,
      warningNotes: margin < 15 ? "Demo fallback: marj düşük." : null,
    };
  });
}

export function buildDemoProductDetailResponse(productId: number) {
  const product = resolveDemoProduct(productId);
  const channels = buildDemoChannels(product);
  const marginSnapshots = channels
    .map((channel) => ({
      marketplace_id: channel.slug === "trendyol" ? 1 : channel.slug === "hepsiburada" ? 2 : 3,
      marketplace_name: channel.channelName,
      marketplace_slug: channel.slug === "my_website" ? "own_website" : channel.slug,
      list_price: channel.salePrice,
      total_unit_cost: channel.totalCost,
      net_profit: channel.netProfit,
      profit_margin_percent: channel.margin,
      warning_notes: channel.warningNotes,
    }))
    .sort((left, right) => Number(right.profit_margin_percent ?? 0) - Number(left.profit_margin_percent ?? 0));
  const salesTrend30 = buildDemoSalesTrend(productId, product, 30);
  const salesTrend90 = buildDemoSalesTrend(productId, product, 90);
  const salesSummary30 = summarizeProductTrend(salesTrend30);
  const salesSummary90 = summarizeProductTrend(salesTrend90);
  const orderHistory = buildDemoOrderHistory(productId, product, 24);
  const bestChannel = marginSnapshots[0] ?? null;
  const marginStatus =
    bestChannel && bestChannel.profit_margin_percent >= 30
      ? "healthy"
      : bestChannel && bestChannel.profit_margin_percent >= 15
        ? "watch"
        : "risk";

  return {
    success: true,
    product: {
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode ?? product.sku,
      categoryPath: product.category_path,
      categoryName: product.category_name,
      imageUrl: product.image_url,
      description: product.description ?? buildProductDescriptionFallback({
        name: product.name,
        category_path: product.category_path ?? undefined,
        category_name: product.category_name ?? undefined,
        cost: Number(product.cost ?? 0),
        packaging_cost: Number(product.packaging_cost ?? 0),
        sale_price: Number(product.sale_price ?? 0),
      }),
      cost: product.cost,
      packagingCost: product.packaging_cost,
      desi: product.desi,
      status: product.status,
      stock: Math.max(12, Math.round(140 - product.cost / 5)),
    },
    channels,
    marginSnapshots,
    marginStatus,
    salesTrend30,
    salesTrend90,
    salesSummary30,
    salesSummary90,
    orderHistory,
    warning: "Veritabanı kullanılamadı, demo veri döndürüldü.",
  };
}
