export type DemoProductSeed = {
  name: string;
  sku: string;
  barcode?: string;
  categoryPath: string;
  fallbackCategoryId: number;
  cost: number;
  packagingCost: number;
  desi: number;
  salePrice: number;
  activeChannels: string[];
  status: "active" | "passive" | "draft";
  imageUrl: string;
  description: string;
};

/**
 * 5 Demo Products — sale prices are derived to stay roughly 4-5x above cost.
 * Sale price formula: round(cost * 4.5 + packagingCost)
 */
export function deriveDemoSalePrice(cost: number, packagingCost: number) {
  return Math.round(cost * 4.5 + packagingCost);
}

export const DEMO_PRODUCT_SEEDS: DemoProductSeed[] = [
  {
    name: "Demo Akıllı Saat Neo S1",
    sku: "DEMO-WTCH-001",
    barcode: "869100000001",
    categoryPath: "Elektronik > Giyilebilir Teknoloji > Akıllı Saat",
    fallbackCategoryId: 1890,
    cost: 542,
    packagingCost: 20,
    desi: 3,
    salePrice: 749,
    activeChannels: ["trendyol", "hepsiburada", "my_website"],
    status: "active",
    imageUrl: "/demo-products/product-01.jpg",
    description: "Metalik çerçeveli, günlük kullanıma uygun, adım sayma ve bildirim özellikli demo akıllı saat. Premium ürün kartı ve kârlılık akışı testleri için kullanılır.",
  },
  {
    name: "Demo TWS Kulaklık Pulse X",
    sku: "DEMO-AUD-002",
    barcode: "869100000002",
    categoryPath: "Elektronik > Giyilebilir Teknoloji > Kulaklıklar > Kulak içi TWS Bluetooth Kulaklık",
    fallbackCategoryId: 1058,
    cost: 389,
    packagingCost: 18,
    desi: 1,
    salePrice: 549,
    activeChannels: ["trendyol", "hepsiburada", "my_website"],
    status: "active",
    imageUrl: "/demo-products/product-02.jpg",
    description: "Gürültü azaltmalı, şarj kutulu ve kompakt tasarımlı demo kablosuz kulaklık. Satış trendi ve kanal bazlı dönüşüm testleri için ideal.",
  },
  {
    name: "Demo Bluetooth Kulaklık Air Pro",
    sku: "DEMO-AUD-003",
    barcode: "869100000003",
    categoryPath: "Elektronik > Giyilebilir Teknoloji > Kulaklıklar > Kulak üstü Bluetooth Kulaklık",
    fallbackCategoryId: 5195,
    cost: 785,
    packagingCost: 22,
    desi: 1.4,
    salePrice: 1099,
    activeChannels: ["trendyol", "hepsiburada", "my_website"],
    status: "active",
    imageUrl: "/demo-products/product-03.jpg",
    description: "Yastıklı kulak bölgesi, uzun pil ömrü ve güçlü bas karakteriyle öne çıkan demo kulak üstü kulaklık. Marj optimizasyonu için kullanılır.",
  },
  {
    name: "Demo Akıllı Bileklik Fit Max",
    sku: "DEMO-BAND-004",
    barcode: "869100000004",
    categoryPath: "Elektronik > Giyilebilir Teknoloji > Akıllı Bileklik",
    fallbackCategoryId: 1889,
    cost: 347,
    packagingCost: 15,
    desi: 1.2,
    salePrice: 499,
    activeChannels: ["trendyol", "hepsiburada", "my_website"],
    status: "active",
    imageUrl: "/demo-products/product-04.jpg",
    description: "Günlük aktivite ve uyku takibi için tasarlanmış hafif demo akıllı bileklik. Talep tahmini ve sezonluk trend senaryolarını test eder.",
  },
  {
    name: "Demo Zincir Kolye Lumi",
    sku: "DEMO-JWL-005",
    barcode: "869100000005",
    categoryPath: "Aksesuar > Takı > Kolye",
    fallbackCategoryId: 2840,
    cost: 188,
    packagingCost: 12,
    desi: 0.3,
    salePrice: 279,
    activeChannels: ["trendyol", "hepsiburada", "my_website"],
    status: "active",
    imageUrl: "/demo-products/product-05.jpg",
    description: "Zarif zincir detaylara sahip, minimal kutu ambalajlı demo kolye. Ürün detay sayfası, satış geçmişi ve kâr marjı akışları için kullanılır.",
  },
];
