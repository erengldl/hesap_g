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
  { name: "Anasayfa", href: "/dashboard", icon: LayoutDashboard, description: "Kısa genel bakış" },
  { name: "Ürünler", href: "/veri-merkezi", icon: Database, description: "Ürün ve ayarları yönet" },
  { name: "Tahmin", href: "/forecast", icon: TrendingUp, description: "Satış öngörüsü" },
  {
    name: "Kârlılık",
    href: "/profit-pricing",
    icon: ArrowRightLeft,
    description: "Kârlılık, maliyet ve fiyat kararları",
  },
];

export const advancedNavigationItems: NavigationItem[] = [
  { name: "Reklam", href: "/reklam-analizi", icon: Megaphone, description: "Reklam performansı" },
  { name: "SEO", href: "/channel-seo", icon: Sparkles, description: "Kanal bazlı SEO içerikleri" },
];

export const accountNavigationItems: NavigationItem[] = [
  { name: "Bağlantılar", href: "/integrations", icon: Link2, description: "Servis ve kanal bağlantıları" },
  { name: "Ayarlar", href: "/ayarlar", icon: Settings, description: "Profil ve uygulama tercihleri" },
];

export const navigationSections: NavigationSection[] = [
  { title: "Ana İşler", items: primaryNavigationItems },
  { title: "Diğer Araçlar", items: advancedNavigationItems },
];

export const navigationItems: NavigationItem[] = [...primaryNavigationItems, ...advancedNavigationItems];
