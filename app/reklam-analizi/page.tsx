import { cookies } from "next/headers";

import { ManualAdsPage } from "@/components/manual-ads/ManualAdsPage";
import { TOKEN_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { listManualAdCampaignSummaries } from "@/lib/manual-ads/repository";

export const dynamic = "force-dynamic";

async function getManualAdCampaigns() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE_NAME)?.value;
  if (!token) {
    return [];
  }

  const user = await verifyToken(token);
  if (!user) {
    return [];
  }

  return listManualAdCampaignSummaries(user.userId);
}

export default async function ManualAdsListPage() {
  const campaigns = await getManualAdCampaigns();
  return <ManualAdsPage campaigns={campaigns} />;
}
