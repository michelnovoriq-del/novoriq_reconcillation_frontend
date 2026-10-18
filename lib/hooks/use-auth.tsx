"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ApiError,
  api,
  clearToken,
  getToken,
  setToken,
  type AccountBootstrap,
  type User,
} from "@/lib/api/client";

const ACCOUNT_KEY = ["account", "bootstrap"] as const;
const DEFAULT_REDIRECT = "/dashboard";

/**
 * Only same-site paths are allowed as a post-login redirect (open-redirect protection).
 * Anything else, including the login/register pages themselves, falls back to the dashboard.
 */
export function safeReturnTo(value?: string | null) {
  if (!value) return DEFAULT_REDIRECT;
  const candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(candidate)) {
    return DEFAULT_REDIRECT;
  }
  try {
    const parsed = new URL(candidate, "http://novoriq.local");
    if (parsed.origin !== "http://novoriq.local") return DEFAULT_REDIRECT;
    if (/^\/(login|register)(\/|$)/.test(parsed.pathname)) return DEFAULT_REDIRECT;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_REDIRECT;
  }
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

type AuthContextValue = {
  user: User | null;
  account: AccountBootstrap | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: { email: string; password: string }, redirectTo?: string) => Promise<void>;
  register: (payload: {
    full_name?: string;
    email: string;
    password: string;
    organization_name: string;
  }) => Promise<void>;
  logout: () => void;
  refreshAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(false);
  // The token lives in localStorage, which only exists in the browser. Until we have looked at it,
  // we do not know whether the user is signed in. Without this flag the first render reported
  // "not loading, not authenticated", so a signed-in user could be bounced to /login on every refresh.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHasToken(Boolean(getToken()));
    setHydrated(true);
  }, []);

  const accountQuery = useQuery({
    queryKey: ACCOUNT_KEY,
    queryFn: api.getAccountBootstrap,
    enabled: hasToken,
    // Retry transient failures (network blips, timeouts, 5xx) but never a 401.
    retry: (failureCount, error) => !isUnauthorized(error) && failureCount < 2,
  });

  // Sign the user out ONLY when the server says the token is invalid (401). Before, ANY error
  // (a timeout, a 500, a dropped connection) cleared the token and logged the user out.
  const accountError = accountQuery.error;
  useEffect(() => {
    if (isUnauthorized(accountError)) {
      clearToken();
      setHasToken(false);
      queryClient.clear();
    }
  }, [accountError, queryClient]);

  // Store the token, then load the account BEFORE navigating. If that call fails, the login/register
  // form shows the error. Before, the app navigated first; a failing /account/bootstrap then cleared
  // the token and the user was silently sent back to /login, which looked like a dead Sign In button.
  const establishSession = useCallback(
    async (accessToken: string) => {
      setToken(accessToken);
      try {
        await queryClient.fetchQuery({ queryKey: ACCOUNT_KEY, queryFn: api.getAccountBootstrap, staleTime: 0 });
      } catch (err) {
        clearToken();
        setHasToken(false);
        queryClient.removeQueries({ queryKey: ACCOUNT_KEY });
        throw err;
      }
      setHasToken(true);
    },
    [queryClient],
  );

  const login = useCallback(
    async (payload: { email: string; password: string }, redirectTo?: string) => {
      // `redirectTo` is deliberately NOT part of what is sent to the API (it used to be spread into
      // the request body, so the backend received an unexpected `redirectTo` field).
      const response = await api.login({ email: payload.email, password: payload.password });
      await establishSession(response.access_token);
      router.push(safeReturnTo(redirectTo));
    },
    [establishSession, router],
  );

  const register = useCallback(
    async (payload: { full_name?: string; email: string; password: string; organization_name: string }) => {
      const response = await api.register(payload);
      await establishSession(response.access_token);
      router.push("/onboarding");
    },
    [establishSession, router],
  );

  const logout = useCallback(() => {
    clearToken();
    setHasToken(false);
    queryClient.clear();
    router.push("/login");
  }, [queryClient, router]);

  const { data: accountData, isLoading: accountLoading, refetch } = accountQuery;
  const refreshAccount = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Depends on the specific values it uses, not on whole query objects that change identity on every
  // render (which re-rendered every component that calls useAuth, on every render).
  const value = useMemo<AuthContextValue>(
    () => ({
      user: accountData
        ? {
            id: accountData.user.id,
            email: accountData.user.email,
            full_name: accountData.user.full_name,
            is_active: true,
            email_verified_at: accountData.user.email_verified ? new Date().toISOString() : null,
            created_at: "",
            updated_at: "",
          }
        : null,
      account: accountData ?? null,
      isLoading: !hydrated || (hasToken && accountLoading),
      isAuthenticated: Boolean(accountData),
      login,
      register,
      logout,
      refreshAccount,
    }),
    [accountData, accountLoading, hasToken, hydrated, login, register, logout, refreshAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}