import { describe, expect, it, vi, beforeEach } from "vitest";

const { cookiesMock, verifyTokenMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  verifyTokenMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    verifyToken: verifyTokenMock,
  };
});

import { requireAuth } from "@/lib/api-auth";

describe("requireAuth", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    verifyTokenMock.mockReset();
  });

  it("returns 401 when the auth cookie is missing", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
    });

    const result = await requireAuth();

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Oturum gerekli.",
    });
  });

  it("returns 401 when the token is invalid or expired", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ value: "expired-token" })),
    });
    verifyTokenMock.mockResolvedValue(null);

    const result = await requireAuth();

    expect(verifyTokenMock).toHaveBeenCalledWith("expired-token");
    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Oturum suresi dolmus.",
    });
  });

  it("returns the authenticated API context when the token is valid", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ value: "valid-token" })),
    });
    verifyTokenMock.mockResolvedValue({
      userId: 42,
      email: "demo@example.com",
      name: "Demo User",
      plan: "Premium Plan",
    });

    await expect(requireAuth()).resolves.toEqual({
      userId: 42,
      email: "demo@example.com",
      name: "Demo User",
      plan: "Premium Plan",
    });
  });
});
