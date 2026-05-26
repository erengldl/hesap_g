import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SeedDemoButton } from "@/components/demo/SeedDemoButton";

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe("SeedDemoButton", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    vi.unstubAllGlobals();
  });

  it("shows the loading state while the seed request is pending", async () => {
    const deferred = deferredResponse();
    vi.stubGlobal("fetch", vi.fn(() => deferred.promise));

    render(<SeedDemoButton onSeeded={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Demo Verileri Yükle" }));

    expect(screen.getByRole("button", { name: "Demo verileri yükleniyor..." }).hasAttribute("disabled")).toBe(true);

    deferred.resolve(
      new Response(
        JSON.stringify({
          success: true,
          productsInserted: 5,
          productsSkipped: 0,
          settingsInserted: 15,
          message: "Demo tamam.",
          warning: "Demo tamam.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Demo Verileri Yükle" }).hasAttribute("disabled")).toBe(false);
    });
  });

  it("asks for confirmation only when confirmMessage is provided", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            productsInserted: 5,
            productsSkipped: 0,
            settingsInserted: 15,
            message: "Demo tamam.",
            warning: "Demo tamam.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    const confirmMock = vi.fn(() => false);

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", confirmMock);

    const { rerender } = render(<SeedDemoButton confirmMessage="Silinsin mi?" />);

    await userEvent.click(screen.getByRole("button", { name: "Demo Verileri Yükle" }));

    expect(confirmMock).toHaveBeenCalledWith("Silinsin mi?");
    expect(fetchMock).not.toHaveBeenCalled();

    rerender(<SeedDemoButton onSeeded={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Demo Verileri Yükle" }));

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reloads the page after a successful seed when no callback is provided", async () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadMock },
    });
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            productsInserted: 5,
            productsSkipped: 0,
            settingsInserted: 15,
            message: "Demo tamam.",
            warning: "Demo tamam.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    ));

    render(<SeedDemoButton />);

    await userEvent.click(screen.getByRole("button", { name: "Demo Verileri Yükle" }));

    await waitFor(() => {
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });
  });

  it("forwards API failures to the error callback", async () => {
    const onError = vi.fn();
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: false,
            productsInserted: 0,
            productsSkipped: 0,
            settingsInserted: 0,
            message: "Seed başarısız.",
            warning: "Demo uyarisi",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        )
      )
    ));

    render(<SeedDemoButton onError={onError} />);

    await userEvent.click(screen.getByRole("button", { name: "Demo Verileri Yükle" }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("Seed başarısız.");
    });
  });
});
