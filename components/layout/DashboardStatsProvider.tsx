"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type LiveDashboardStats = {
  totalRevenue: number;
  totalOrders: number;
  avgMargin: number;
  stockAlerts: number;
};

type DashboardStatsContextValue = {
  stats: LiveDashboardStats | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const DashboardStatsContext = createContext<DashboardStatsContextValue | null>(null);

const SHELL_STATS_REFRESH_INTERVAL_MS = 90000;

type AppStatsResponse = {
  success?: boolean;
  dashboard_summary?: {
    total_revenue?: number;
    total_orders?: number;
    avg_margin?: number;
    stock_alert_count?: number;
  };
};

export function DashboardStatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<LiveDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/app-stats", { cache: "no-store" });
      if (!res.ok) return;

      const data = await res.json() as AppStatsResponse;
      if (data?.success && data.dashboard_summary) {
        setStats({
          totalRevenue: Number(data.dashboard_summary.total_revenue ?? 0),
          totalOrders: Number(data.dashboard_summary.total_orders ?? 0),
          avgMargin: Number(data.dashboard_summary.avg_margin ?? 0),
          stockAlerts: Number(data.dashboard_summary.stock_alert_count ?? 0),
        });
      }
    } catch {
      // Silent by design: shell stats should never block the app.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, SHELL_STATS_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  return (
    <DashboardStatsContext.Provider value={{ stats, loading, refresh }}>
      {children}
    </DashboardStatsContext.Provider>
  );
}

export function useDashboardStats() {
  const context = useContext(DashboardStatsContext);
  if (!context) {
    throw new Error("useDashboardStats must be used within DashboardStatsProvider");
  }
  return context;
}
