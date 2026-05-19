import type { Metadata } from "next";

import { ChannelSeoCenterPage } from "@/components/channel-seo/ChannelSeoCenterPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SEO | Hesap G",
  description: "Veri merkezindeki ürünleri satış kanallarına göre SEO uyumlu başlık ve açıklamalarla optimize et.",
};

export default function ChannelSeoPage() {
  return <ChannelSeoCenterPage />;
}
