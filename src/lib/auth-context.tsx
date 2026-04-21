/**
 * AuthProvider — manages JWT, current user, and active workspace.
 *
 * Storage strategy: token persists in localStorage ("crm.token") so reloads
 * stay logged in. The token is otherwise kept in memory and injected into
 * every request via http.ts setTokenProvider. Sensitive data (user, workspace)
 * is fetched from /me + /workspace on boot — never trusted from local storage.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { api, setTokenProvider, setUnauthorizedHandler } from "./http";
import type { AuthUser, Workspace } from "./types";

const TOKEN_KEY = "crm.token";

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  workspace: Workspace | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  setWorkspace: (ws: Workspace) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const tokenRef = useRef<string | null>(
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null,
  );
  const [token, setTokenState] = useState<string | null>(tokenRef.current);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspace, setWorkspaceState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState<boolean>(!!tokenRef.current);

  // Wire token + 401 handler into the HTTP layer once.
  useEffect(() => {
    setTokenProvider(() => tokenRef.current);
    setUnauthorizedHandler(() => {
      tokenRef.current = null;
      localStorage.removeItem(TOKEN_KEY);
      setTokenState(null);
      setUser(null);
      setWorkspaceState(null);
      navigate({ to: "/login" });
    });
  }, [navigate]);

  const persistToken = useCallback((t: string | null) => {
    tokenRef.current = t;
    setTokenState(t);
    if (typeof window === "undefined") return;
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }, []);

  const refresh = useCallback(async () => {
    if (!tokenRef.current) {
      setUser(null);
      setWorkspaceState(null);
      return;
    }
    const u = await api.me();
    setUser(u);
    if (u.workspaceId) {
      const ws = await api.getWorkspace();
      setWorkspaceState(ws);
    } else {
      setWorkspaceState(null);
    }
  }, []);

  // Bootstrap on mount if token exists.
  useEffect(() => {
    let cancelled = false;
    if (!tokenRef.current) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        await refresh();
      } catch {
        persistToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, persistToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      persistToken(res.token);
      setUser(res.user);
      if (res.user.workspaceId) {
        const ws = await api.getWorkspace();
        setWorkspaceState(ws);
      } else {
        setWorkspaceState(null);
      }
    },
    [persistToken],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await api.register(name, email, password);
      persistToken(res.token);
      setUser(res.user);
      setWorkspaceState(null);
    },
    [persistToken],
  );

  const logout = useCallback(() => {
    persistToken(null);
    setUser(null);
    setWorkspaceState(null);
    navigate({ to: "/login" });
  }, [persistToken, navigate]);

  const setWorkspace = useCallback((ws: Workspace) => {
    setWorkspaceState(ws);
    setUser((u) => (u ? { ...u, workspaceId: ws.id } : u));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      workspace,
      loading,
      isAuthenticated: !!token && !!user,
      login,
      register,
      logout,
      refresh,
      setWorkspace,
    }),
    [token, user, workspace, loading, login, register, logout, refresh, setWorkspace],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
