import { PLAN_LIMITS, planLimits, prisma, type Plan, type SubscriptionStatus } from "@layoutcraft/db";
import Stripe from "stripe";
import { atLeast, type SessionContext } from "./auth.js";
import { AccessError } from "./errors.js";

/**
 * Stripe Billing.
 *
 * Price ids live in the environment rather than the database so that staging
 * and production can point at different Stripe accounts without a data
 * migration, and so a price change is a deploy rather than a schema edit.
 */

let client: Stripe | null = null;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new AccessError(
      "Billing is not configured on this deployment. Set STRIPE_SECRET_KEY.",
      503,
    );
  }
  client ??= new Stripe(key, { apiVersion: "2024-12-18.acacia" });
  return client;
}

export const billingConfigured = (): boolean => Boolean(process.env.STRIPE_SECRET_KEY);

/** Maps our plans to Stripe prices, per billing interval. */
export function priceIdFor(plan: Plan, interval: "month" | "year"): string | null {
  const key = `STRIPE_PRICE_${plan}_${interval.toUpperCase()}`;
  return process.env[key] ?? null;
}

/** Reverse lookup, for the webhook. */
export function planForPrice(priceId: string): Plan | null {
  for (const plan of ["SOLO", "STUDIO", "PRACTICE"] as Plan[]) {
    for (const interval of ["month", "year"] as const) {
      if (priceIdFor(plan, interval) === priceId) return plan;
    }
  }
  return null;
}

async function ensureCustomer(session: SessionContext): Promise<string> {
  const sub = await prisma.subscription.findUnique({ where: { orgId: session.orgId } });
  if (sub?.stripeCustomerId) return sub.stripeCustomerId;

  const org = await prisma.organization.findUnique({ where: { id: session.orgId } });
  const customer = await stripe().customers.create({
    email: session.user.email,
    name: org?.name ?? session.orgName,
    metadata: { orgId: session.orgId, orgSlug: session.orgSlug },
  });

  await prisma.subscription.upsert({
    where: { orgId: session.orgId },
    create: {
      orgId: session.orgId,
      stripeCustomerId: customer.id,
      plan: "TRIAL",
      status: "TRIALING",
    },
    update: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function startCheckout(
  session: SessionContext,
  options: { plan: Plan; interval: "month" | "year"; seats?: number; returnTo?: string },
): Promise<string> {
  if (!atLeast(session.role, "ADMIN")) {
    throw new AccessError("Only an owner or admin can change the subscription.");
  }
  const priceId = priceIdFor(options.plan, options.interval);
  if (!priceId) {
    throw new AccessError(
      `No Stripe price is configured for ${options.plan} billed ${options.interval}ly.`,
      503,
    );
  }

  const limits = planLimits(options.plan);
  const seats = Math.max(1, Math.min(options.seats ?? 1, limits.maxSeats < 0 ? 999 : limits.maxSeats));
  const customerId = await ensureCustomer(session);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const checkout = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: seats }],
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { orgId: session.orgId, plan: options.plan },
    },
    // so the webhook can act even if the browser never returns
    metadata: { orgId: session.orgId, plan: options.plan, seats: String(seats) },
    success_url: `${base}${options.returnTo ?? "/settings/billing"}?checkout=success`,
    cancel_url: `${base}${options.returnTo ?? "/settings/billing"}?checkout=cancelled`,
    billing_address_collection: "auto",
    // India requires a tax id field for business customers
    tax_id_collection: { enabled: true },
  });

  if (!checkout.url) throw new AccessError("Stripe did not return a checkout URL.", 502);
  return checkout.url;
}

export async function billingPortal(session: SessionContext): Promise<string> {
  if (!atLeast(session.role, "ADMIN")) {
    throw new AccessError("Only an owner or admin can manage billing.");
  }
  const customerId = await ensureCustomer(session);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const portal = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${base}/settings/billing`,
  });
  return portal.url;
}

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  unpaid: "PAST_DUE",
  incomplete: "INCOMPLETE",
  incomplete_expired: "CANCELED",
  paused: "CANCELED",
};

/**
 * Apply a Stripe subscription to our records.
 *
 * Driven entirely by webhooks rather than by the checkout redirect, because the
 * redirect is unreliable — the customer closes the tab, the network drops — and
 * a paid customer who appears unpaid is the worst bug a SaaS can have.
 */
export async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const existing = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  });
  const orgId = existing?.orgId ?? subscription.metadata?.orgId;
  if (!orgId) {
    console.warn("[layoutcraft] subscription webhook with no org", subscription.id);
    return;
  }

  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const plan = (subscription.metadata?.plan as Plan | undefined) ??
    (priceId ? planForPrice(priceId) : null) ??
    existing?.plan ??
    "TRIAL";

  await prisma.subscription.upsert({
    where: { orgId },
    create: {
      orgId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      plan,
      status: STATUS_MAP[subscription.status] ?? "INCOMPLETE",
      seats: item?.quantity ?? 1,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    },
    update: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      plan,
      status: STATUS_MAP[subscription.status] ?? "INCOMPLETE",
      seats: item?.quantity ?? 1,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    },
  });
}

export async function subscriptionFor(orgId: string) {
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  const seatsUsed = await prisma.membership.count({ where: { orgId } });
  const plan = sub?.plan ?? "TRIAL";
  return {
    subscription: sub,
    limits: planLimits(plan),
    seatsUsed,
    allPlans: PLAN_LIMITS,
  };
}
