import { cookies } from "next/headers";

import { ManualAdsPage } from "@/components/manual-ads/ManualAdsPage";
import { getAuthenticatedUserFromCookieHeader } from "@/lib/request-auth";
import { listManualAdCampaignSummaries } from "@/lib/manual-ads/repository";

export const dynamic = "force-dynamic";

async function getManualAdCampaigns() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const user = await getAuthenticatedUserFromCookieHeader(cookieHeader);
  if (!user) {
    return [];
  }

  return listManualAdCampaignSummaries(user.userId);
}

export default async function ManualAdsListPage() {
  const campaigns = await getManualAdCampaigns();
  return <ManualAdsPage campaigns={campaigns} />;
}
