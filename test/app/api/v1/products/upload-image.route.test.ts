import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  dbPrepareMock,
  deleteProductImageUploadMock,
  getDbMock,
  getMock,
  requireAuthMock,
} = vi.hoisted(() => ({
  dbPrepareMock: vi.fn(),
  deleteProductImageUploadMock: vi.fn(),
  getDbMock: vi.fn(),
  getMock: vi.fn(),
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/product-image-upload", () => ({
  deleteProductImageUpload: deleteProductImageUploadMock,
  saveProductImageUpload: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

import { DELETE } from "@/app/api/v1/products/upload-image/route";

function createRequest(url = "http://localhost/api/v1/products/upload-image?url=https%3A%2F%2Fcdn.example.com%2Fproducts%2Flegacy-image.jpg") {
  return new Request(url, {
    method: "DELETE",
  }) as NextRequest;
}

describe("product image upload route", () => {
  beforeEach(() => {
    dbPrepareMock.mockReset();
    deleteProductImageUploadMock.mockReset();
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

    getMock.mockReturnValue({ product_id: 42 });
    dbPrepareMock.mockReturnValue({
      get: getMock,
    });
    getDbMock.mockReturnValue({
      prepare: dbPrepareMock,
    });
    deleteProductImageUploadMock.mockResolvedValue(true);
  });

  it("allows deleting a legacy image only when the current user owns the referencing product", async () => {
    const response = await DELETE(createRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.deleted).toBe(true);
    expect(getMock).toHaveBeenCalledWith("test-auth-user", "https://cdn.example.com/products/legacy-image.jpg");
    expect(deleteProductImageUploadMock).toHaveBeenCalledWith("https://cdn.example.com/products/legacy-image.jpg", {
      authUserId: "test-auth-user",
      allowLegacyDeletion: true,
    });
  });
});
