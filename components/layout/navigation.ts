import {
  ArrowRightLeft,
  Database,
  LayoutDashboard,
  Link2,
  Megaphone,
  Sparkles,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type NavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export type NavigationSection = {
  title: string;
  items: NavigationItem[];
};

export const primaryNavigationItems: NavigationItem[] = [
  { name: "Başlangıç", href: "/dashboard", icon: LayoutDashboard, description: "Günün karar özeti ve aksiyonlar" },
  { name: "Veri Merkezi", href: "/veri-merkezi", icon: Database, description: "Ürün, katalog ve veri hazırlığını yönet" },
  {
    name: "Kârlılık",
    href: "/profit-pricing",
    icon: ArrowRightLeft,
    description: "Kârlılık, maliyet ve fiyat kararlarını yönet",
  },
  { name: "Tahmin", href: "/forecast", icon: TrendingUp, description: "Satış öngörülerini ve senaryoları incele" },
];

export const advancedNavigationItems: NavigationItem[] = [
  { name: "Reklam", href: "/reklam-analizi", icon: Megaphone, description: "Reklam performansını ve riskleri takip et" },
  { name: "SEO", href: "/channel-seo", icon: Sparkles, description: "Kanal bazlı içerik görünürlüğünü güçlendir" },
];

export const accountNavigationItems: NavigationItem[] = [
  { name: "Bağlantılar", href: "/integrations", icon: Link2, description: "Servis ve kanal bağlantılarını yönet" },
  { name: "Ayarlar", href: "/ayarlar", icon: Settings, description: "Profil, tema ve uygulama tercihlerini düzenle" },
];

export const navigationSections: NavigationSection[] = [
  { title: "Başla", items: primaryNavigationItems.slice(0, 2) },
  { title: "Analiz Et", items: primaryNavigationItems.slice(2) },
  { title: "Büyüt", items: advancedNavigationItems },
  { title: "Yönet", items: accountNavigationItems },
];

export const navigationItems: NavigationItem[] = [
  ...primaryNavigationItems,
  ...advancedNavigationItems,
  ...accountNavigationItems,
];
