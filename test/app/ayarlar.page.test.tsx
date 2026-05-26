import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  pushMock,
  logoutMock,
  refreshUserMock,
  successMock,
  errorMock,
  warningMock,
  infoMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  logoutMock: vi.fn(async () => {}),
  refreshUserMock: vi.fn(async () => {}),
  successMock: vi.fn(),
  errorMock: vi.fn(),
  warningMock: vi.fn(),
  infoMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/components/layout/AuthContext", () => ({
  useAuth: () => ({
    user: {
      userId: 42,
      email: "demo@hesapg.com",
      name: "Demo Kullanıcı",
      company: "Hesap G",
      phone: "+90 555 000 00 00",
      plan: "Growth Plan",
    },
    loading: false,
    logout: logoutMock,
    refreshUser: refreshUserMock,
  }),
}));

vi.mock("@/lib/toast", () => ({
  useToast: () => ({
    success: successMock,
    error: errorMock,
    warning: warningMock,
    info: infoMock,
  }),
}));

vi.mock("@/components/theme/ThemeModeSelector", () => ({
  ThemeModeSelector: () => <div>Theme selector mock</div>,
}));

import SettingsPage from "@/app/ayarlar/page";

describe("SettingsPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    logoutMock.mockClear();
    refreshUserMock.mockClear();
    successMock.mockReset();
    errorMock.mockReset();
    warningMock.mockReset();
    infoMock.mockReset();
    window.localStorage.clear();
  });

  it("shows honest API and billing messaging without fake credentials or invoices", async () => {
    render(<SettingsPage />);

    expect(screen.getByText("Ayarlar")).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /API ve Webhook/i }));

    expect(screen.getByText(/API anahtarı yönetimi yakında aktif olacak/i)).not.toBeNull();
    expect(screen.getByText(/Gerçek credential gösterilmez/i)).not.toBeNull();
    expect(screen.getByPlaceholderText("Canlı webhook yapılandırması yakında açılacak").hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Yakında aktif olacak" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText(/hp_test_sk_demo/i)).toBeNull();
    expect(screen.queryByText(/hp_live_sk/i)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /Abonelik/i }));

    expect(screen.getByText(/Bu alan canlı faturalandırma verisi göstermez/i)).not.toBeNull();
    expect(screen.queryByText("01 May 2026")).toBeNull();
    expect(screen.queryByText("01 Nis 2026")).toBeNull();
    expect(screen.queryByText("01 Mar 2026")).toBeNull();
  });

  it("keeps non-backed settings disabled instead of pretending to save them", async () => {
    render(<SettingsPage />);

    await userEvent.click(screen.getByRole("button", { name: /Bildirimler/i }));

    expect(screen.getByText(/herhangi bir tercih kaydedilmez/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: /Stok uyarıları yakında aktif olacak/i }).hasAttribute("disabled")).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: /Dil ve Bölge/i }));

    expect(screen.getByText(/Tema dışındaki bu tercihler şu an için pasif durumda tutulur/i)).not.toBeNull();
    expect(screen.getByLabelText("Dil seçimi yakında aktif olacak").hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("Para birimi seçimi yakında aktif olacak").hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("Tarih biçimi seçimi yakında aktif olacak").hasAttribute("disabled")).toBe(true);
  });
});
