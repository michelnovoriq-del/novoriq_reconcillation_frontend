"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { api, ApiError, type BillingStatus } from "@/lib/api/client";
import { useAuth } from "@/lib/hooks/use-auth";

// The webhook usually lands within seconds, so poll often for about a minute.
const MAX_ATTEMPTS = 15;
const BASE_INTERVAL_MS = 4_000;
const MAX_INTERVAL_MS = 8_000;

function ReturnContent() {
  const { user, refreshAccount } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [attempts, setAttempts] = useState(0); // every finished check, successful or not
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // refreshAccount changes identity when the account query updates. Keeping it in a ref
  // keeps `check` stable, so the effect below runs once instead of looping.
  const refreshRef = useRef(refreshAccount);
  useEffect(() => {
    refreshRef.current = refreshAccount;
  }, [refreshAccount]);

  const resendMutation = useMutation({
    mutationFn: () => api.requestEmailVerification({ email: user?.email ?? "" }),
  });

  const check = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Syncing also links a payment made before signup or email verification.
      const next = await api.syncWhopAccess();
      setStatus(next);

      if (next.plan_code !== "free") {
        try {
          await refreshRef.current();
        } catch {
          // The plan IS active; failing to refresh the cached account must not hide that.
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setSessionExpired(true); // polling more won't help until the user logs in again
        setAttempts(MAX_ATTEMPTS);
      }
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not retrieve your billing status. Please try again."
      );
    } finally {
      setLoading(false);
      setAttempts((n) => Math.min(MAX_ATTEMPTS, n + 1));
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const active = Boolean(status && status.plan_code !== "free");
  const pending = Boolean(status?.pending_whop_link);

  // Keep polling while the plan is still free, INCLUDING after a failed attempt. Previously one
  // network error left `status` unchanged, so the effect never re-ran and polling silently stopped.
  useEffect(() => {
    if (active || sessionExpired || loading || attempts === 0 || attempts >= MAX_ATTEMPTS) return;
    const delay = Math.min(BASE_INTERVAL_MS + attempts * 500, MAX_INTERVAL_MS);
    const timer = window.setTimeout(() => {
      void check();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [active, sessionExpired, loading, attempts, check]);

  const stillChecking = !active && !sessionExpired && attempts < MAX_ATTEMPTS;
  const needsVerification = status?.pending_reason === "email_not_verified";

  let heading: string;
  let message: string;
  if (active) {
    heading = `Your ${status!.plan_name} plan is active.`;
    message = "Your Novoriq access has refreshed.";
  } else if (sessionExpired) {
    heading = "Please log in again";
    message = "Your session expired. Log in again and we will check your payment.";
  } else if (pending) {
    heading = "Payment received";
    // The backend explains why the payment is not linked yet.
    message =
      status?.message ??
      "Your payment was received but is awaiting account linking. If it stays unresolved, verify your account email or contact support.";
  } else if (error) {
    heading = "Confirming your payment";
    message = error;
  } else if (stillChecking) {
    heading = "Confirming your payment";
    message = "Novoriq is checking for confirmation from Whop. This can take a short time.";
  } else {
    heading = "We have not confirmed your payment yet";
    message =
      "We have not confirmed paid access yet. If you completed payment, verify your account email or contact support.";
  }

  return (
    <main className="min-h-screen bg-cream px-5 py-16">
      <Card className="mx-auto max-w-xl p-8">
        <h1 className="text-3xl font-black">{heading}</h1>

        <p className="mt-4 text-slate-600">{message}</p>

        {status?.message && !pending && !active ? (
          <p className="mt-3 text-sm text-slate-500">{status.message}</p>
        ) : null}

        {needsVerification && !active ? (
          <div className="mt-5">
            <Button
              variant="outline"
              onClick={() => resendMutation.mutate()}
              disabled={resendMutation.isPending || !user?.email}
            >
              Send verification email
            </Button>
            {resendMutation.isSuccess ? (
              <p className="mt-2 text-sm text-slate-500">Sent. Open the link, then come back and press Check my access.</p>
            ) : null}
            {resendMutation.isError ? (
              <p className="mt-2 text-sm text-red-600">Could not send. Please try again shortly.</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-7 flex flex-wrap gap-3">
          {active ? (
            <Button asChild variant="sky">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          ) : sessionExpired ? (
            <Button asChild variant="sky">
              <Link href="/login?returnTo=%2Fbilling%2Freturn">Log in</Link>
            </Button>
          ) : (
            <Button
              onClick={() => {
                setAttempts(0); // a manual check restarts the polling window
                void check();
              }}
              variant="sky"
              disabled={loading}
            >
              {loading ? "Checking..." : "Check my access"}
            </Button>
          )}

          <Button asChild variant="outline">
            <Link href="/support">Contact support</Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}

export default function BillingReturnPage() {
  // The guard must wrap the component that fetches. Before, the hooks ran (and called the API)
  // even for visitors who were not signed in, because they lived in the same component as the guard.
  return (
    <ProtectedRoute>
      <ReturnContent />
    </ProtectedRoute>
  );
}