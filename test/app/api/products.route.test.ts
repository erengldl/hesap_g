import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getProductsMock, requireAuthMock } = vi.hoisted(() => ({
  getProductsMock: vi.fn(),
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/database-readers", () => ({
  getProducts: getProductsMock,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

import { GET } from "@/app/api/products/route";

function createRequest(url = "http://localhost/api/products") {
  return new Request(url) as NextRequest;
}

describe("products route", () => {
  beforeEach(() => {
    getProductsMock.mockReset();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({
      userId: 1,
      email: "demo@example.com",
      name: "Demo User",
      plan: "Premium Plan",
    });
    delete process.env.ALLOW_DEMO_FALLBACK;
  });

  it("returns an empty array when the database has no products", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    getProductsMock.mockResolvedValue([]);

    try {
      const response = await GET(createRequest());

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        success: true,
        products: [],
        count: 0,
      });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("returns 503 in production when product loading fails", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.NODE_ENV = "production";
    getProductsMock.mockRejectedValue(new Error("db unavailable"));

    try {
      const response = await GET(createRequest());

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: "Ürünler yüklenemedi.",
      });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      consoleErrorSpy.mockRestore();
    }
  });
});
