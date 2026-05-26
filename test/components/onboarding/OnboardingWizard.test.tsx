import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock, successMock, errorMock, warningMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  successMock: vi.fn(),
  errorMock: vi.fn(),
  warningMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/components/layout/AuthContext", () => ({
  useAuth: () => ({
    user: {
      userId: 7,
      email: "demo@example.com",
      name: "Demo User",
      plan: "Premium Plan",
    },
    loading: false,
  }),
}));

vi.mock("@/lib/toast", () => ({
  useToast: () => ({
    success: successMock,
    error: errorMock,
    warning: warningMock,
  }),
}));

vi.mock("@/components/demo/SeedDemoButton", () => ({
  SeedDemoButton: ({ onSeeded, onError }: { onSeeded?: (result: unknown) => void; onError?: (message: string) => void }) => (
    <button
      type="button"
      onClick={() => {
        if (onSeeded) {
          onSeeded({
            success: true,
            productsInserted: 5,
            productsSkipped: 0,
            settingsInserted: 15,
            message: "Bu işlem mevcut tüm ürün ve sipariş verilerini SİLİP yerine demo veri yazar. Demo veri hazır.",
            warning: "Bu işlem mevcut tüm ürün ve sipariş verilerini SİLİP yerine demo veri yazar.",
          });
          return;
        }

        onError?.("Demo verisi yüklenemedi.");
      }}
    >
      Demo Verileri Yükle
    </button>
  ),
}));

import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

describe("OnboardingWizard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    pushMock.mockReset();
    successMock.mockReset();
    errorMock.mockReset();
    warningMock.mockReset();
  });

  it("opens for authenticated users when the completion flag is missing", async () => {
    render(<OnboardingWizard />);

    expect(await screen.findByText("Hemen Basla")).not.toBeNull();
    expect(screen.getByText("Demo Verileri Yükle")).not.toBeNull();
  });

  it("stays closed when onboarding has already been completed", async () => {
    window.localStorage.setItem("hg_onboarding_completed", "true");

    render(<OnboardingWizard />);

    await waitFor(() => {
      expect(screen.queryByText("Hemen Basla")).toBeNull();
    });
  });

  it("stores the completion flag when the user closes the wizard", async () => {
    render(<OnboardingWizard />);

    await userEvent.click(await screen.findByRole("button", { name: "Onboarding sihirbazini kapat" }));

    expect(window.localStorage.getItem("hg_onboarding_completed")).toBe("true");
    await waitFor(() => {
      expect(screen.queryByText("Hemen Basla")).toBeNull();
    });
  });

  it("moves to step 2 after demo seeding succeeds", async () => {
    render(<OnboardingWizard />);

    await userEvent.click(await screen.findByText("Demo Verileri Yükle"));

    expect(await screen.findByText("Mağazalarını Bağla")).not.toBeNull();
    expect(successMock).toHaveBeenCalledWith(
      "Demo verileri yüklendi",
      "Bu işlem mevcut tüm ürün ve sipariş verilerini SİLİP yerine demo veri yazar. Demo veri hazır."
    );
    expect(warningMock).not.toHaveBeenCalled();
  });

  it("marks onboarding complete and navigates to the dashboard on finish", async () => {
    render(<OnboardingWizard />);

    await userEvent.click(await screen.findByText("Demo Verileri Yükle"));
    await userEvent.click(await screen.findByRole("button", { name: "Şimdilik Atla" }));
    await userEvent.click(await screen.findByRole("button", { name: "Özete Git" }));

    expect(window.localStorage.getItem("hg_onboarding_completed")).toBe("true");
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });
});
