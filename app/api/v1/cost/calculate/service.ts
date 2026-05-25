import { getProducts } from "@/lib/database-readers";
import {
  buildCostBootstrap,
  calculateAllChannels,
  calculateChannelCost,
  persistCostResults,
  type CalculationInput,
} from "@/lib/cost-engine";
import { persistNetCostDefaultsFromCalculation, persistNetCostDefaultsFromForm } from "@/lib/net-cost-defaults";
import { getMarketplaceById, getProductMarketplaceSetting } from "@/lib/database-readers";
import { NextResponse } from "next/server";

function resolveProductId(request: Request, body: Record<string, unknown>) {
  const url = new URL(request.url);
  const queryId = Number(url.searchParams.get("productId") ?? url.searchParams.get("product_id") ?? 0);
  const bodyProductId = Number(body.productId ?? body.product_id ?? 0);

  if (Number.isFinite(queryId) && queryId > 0) return queryId;
  if (Number.isFinite(bodyProductId) && bodyProductId > 0) return bodyProductId;
  return null;
}

function normalizeChannels(payload: unknown): CalculationInput["channels"] | null {
  if (!payload || typeof payload !== "object") return null;
  return payload as CalculationInput["channels"];
}

async function resolveSingleMarketplaceChannel(
  productId: number,
  product: CalculationInput["product"],
  body: Record<string, unknown>
) {
  const marketplaceId = Number(body.marketplaceId ?? body.marketplace_id ?? 0);
  if (!Number.isFinite(marketplaceId) || marketplaceId <= 0) {
    return null;
  }

  const marketplace = await getMarketplaceById(marketplaceId);
  if (!marketplace) {
    return null;
  }

  const productSetting = await getProductMarketplaceSetting(productId, marketplaceId);
  const salePrice = Number(body.salePrice ?? body.sale_price ?? productSetting?.sale_price ?? product.sale_price ?? 0);
  const carrierName = typeof body.carrierName === "string" ? body.carrierName : typeof body.carrier_name === "string" ? body.carrier_name : undefined;
  const shipmentType = body.shipmentType === "fast" ? "fast" : "normal";
  const adCost = Number(body.adCost ?? body.cpa ?? 0);
  const expectedReturnCost = Number(body.expectedReturnCost ?? body.expected_return_cost ?? 0);

  if (marketplace.slug === "own_website") {
    return {
      active: true,
      salePrice,
      carrierName: carrierName ?? "",
      shipmentType,
      adCost,
      fixedCost: 0,
      trafficSettings: body.trafficSettings as CalculationInput["channels"]["my_website"]["trafficSettings"] | undefined,
      expectedReturnCost,
      shippingCost: Number(body.manualShippingCost ?? body.manual_shipping_cost ?? productSetting?.manual_shipping_cost ?? 0),
      gatewayName: String(body.gatewayName ?? body.gateway_name ?? "Ödeme Altyapısı"),
      gatewayRate: Number(body.gatewayRate ?? body.gateway_rate ?? 0),
      gatewayFixedFee: Number(body.gatewayFixedFee ?? body.gateway_fixed_fee ?? 0),
    } as CalculationInput["channels"]["my_website"];
  }

  if (marketplace.name === "Trendyol" || marketplace.name === "Hepsiburada") {
    return {
      active: true,
      salePrice,
      carrierName: carrierName ?? "",
      shipmentType,
      adCost,
      fixedCost: 0,
      expectedReturnCost,
    } as CalculationInput["channels"]["trendyol"];
  }

  return null;
}

async function calculateWithBody(request: Request, body: Record<string, unknown>) {
  const productId = resolveProductId(request, body);
  if (!productId) {
    return NextResponse.json({ success: false, error: "Product id is required" }, { status: 400 });
  }

  const product = (await getProducts()).find((item) => item.id === productId);
  if (!product) {
    return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
  }

  if (body.persistDefaultsOnly === true) {
    const persisted = await persistNetCostDefaultsFromForm(productId, body);
    if (!persisted) {
      return NextResponse.json({ success: false, error: "Defaults could not be saved" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      persisted: true,
      product,
    });
  }

  const channels = normalizeChannels(body.channels);
  if (channels) {
    const calculation = await calculateAllChannels({
      product,
      channels,
    });

    if (!Array.isArray(calculation.results) || calculation.results.length === 0) {
      return NextResponse.json({ success: false, error: "At least one active channel is required" }, { status: 400 });
    }

    await persistCostResults(productId, calculation.results);
    await persistNetCostDefaultsFromCalculation(productId, body, calculation.results);

    return NextResponse.json({
      success: true,
      ...calculation,
    });
  }

  const singleChannel = await resolveSingleMarketplaceChannel(productId, product, body);
  if (singleChannel) {
    const marketplace = await getMarketplaceById(Number(body.marketplaceId ?? body.marketplace_id));
    const result = await calculateChannelCost(marketplace?.name ?? "Kendi Websitem", {
      product,
      salePrice: singleChannel.salePrice,
      carrierName: (singleChannel as CalculationInput["channels"]["trendyol"]).carrierName,
      shipmentType: (singleChannel as CalculationInput["channels"]["trendyol"]).shipmentType,
      adCost: (singleChannel as CalculationInput["channels"]["trendyol"]).adCost,
      fixedCost: 0,
      trafficSettings: (singleChannel as CalculationInput["channels"]["my_website"]).trafficSettings,
      expectedReturnCost: (singleChannel as CalculationInput["channels"]["trendyol"]).expectedReturnCost,
      manualShippingCost: (singleChannel as CalculationInput["channels"]["my_website"]).shippingCost,
      paymentGatewayRate: (singleChannel as CalculationInput["channels"]["my_website"]).gatewayRate,
      paymentGatewayFixedFee: (singleChannel as CalculationInput["channels"]["my_website"]).gatewayFixedFee,
      productSetting: await getProductMarketplaceSetting(productId, Number(body.marketplaceId ?? body.marketplace_id)),
    });

    if (!result) {
      return NextResponse.json({ success: false, error: "Calculation failed" }, { status: 500 });
    }

    await persistCostResults(productId, [result]);
    await persistNetCostDefaultsFromCalculation(productId, body, [result]);

    return NextResponse.json({
      success: true,
      results: [result],
      bestChannel: result,
      trafficThresholds: [],
      product,
    });
  }

  return NextResponse.json({ success: false, error: "No calculation payload provided" }, { status: 400 });
}

export async function handleCostBootstrap(request: Request) {
  const url = new URL(request.url);
  const productId = Number(url.searchParams.get("productId") ?? url.searchParams.get("product_id") ?? 0);
  const bootstrap = await buildCostBootstrap(Number.isFinite(productId) && productId > 0 ? productId : undefined);

  return NextResponse.json({
    success: true,
    ...bootstrap,
  });
}

export async function handleCostCalculationRequest(request: Request) {
  try {
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    return await calculateWithBody(request, body as Record<string, unknown>);
  } catch (error) {
    console.error("Cost calculation error:", error);
    return NextResponse.json({ success: false, error: "Calculation failed" }, { status: 500 });
  }
}
