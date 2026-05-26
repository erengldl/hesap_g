import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { GET as marketplaceStatusGet } from "@/app/api/marketplace-integrations/status/route";
import { POST as productsPost } from "@/app/api/products/route";
import { POST as seedDemoPost } from "@/app/api/seed-demo/route";

describe("API auth guards", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
    });
  });

  it("rejects POST /api/products without a session", async () => {
    const response = await productsPost(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Oturum gerekli.",
    });
  });

  it("rejects GET /api/marketplace-integrations/status without a session", async () => {
    const response = await marketplaceStatusGet();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Oturum gerekli.",
    });
  });

  it("rejects POST /api/seed-demo without a session before production checks", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const response = await seedDemoPost(
        new Request("http://localhost/api/seed-demo", {
          method: "POST",
        })
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: "Oturum gerekli.",
      });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
