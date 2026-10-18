"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { api, type BillingStatus } from "@/lib/api/client";
import { useAuth } from "@/lib/hooks/use-auth";

// The webhook usually lands within seconds, so poll often for about a minute.
const MAX_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 4_000;

export default function BillingReturnPage() {
  const { user, refreshAccount } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setAttempts((n) => n + 1);

      if (next.plan_code !== "free") {
        await refreshRef.current();
      }
    } catch {
      setError("Could not retrieve your billing status. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  useEffect(() => {
    if (!status || status.plan_code !== "free" || attempts >= MAX_ATTEMPTS) {
      return;
    }

    const timer = window.setTimeout(() => {
      void check();
    }, POLL_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [status, attempts, check]);

  const active = Boolean(status && status.plan_code !== "free");
  const pending = Boolean(status?.pending_whop_link);
  const stillChecking = !active && attempts < MAX_ATTEMPTS;
  const needsVerification = status?.pending_reason === "email_not_verified";

  let message: string;
  if (error) {
    message = error;
  } else if (active) {
    message = "Your Novoriq access has refreshed.";
  } else if (pending) {
    // The backend explains why the payment is not linked yet.
    message =
      status?.message ??
      "Your payment was received but is awaiting account linking. If it stays unresolved, verify your account email or contact support.";
  } else if (stillChecking) {
    message = "Novoriq is checking for confirmation from Whop. This can take a short time.";
  } else {
    message =
      "We have not confirmed paid access yet. If you completed payment, verify your account email or contact support.";
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-cream px-5 py-16">
        <Card className="mx-auto max-w-xl p-8">
          <h1 className="text-3xl font-black">
            {active ? `Your ${status!.plan_name} plan is active.` : "Payment submitted"}
          </h1>

          <p className="mt-4 text-slate-600">{message}</p>

          {status?.message && !pending ? (
            <p className="mt-3 text-sm text-slate-500">{status.message}</p>
          ) : null}

          {needsVerification && !active ? (
            <div className="mt-5">
              <Button
                variant="outline"
                onClick={() => resendMutation.mutate()}
                disabled={resendMutation.isPending}
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
            ) : (
              <Button onClick={() => void check()} variant="sky" disabled={loading}>
                {loading ? "Checking..." : "Check my access"}
              </Button>
            )}

            <Button asChild variant="outline">
              <Link href="/support">Contact support</Link>
            </Button>
          </div>
        </Card>
      </main>
    </ProtectedRoute>
  );
}