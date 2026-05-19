import { handleCostBootstrap, handleCostCalculationRequest } from "./service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleCostBootstrap(request);
}

export async function POST(request: Request) {
  return handleCostCalculationRequest(request);
}
