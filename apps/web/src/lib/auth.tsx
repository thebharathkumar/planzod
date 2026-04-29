import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "./env";

export type User = {
  id: string;
  email: string;
  role: string;
};

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
};

type AuthContextValue = AuthState & {
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
};

const STORAGE_KEY = "planzo.auth.v1";

function loadStored(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, accessToken: null, refreshToken: null };
    const parsed = JSON.parse(raw) as AuthState;
    return {
      user: parsed.user ?? null,
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null
    };
  } catch {
    return { user: null, accessToken: null, refreshToken: null };
  }
}

function saveStored(state: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearStored() {
  localStorage.removeItem(STORAGE_KEY);
}

async function parseJsonOrThrow(res: Response) {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.message || data?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => loadStored());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    saveStored(state);
  }, [state]);

  const apiFetch = useMemo(() => {
    return async function apiFetchImpl<T>(path: string, init: RequestInit = {}): Promise<T> {
      const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
      const headers = new Headers(init.headers);
      headers.set("accept", "application/json");

      const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
      if (!isFormData && init.body && !headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
      if (state.accessToken) headers.set("authorization", `Bearer ${state.accessToken}`);

      const res = await fetch(url, { ...init, headers });
      if (res.status !== 401 || !state.refreshToken) {
        return (await parseJsonOrThrow(res)) as T;
      }

      // Attempt refresh once, then retry.
      const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ refreshToken: state.refreshToken })
      });
      const refreshData = await parseJsonOrThrow(refreshRes);
      const newAccess = refreshData.accessToken as string;
      const newRefresh = refreshData.refreshToken as string;
      setState((s) => ({ ...s, accessToken: newAccess, refreshToken: newRefresh }));

      const retryHeaders = new Headers(headers);
      retryHeaders.set("authorization", `Bearer ${newAccess}`);
      const retry = await fetch(url, { ...init, headers: retryHeaders });
      return (await parseJsonOrThrow(retry)) as T;
    };
  }, [state.accessToken, state.refreshToken]);

  async function loadUser() {
    if (!state.accessToken) return;
    try {
      const data = await apiFetch<{ user: User }>("/auth/me");
      setState((s) => ({ ...s, user: data.user }));
    } catch {
      // Ignore; user stays null until next login.
    }
  }

  useEffect(() => {
    (async () => {
      await loadUser();
      setIsReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const data = await apiFetch<{ user: User; accessToken: string; refreshToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    setState({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
  }

  async function register(email: string, password: string) {
    await apiFetch("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) });
    await login(email, password);
  }

  async function logout() {
    const refreshToken = state.refreshToken;
    setState({ user: null, accessToken: null, refreshToken: null });
    clearStored();
    if (!refreshToken) return;
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ refreshToken })
      });
    } catch {
      // Best-effort.
    }
  }

  const value: AuthContextValue = {
    ...state,
    isReady,
    login,
    register,
    logout,
    apiFetch
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

