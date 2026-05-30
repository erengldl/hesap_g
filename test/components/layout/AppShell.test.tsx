import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AppShell from "@/components/layout/AppShell";

const pathnameMock = vi.fn(() => "/dashboard");

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

vi.mock("next/dynamic", () => ({
  default: () => {
    return function MockDynamicComponent() {
      return null;
    };
  },
}));

vi.mock("@/components/layout/Sidebar", () => ({
  default: ({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse: () => void }) => (
    <div data-testid="sidebar" data-collapsed={String(collapsed)}>
      <button type="button" onClick={onToggleCollapse}>
        Toggle Sidebar
      </button>
    </div>
  ),
}));

vi.mock("@/components/layout/Topbar", () => ({
  default: () => <div data-testid="topbar" />,
}));

vi.mock("@/components/layout/DashboardStatsProvider", () => ({
  DashboardStatsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/layout/AuthContext", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/toast", () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/layout/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("AppShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    pathnameMock.mockReturnValue("/dashboard");
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("starts with the desktop sidebar collapsed by default", () => {
    render(
      <AppShell>
        <div>Dashboard child</div>
      </AppShell>
    );

    expect(screen.getByTestId("sidebar").getAttribute("data-collapsed")).toBe("true");
  });

  it("hydrates the stored sidebar preference from localStorage", async () => {
    window.localStorage.setItem("hg_sidebar_collapsed", "false");

    render(
      <AppShell>
        <div>Dashboard child</div>
      </AppShell>
    );

    await waitFor(() => {
      expect(screen.getByTestId("sidebar").getAttribute("data-collapsed")).toBe("false");
    });
  });
});
