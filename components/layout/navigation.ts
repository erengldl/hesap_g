import {
  ArrowRightLeft,
  Calculator,
  Database,
  History,
  LayoutDashboard,
  Link2,
  Settings2,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type NavigationLink = {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export type NavigationSection = {
  name: string;
  icon: LucideIcon;
  description: string;
  href?: string;
  links?: NavigationLink[];
};

function createLink(name: string, href: string, icon: LucideIcon, description: string): NavigationLink {
  return { name, href, icon, description };
}

export const sidebarNavigationSections: NavigationSection[] = [
  {
    name: "Anasayfa",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Kısa genel bakış",
  },
  {
    name: "Veri Merkezi",
    icon: Database,
    description: "Ürünler, satış geçmişi ve mağaza ayarları",
    links: [
      createLink("Ürünler", "/veri-merkezi", Database, "Ürün listesi"),
      createLink("Satış Geçmişi", "/veri-merkezi?tab=sales", History, "Geçmiş siparişler"),
      createLink("Mağaza Ayarları", "/veri-merkezi?tab=settings", Settings2, "Mağaza ve operasyon ayarları"),
    ],
  },
  {
    name: "Tahmin",
    href: "/forecast",
    icon: TrendingUp,
    description: "Satış öngörüsü",
  },
  {
    name: "Kârlılık",
    icon: ArrowRightLeft,
    description: "Fiyat optimizasyonu ve net maliyet",
    links: [
      createLink("Fiyat Optimizasyonu", "/profit-pricing", Sparkles, "Fiyat ve marj optimizasyonu"),
      createLink("Net Maliyet", "/net-maliyet-motoru", Calculator, "Gerçek kanal maliyeti"),
    ],
  },
  {
    name: "Entegrasyon",
    href: "/integrations",
    icon: Link2,
    description: "Bağlantılar",
  },
];

export const navigationItems: NavigationLink[] = sidebarNavigationSections.flatMap((section) => {
  if (section.links && section.links.length > 0) {
    return section.links;
  }

  if (section.href) {
    return createLink(section.name, section.href, section.icon, section.description);
  }

  return [];
});

function splitNavigationHref(href: string) {
  const [pathname, query = ""] = href.split("?");
  return {
    pathname,
    queryParams: new URLSearchParams(query),
  };
}

export function matchesNavigationHref(pathname: string, searchParamsString: string, href: string) {
  const { pathname: targetPathname, queryParams } = splitNavigationHref(href);
  const queryParamCount = Array.from(queryParams.keys()).length;
  const pathMatches = pathname === targetPathname || pathname.startsWith(`${targetPathname}/`);

  if (!pathMatches) {
    return false;
  }

  if (queryParamCount === 0) {
    return true;
  }

  const currentSearchParams = new URLSearchParams(searchParamsString);
  for (const [key, value] of queryParams.entries()) {
    if (currentSearchParams.get(key) !== value) {
      return false;
    }
  }

  return true;
}

export function findBestMatchingNavigationItem(
  pathname: string,
  searchParamsString: string,
  items: NavigationLink[] = navigationItems
) {
  let bestItem: NavigationLink | null = null;
  let bestScore = -1;

  for (const item of items) {
    if (!matchesNavigationHref(pathname, searchParamsString, item.href)) {
      continue;
    }

    const { pathname: targetPathname, queryParams } = splitNavigationHref(item.href);
    const score = Array.from(queryParams.keys()).length * 1000 + targetPathname.length;
    if (score > bestScore) {
      bestItem = item;
      bestScore = score;
    }
  }

  return bestItem;
}

export function isSectionActive(section: NavigationSection, pathname: string, searchParamsString: string) {
  if (section.href) {
    return matchesNavigationHref(pathname, searchParamsString, section.href);
  }

  return Boolean(section.links?.some((link) => matchesNavigationHref(pathname, searchParamsString, link.href)));
}
