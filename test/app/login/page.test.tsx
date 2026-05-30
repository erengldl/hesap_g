import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const setUserMock = vi.fn();
const searchParamsMock = {
  get: vi.fn((key: string) => (key === "redirect" ? "/dashboard" : null)),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
  useSearchParams: () => searchParamsMock,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/layout/AuthContext", () => ({
  useAuth: () => ({
    setUser: setUserMock,
  }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: true, user: { name: "Demo" } }), { status: 200 }))
    );
    delete process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS;
  });

  it("hides demo credentials by default", () => {
    render(<LoginPage />);

    expect(screen.queryByText(/Demo erişim/i)).toBeNull();
  });

  it("renders demo credentials only when the env flag is true", () => {
    process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS = "true";

    render(<LoginPage />);

    expect(screen.getByText(/Demo erişim/i)).not.toBeNull();
    expect(screen.getByText(/admin@hesapg\.com \/ admin123/i)).not.toBeNull();
  });

  it("submits credentials and preserves redirect flow", async () => {
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: "demo@example.com" } });
    fireEvent.change(screen.getByLabelText("Şifre"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Giriş Yap" }));

    await waitFor(() => {
      expect(setUserMock).toHaveBeenCalledWith({ name: "Demo" });
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
      expect(refreshMock).toHaveBeenCalled();
    });
  });
});
