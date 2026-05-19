"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type { AuthUser } from "@/lib/auth";

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  setUser: () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshRequestIdRef = useRef(0);
  const manualAuthMutationRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setUser = useCallback((nextUser: AuthUser | null) => {
    manualAuthMutationRef.current += 1;
    setUserState(nextUser);
  }, []);

  const refreshUser = useCallback(async () => {
    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;
    const mutationVersionAtStart = manualAuthMutationRef.current;

    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();

      const isCurrentRequest =
        isMountedRef.current &&
        refreshRequestIdRef.current === requestId &&
        manualAuthMutationRef.current === mutationVersionAtStart;

      if (!isCurrentRequest) {
        return;
      }

      if (data?.success && data.user) {
        setUserState(data.user);
      } else {
        setUserState(null);
      }
    } catch {
      const isCurrentRequest =
        isMountedRef.current &&
        refreshRequestIdRef.current === requestId &&
        manualAuthMutationRef.current === mutationVersionAtStart;

      if (isCurrentRequest) {
        setUserState(null);
      }
    } finally {
      if (isMountedRef.current && refreshRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  const logout = useCallback(async () => {
    manualAuthMutationRef.current += 1;
    try {
      await fetch("/api/auth/me", { method: "DELETE" });
    } catch {
      // cookie cleared regardless
    }
    if (isMountedRef.current) {
      setUserState(null);
    }
  }, []);

  // Check auth on mount
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
