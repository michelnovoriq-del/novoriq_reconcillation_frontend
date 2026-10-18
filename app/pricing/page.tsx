"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, ExternalLink, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";

const supportEmail = "michelnovoriq@gmail.com";

const whopPlanIds = {
  professional: process.env.NEXT_PUBLIC_WHOP_PROFESSIONAL_PLAN_ID ?? "",
  firm: process.env.NEXT_PUBLIC_WHOP_FIRM_PLAN_ID ?? "",
  enterprise: process.env.NEXT_PUBLIC_WHOP_ENTERPRISE_PLAN_ID ?? "",
};

// The prices and limits below are display text. They must match the price set on the
// Whop plan and PLAN_DEFINITIONS in the backend's plan_service.py.
const plans = [
  {
    code: "free",
    name: "Free Forever",
    price: "$0",
    cadence: "Forever",
    badge: "Available now",
    description: "Full core reconciliation workflow with volume limits.",
    features: [
      "4 reconciliation runs/month",
      "2 files/run",
      "2,500 rows/file",
      "1 user",
      "1 workspace",
      "Core matching and review",
      "CSV export",
      "7-day detailed history",
    ],
  },
  {
    code: "professional",
    name: "Professional",
    price: "$29",
    cadence: "per month",
    badge: undefined,
    description: "For finance teams running recurring reconciliation operations.",
    features: [
      "50 reconciliation runs/month",
      "3 files/run",
      "25,000 rows/file",
      "3 users",
      "20 client workspaces",
      "12-month detailed history",
      "Full audit history",
      "Priority email support",
      "AI mapping coming soon",
    ],
  },
  {
    code: "firm",
    name: "Firm",
    price: "$79",
    cadence: "per month",
    badge: "Firm favorite",
    description: "Best for accounting firms managing multiple clients and team members.",
    features: [
      "150 reconciliation runs/month",
      "4 files/run",
      "50,000 rows/file",
      "10 users",
      "75 client workspaces",
      "24-month detailed history",
      "Priority onboarding",
      "Advanced approvals coming soon",
      "AI explanations coming soon",
    ],
  },
  {
    code: "enterprise",
    name: "Enterprise",
    price: "$199",
    cadence: "per month",
    badge: "Tier 4",
    description: "Higher-volume reconciliation capacity for larger operating teams.",
    features: [
      "400 reconciliation runs/month",
      "6 files/run",
      "150,000 rows/file",
      "25 users",
      "250 client workspaces",
      "36-month detailed history",
      "Dedicated success support",
      "Audit export coming soon",
      "Advanced approvals coming soon",
    ],
  },
] as const;

type PaidPlanCode = "professional" | "firm" | "enterprise";
type Plan = (typeof plans)[number];

const PAID_CODES = ["professional", "firm", "enterprise"] as const;

/** Only follow https links from the API (a manage URL should never be javascript: or http:). */
function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function PricingPage() {
  const { user, account, isAuthenticated, refreshAccount } = useAuth();
  const [intendedPlan, setIntendedPlan] = useState<string | null>(null);
  useEffect(() => {
    setIntendedPlan(new URLSearchParams(window.location.search).get("plan"));
  }, []);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [confirmedEmail, setConfirmedEmail] = useState(false);
  const autoOpened = useRef(false);

  const billingStatus = useQuery({
    queryKey: ["billing", "status"],
    queryFn: api.getBillingStatus,
    enabled: isAuthenticated,
  });
  const syncMutation = useMutation({
    mutationFn: api.syncWhopAccess,
    onSuccess: async (status) => {
      await billingStatus.refetch();
      await refreshAccount();
      return status;
    },
  });
  const resendMutation = useMutation({
    mutationFn: () => api.requestEmailVerification({ email: user?.email ?? "" }),
  });

  // Paid plans are only applied to verified emails, so block checkout until verified.
  // `accountLoaded` matters: before the account arrives, `emailVerified` is false for EVERYONE, which
  // used to flash a "verify your email" warning at already-verified users.
  const accountLoaded = Boolean(account);
  const emailVerified = Boolean(account?.user.email_verified);
  const manageUrl = safeHttpsUrl(billingStatus.data?.manage_url);

  const currentCode = account?.subscription.plan_code ?? billingStatus.data?.plan_code;
  const isPaid = currentCode === "professional" || currentCode === "firm" || currentCode === "enterprise";

  const selectedPlanId = useMemo(() => {
    if (!selectedPlan || selectedPlan.code === "free") return "";
    return whopPlanIds[selectedPlan.code as PaidPlanCode];
  }, [selectedPlan]);

  function beginUpgrade(plan: Plan) {
    if (plan.code === "free" || !emailVerified) return;
    setConfirmedEmail(false);
    setSelectedPlan(plan);
  }

  // Coming back from login with ?plan=… should continue where the user left off.
  useEffect(() => {
    if (autoOpened.current || !intendedPlan || !accountLoaded || !emailVerified || isPaid) return;
    const code = PAID_CODES.find((c) => c === intendedPlan);
    if (!code || !whopPlanIds[code]) return;
    const plan = plans.find((p) => p.code === code);
    if (!plan) return;
    autoOpened.current = true; // never re-open after the user closes it
    setConfirmedEmail(false);
    setSelectedPlan(plan);
  }, [intendedPlan, accountLoaded, emailVerified, isPaid]);

  // Escape closes the dialog.
  useEffect(() => {
    if (!selectedPlan) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPlan(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedPlan]);

  function continueToWhop() {
    if (!confirmedEmail || !selectedPlanId || !selectedPlan || !user?.email) return;
    // Full page load on purpose: Whop's checkout loader scans the page once when it loads, so the
    // checkout page needs a fresh document. It reads the email from the account, not from the URL.
    window.location.assign(`/billing/checkout?plan=${selectedPlan.code}`);
  }

  return (
    <div className="min-h-screen bg-[#FAF3E7] text-[#111827]">
      <PublicHeader />
      <main>
      <section className="px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase text-[#0369A1]">Pricing</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Simple plans for growing reconciliation workflows</h1>
            <p className="mt-4 text-base leading-7 text-[#4B5563]">
              Free Forever includes the full core workflow. Paid plans are handled through Whop-hosted checkout.
            </p>
          </div>

          {isAuthenticated && accountLoaded && !emailVerified ? (
            <div className="mt-8 rounded-lg border border-[#F59E0B]/30 bg-white px-4 py-3 text-sm font-semibold text-[#4B5563]">
              Verify your email before upgrading. Paid plans are only applied to verified email addresses.{" "}
              <button
                type="button"
                className="text-[#0369A1] underline"
                onClick={() => resendMutation.mutate()}
                disabled={resendMutation.isPending || !user?.email}
              >
                Send verification email
              </button>
              {resendMutation.isSuccess ? <span className="ml-2 text-[#10B981]">Sent. Check your inbox.</span> : null}
              {resendMutation.isError ? <span className="ml-2 text-[#EF4444]">Could not send. Please try again shortly.</span> : null}
            </div>
          ) : null}

          {billingStatus.data?.message ? (
            <div className="mt-8 rounded-lg border border-[#F59E0B]/30 bg-white px-4 py-3 text-sm font-semibold text-[#4B5563]">
              {billingStatus.data.message}{" "}
              <a href={`mailto:${supportEmail}`} className="text-[#0369A1] underline">{supportEmail}</a>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {isAuthenticated ? (
              <Button
                variant="outline"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Check my access
              </Button>
            ) : null}
            {billingStatus.data ? (
              <Badge tone={billingStatus.data.pending_whop_link ? "amber" : "green"}>
                Current plan: {billingStatus.data.plan_name}
              </Badge>
            ) : null}
            {syncMutation.isError ? (
              <span className="text-sm font-semibold text-[#EF4444]">
                {syncMutation.error instanceof Error && syncMutation.error.message
                  ? syncMutation.error.message
                  : "Could not check your access. Please try again."}
              </span>
            ) : null}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {plans.map((plan) => {
              const isFree = plan.code === "free";
              const planId = !isFree ? whopPlanIds[plan.code as PaidPlanCode] : "";
              const unavailable = !isFree && !planId;
              const isCurrent = currentCode === plan.code;
              const selected = intendedPlan === plan.code;
              return (
                <Card key={plan.code} className={`flex rounded-lg bg-[#FFF8ED] p-5 ${selected ? "ring-2 ring-skybrand" : ""}`}>
                  <div className="flex min-h-[590px] w-full flex-col">
                    <div className="flex min-h-24 items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-black">{plan.name}</h2>
                        <p className="mt-2 text-sm leading-6 text-[#4B5563]">{plan.description}</p>
                      </div>
                      {isCurrent ? <Badge tone="green">Current plan</Badge> : plan.badge ? <Badge tone={plan.code === "free" ? "green" : "sky"}>{plan.badge}</Badge> : null}
                    </div>
                    <div className="mt-6">
                      <span className="text-4xl font-black">{plan.price}</span>
                      <span className="ml-2 text-sm font-bold text-[#4B5563]">{plan.cadence}</span>
                    </div>
                    <ul className="mt-6 flex-1 space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-2 text-sm leading-5 text-[#4B5563]">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#10B981]" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    {isFree ? (
                      <Button asChild variant="sky" className="mt-6 w-full">
                        <Link href={isAuthenticated ? "/dashboard" : "/register?returnTo=%2Fdashboard"}>
                          {isAuthenticated ? "Go to Dashboard" : "Start Free"}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : isCurrent ? (
                      <Button className="mt-6 w-full" variant="outline" disabled>Current plan</Button>
                    ) : isAuthenticated && isPaid ? (
                      // Starting a second checkout would bill the customer twice, so plan
                      // changes happen on the existing Whop membership.
                      <>
                        <Button asChild className="mt-6 w-full" variant="outline">
                          {manageUrl ? (
                            <a href={manageUrl} target="_blank" rel="noopener noreferrer">
                              Change plan on Whop
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : (
                            <a href={`mailto:${supportEmail}?subject=Change%20my%20Novoriq%20plan`}>
                              Contact support to change plan
                            </a>
                          )}
                        </Button>
                        <p className="mt-3 text-xs font-semibold text-[#4B5563]">
                          You already have a paid plan. Change it on your existing membership so you are not billed twice.
                        </p>
                      </>
                    ) : isAuthenticated ? (
                      <>
                        <Button
                          className="mt-6 w-full"
                          variant="sky"
                          onClick={() => beginUpgrade(plan)}
                          disabled={unavailable || !emailVerified}
                        >
                          Upgrade with Whop
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        {unavailable ? (
                          <p className="mt-3 text-xs font-semibold text-[#EF4444]">
                            Checkout is temporarily unavailable. Contact Novoriq support.
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <Button asChild className="mt-6 w-full" variant="sky">
                        <Link href={`/login?returnTo=${encodeURIComponent(`/pricing?plan=${plan.code}`)}`}>
                          Upgrade with Whop
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
      </main>

      {selectedPlan ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedPlan(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-dialog-title"
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge tone="sky">{selectedPlan.name}</Badge>
                <h2 id="checkout-dialog-title" className="mt-3 text-2xl font-black">Prepare Whop checkout</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedPlan(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#4B5563]">
              Checkout will use your Novoriq account email, and it is locked so your membership links to your account
              automatically. Novoriq will verify your Whop membership and apply the plan to your organization.
            </p>
            <div className="mt-4 rounded-lg bg-[#E0F2FE] p-4">
              <p className="text-xs font-black uppercase text-[#0369A1]">Signed in as</p>
              <p className="mt-1 break-all text-sm font-bold">{user?.email}</p>
            </div>
            <label className="mt-5 flex gap-3 text-sm font-semibold text-[#111827]">
              <input
                type="checkbox"
                checked={confirmedEmail}
                onChange={(event) => setConfirmedEmail(event.target.checked)}
                className="mt-1 h-4 w-4"
                autoFocus
              />
              <span>I understand this plan will be applied to {user?.email}.</span>
            </label>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button variant="sky" className="flex-1" disabled={!confirmedEmail || !selectedPlanId} onClick={continueToWhop}>
                <ShieldCheck className="h-4 w-4" />
                Continue to Whop
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setSelectedPlan(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      ) : null}
      <PublicFooter />
    </div>
  );
}