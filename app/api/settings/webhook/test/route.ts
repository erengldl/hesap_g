import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/request-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WebhookTestBody = {
  webhookUrl?: string;
  sampleEvent?: Record<string, unknown>;
};

function isPrivateIpAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");

  if (normalized === "127.0.0.1" || normalized === "0.0.0.0" || normalized === "::1") {
    return true;
  }

  if (/^10\./.test(normalized) || /^192\.168\./.test(normalized)) {
    return true;
  }

  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) {
    return true;
  }

  if (/^169\.254\./.test(normalized)) {
    return true;
  }

  return normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

async function isUnsafeWebhookTarget(parsedUrl: URL): Promise<boolean> {
  const hostname = parsedUrl.hostname.trim().toLowerCase();

  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    return true;
  }

  if (isIP(hostname)) {
    return isPrivateIpAddress(hostname);
  }

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.some((entry) => isPrivateIpAddress(entry.address));
  } catch {
    return true;
  }
}

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Yetkisiz erisim." }, { status: 401 });
    }

    const body = (await request.json()) as WebhookTestBody;
    const webhookUrl = String(body.webhookUrl ?? "").trim();

    if (!webhookUrl) {
      return NextResponse.json({ success: false, error: "Webhook URL gerekli." }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(webhookUrl);
    } catch {
      return NextResponse.json({ success: false, error: "Gecersiz webhook URL." }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ success: false, error: "Webhook URL http veya https olmalidir." }, { status: 400 });
    }

    const requestUrl = new URL(request.url);
    const isLocalEchoTest =
      parsedUrl.origin === requestUrl.origin && parsedUrl.pathname === "/api/settings/webhook/echo";

    if (!isLocalEchoTest && await isUnsafeWebhookTarget(parsedUrl)) {
      return NextResponse.json(
        { success: false, error: "Yerel veya ozel ag hedeflerine webhook testi izinli degil." },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(parsedUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-HesapG-Webhook-Test": "true",
          "X-HesapG-User": user.email,
          ...(isLocalEchoTest ? { cookie: cookieHeader } : {}),
        },
        body: JSON.stringify(
          body.sampleEvent ?? {
            event: "webhook.test",
            source: "Hesap G",
            timestamp: new Date().toISOString(),
          }
        ),
        signal: controller.signal,
      });

      if (!response.ok) {
        return NextResponse.json(
          {
            success: false,
            status: response.status,
            error: `Webhook HTTP ${response.status} dondu.`,
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        status: response.status,
        message: `Webhook test istegi gonderildi. HTTP ${response.status}.`,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook testi başarısız.";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
