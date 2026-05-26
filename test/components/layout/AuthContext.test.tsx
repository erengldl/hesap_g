import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/components/layout/AuthContext";
import type { AuthUser } from "@/lib/auth";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;

  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe("AuthContext", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not overwrite a freshly set user with a stale refresh response", async () => {
    const authMeRequest = createDeferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/auth/me")) {
        return authMeRequest.promise;
      }

      throw new Error(`Unhandled fetch call: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    let latestSetUser: ((user: AuthUser | null) => void) | null = null;

    function Probe() {
      const auth = useAuth();
      latestSetUser = auth.setUser;

      return <div data-testid="auth-user">{auth.user?.name ?? "none"}</div>;
    }

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId("auth-user").textContent).toBe("none");

    act(() => {
      latestSetUser?.({
        userId: 101,
        email: "alice@example.com",
        name: "Alice",
        plan: "Premium Plan",
      });
    });

    expect(screen.getByTestId("auth-user").textContent).toBe("Alice");

    authMeRequest.resolve(
      new Response(
        JSON.stringify({ success: false, error: "Oturum bulunamadi." }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth-user").textContent).toBe("Alice");
    });
  });
});
