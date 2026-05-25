import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { GET as marketplaceStatusGet } from "@/app/api/marketplace-integrations/status/route";
import { POST as productsPost } from "@/app/api/products/route";

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
});
