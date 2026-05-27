import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbPrepareMock, getDbMock, getMock, requireAuthMock } = vi.hoisted(() => ({
  dbPrepareMock: vi.fn(),
  getDbMock: vi.fn(),
  getMock: vi.fn(),
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: requireAuthMock,
  primeRequestContextFromApiContext: vi.fn(),
}));

import { PUT } from "@/app/api/products/[id]/channels/route";

function createRequest() {
  return new Request("http://localhost/api/products/123/channels", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channels: [
        { slug: "trendyol", enabled: true },
      ],
    }),
  }) as NextRequest;
}

describe("product channels route", () => {
  beforeEach(() => {
    dbPrepareMock.mockReset();
    getDbMock.mockReset();
    getMock.mockReset();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({
      userId: 1,
      authUserId: "test-auth-user",
      email: "demo@example.com",
      name: "Demo User",
      plan: "Premium Plan",
    });

    getMock.mockReturnValue(undefined);
    dbPrepareMock.mockReturnValue({
      get: getMock,
    });
    getDbMock.mockReturnValue({
      prepare: dbPrepareMock,
    });
  });

  it("returns 404 when the product does not belong to the authenticated user", async () => {
    const response = await PUT(createRequest(), { params: Promise.resolve({ id: "123" }) });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Product not found");
    expect(dbPrepareMock).toHaveBeenCalledWith("SELECT product_id FROM products WHERE product_id = ? AND user_id = ? LIMIT 1");
    expect(getMock).toHaveBeenCalledWith(123, "test-auth-user");
  });
});
