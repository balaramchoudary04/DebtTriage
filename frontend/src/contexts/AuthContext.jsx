import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { api, formatApiErrorDetail } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If returning from Google OAuth callback (URL fragment contains session_id),
    // skip /auth/me — AuthCallback will exchange the session first.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setUser(data);
    return data;
  }, []);

  const register = useCallback(async (email, password, name) => {
    const { data } = await api.post("/auth/register", { email, password, name });
    setUser(data);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    }
    setUser(false);
  }, []);

  const exchangeSession = useCallback(async (code, redirect_uri) => {
    const { data } = await api.post("/auth/session", { code, redirect_uri });
    setUser(data);
    return data;
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, exchangeSession, checkAuth, formatApiErrorDetail }),
    [user, loading, login, register, logout, exchangeSession, checkAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
