import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, getAuthenticatedUserFromCookieHeaderMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  getAuthenticatedUserFromCookieHeaderMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/request-auth", () => ({
  getAuthenticatedUserFromCookieHeader: getAuthenticatedUserFromCookieHeaderMock,
}));

import { requireAuth } from "@/lib/api-auth";

describe("requireAuth", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    getAuthenticatedUserFromCookieHeaderMock.mockReset();
  });

  it("returns 401 when no cookies are present", async () => {
    cookiesMock.mockResolvedValue({
      getAll: vi.fn(() => []),
    });

    const result = await requireAuth();

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Oturum gerekli.",
    });
    expect(getAuthenticatedUserFromCookieHeaderMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the Supabase session cannot be resolved", async () => {
    cookiesMock.mockResolvedValue({
      getAll: vi.fn(() => [{ name: "sb-test-auth-token", value: "expired-cookie" }]),
    });
    getAuthenticatedUserFromCookieHeaderMock.mockResolvedValue(null);

    const result = await requireAuth();

    expect(getAuthenticatedUserFromCookieHeaderMock).toHaveBeenCalledWith(
      "sb-test-auth-token=expired-cookie"
    );
    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Oturum süresi doldu.",
    });
  });

  it("returns the authenticated API context when the Supabase session is valid", async () => {
    cookiesMock.mockResolvedValue({
      getAll: vi.fn(() => [
        { name: "sb-test-auth-token", value: "valid-cookie" },
        { name: "theme", value: "dark" },
      ]),
    });
    getAuthenticatedUserFromCookieHeaderMock.mockResolvedValue({
      userId: 42,
      authUserId: "supabase-user-42",
      email: "demo@example.com",
      name: "Demo User",
      plan: "Premium Plan",
      authProvider: "supabase",
    });

    await expect(requireAuth()).resolves.toEqual({
      userId: 42,
      authUserId: "supabase-user-42",
      email: "demo@example.com",
      name: "Demo User",
      plan: "Premium Plan",
    });
  });
});
