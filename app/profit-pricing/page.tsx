import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function appendParams(searchParams: SearchParams) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    }
  }

  return params.toString();
}

export default async function ProfitPricingRedirectPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const query = appendParams(searchParams);
  redirect(`/net-maliyet-motoru${query ? `?${query}` : ""}`);
}
