import {
  ArrowRightLeft,
  Database,
  LayoutDashboard,
  Megaphone,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type NavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export const primaryNavigationItems: NavigationItem[] = [
  { name: "Anasayfa", href: "/dashboard", icon: LayoutDashboard, description: "Kısa genel bakış" },
  { name: "Ürünler", href: "/veri-merkezi", icon: Database, description: "Ürün ve ayarları yönet" },
  { name: "Tahmin", href: "/forecast", icon: TrendingUp, description: "Satış öngörüsü" },
  {
    name: "Kârlılık",
    href: "/profit-pricing",
    icon: ArrowRightLeft,
    description: "Fiyat optimizasyonu ve net maliyet",
  },
];

export const advancedNavigationItems: NavigationItem[] = [
  { name: "Reklam", href: "/reklam-analizi", icon: Megaphone, description: "Reklam performansı" },
  { name: "SEO", href: "/channel-seo", icon: Sparkles, description: "Kanal bazlı SEO içerikleri" },
];

export const navigationItems: NavigationItem[] = [...primaryNavigationItems, ...advancedNavigationItems];
