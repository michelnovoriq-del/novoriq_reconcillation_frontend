"use client";

import Script from "next/script";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { useAuth } from "@/lib/hooks/use-auth";

const planIds = {
  professional: process.env.NEXT_PUBLIC_WHOP_PROFESSIONAL_PLAN_ID ?? "",
  firm: process.env.NEXT_PUBLIC_WHOP_FIRM_PLAN_ID ?? "",
  enterprise: process.env.NEXT_PUBLIC_WHOP_ENTERPRISE_PLAN_ID ?? "",
} as const;

type PaidPlan = keyof typeof planIds;

function isPaidPlan(value: string | null): value is PaidPlan {
  return value === "professional" || value === "firm" || value === "enterprise";
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
      {children}
      <p className="mt-4">
        <Link className="font-bold underline" href="/pricing">Back to pricing</Link>
      </p>
    </div>
  );
}

function CheckoutContent() {
  const params = useSearchParams();
  const { user, account } = useAuth();

  const plan = params.get("plan");
  // Plan IDs come only from this fixed allow-list; query parameters never choose an ID.
  const planId = isPaidPlan(plan) ? planIds[plan] : "";

  // The email comes from the signed-in account, never from the URL.
  const email = user?.email ?? "";
  const emailVerified = Boolean(account?.user.email_verified);
  const alreadyPaid = Boolean(account && account.subscription.plan_code !== "free");

  // Wait for the browser origin so the checkout renders once with every attribute set.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const ready = Boolean(planId && email && emailVerified && !alreadyPaid && origin);

  // Whop's loader discovers the checkout element; nudge it when the element appears.
  useEffect(() => {
    if (ready) window.dispatchEvent(new Event("whop-checkout-ready"));
  }, [ready]);

  let body: React.ReactNode;

  if (!planId) {
    body = <Notice>This plan is not ready for checkout. Return to pricing or contact support.</Notice>;
  } else if (!account) {
    body = <p className="mt-6 text-slate-600">Loading your account...</p>;
  } else if (!emailVerified) {
    body = <Notice>Verify your email address first. Paid plans are only applied to verified emails. You can resend the verification email from the pricing page.</Notice>;
  } else if (alreadyPaid) {
    body = <Notice>You already have a paid plan. Change it from your existing Whop membership so you are not billed twice.</Notice>;
  } else if (!ready) {
    body = <p className="mt-6 text-slate-600">Preparing checkout...</p>;
  } else {
    body = (
      <>
        <p className="mt-4 text-slate-600">
          Payment is securely processed by Whop. We pre-filled your Novoriq account email ({email}) so the membership can be linked automatically. Please keep it unchanged.
        </p>
        <Script src="https://js.whop.com/static/checkout/loader.js" strategy="afterInteractive" />
        <div
          className="mt-8 min-h-64 rounded-2xl bg-white p-2 shadow-soft"
          data-whop-checkout-plan-id={planId}
          data-whop-checkout-prefill-email={email}
          data-whop-checkout-return-url={`${origin}/billing/return`}
        />
        <p className="mt-5 text-sm text-slate-600">
          After payment, return to <Link className="font-bold text-deepblue underline" href="/billing/return">billing status</Link>. Access activates after Whop confirms your membership.
        </p>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-cream text-ink">
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-5 py-14 sm:px-8">
        <p className="text-sm font-black uppercase tracking-[.18em] text-deepblue">Secure checkout</p>
        <h1 className="mt-3 text-4xl font-black">Complete your Novoriq upgrade</h1>
        {body}
      </main>
      <PublicFooter />
    </div>
  );
}

export default function BillingCheckoutPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={null}>
        <CheckoutContent />
      </Suspense>
    </ProtectedRoute>
  );
}