/**
 * AuthProvider — wraps Supabase auth.
 *
 * Sessions are persisted by the Supabase client itself (localStorage). We
 * subscribe to onAuthStateChange BEFORE checking the existing session, then
 * load the user's profile + active workspace.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { api } from "./http";
import type { AuthUser, Workspace } from "./types";

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
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspace, setWorkspaceState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadProfile = useCallback(async () => {
    try {
      const u = await api.me();
      setUser(u);
      if (u.workspaceId) {
        const ws = await api.getWorkspace();
        setWorkspaceState(ws);
      } else {
        setWorkspaceState(null);
      }
    } catch {
      setUser(null);
      setWorkspaceState(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // 1) Subscribe FIRST.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setToken(session?.access_token ?? null);

      // Only reload the profile on events that actually change the user
      // identity. TOKEN_REFRESHED / INITIAL_SESSION fire frequently (once
      // per minute and on every tab focus) and would otherwise trigger 3
      // network round-trips that block route navigation.
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        if (session?.user) {
          setTimeout(() => {
            if (mounted) void loadProfile();
          }, 0);
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setWorkspaceState(null);
      }
    });

    // 2) Then check existing session.
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setToken(data.session?.access_token ?? null);
      if (data.session?.user) {
        await loadProfile();
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refresh = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  const login = useCallback(
    async (email: string, password: string) => {
      await api.login(email, password);
      await loadProfile();
    },
    [loadProfile],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await api.register(name, email, password);
      await loadProfile();
    },
    [loadProfile],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setToken(null);
    setUser(null);
    setWorkspaceState(null);
    navigate({ to: "/login" });
  }, [navigate]);

  const setWorkspace = useCallback((ws: Workspace) => {
    setWorkspaceState(ws);
    setUser((u) => (u ? { ...u, workspaceId: ws.id, role: "ADMIN" } : u));
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
