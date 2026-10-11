import { prisma } from "@layoutcraft/db";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, syncSubscription } from "@/server";

/**
 * Stripe webhook.
 *
 * The signature is verified against the raw body — which is why this route
 * reads `request.text()` rather than `request.json()`, and why it must not be
 * wrapped in any body-parsing middleware. An unverified webhook is an endpoint
 * that lets anyone on the internet grant themselves a subscription.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature, secret);
  } catch (error) {
    console.warn("[layoutcraft] rejected a webhook with a bad signature", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkout = event.data.object;
        if (checkout.subscription) {
          const id =
            typeof checkout.subscription === "string"
              ? checkout.subscription
              : checkout.subscription.id;
          const subscription = await stripe().subscriptions.retrieve(id);
          // the checkout carries the org; the subscription may not
          if (checkout.metadata?.orgId && !subscription.metadata?.orgId) {
            subscription.metadata = { ...subscription.metadata, ...checkout.metadata };
          }
          await syncSubscription(subscription);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await syncSubscription(event.data.object);
        break;

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          await prisma.subscription.updateMany({
            where: { stripeCustomerId: customerId },
            data: { status: "PAST_DUE" },
          });
        }
        break;
      }

      default:
        // Everything else is acknowledged and ignored. Returning a 200 for
        // unhandled types stops Stripe retrying events we do not care about.
        break;
    }
  } catch (error) {
    // A 500 makes Stripe retry, which is what we want for a transient
    // database failure — the event must not be silently lost.
    console.error("[layoutcraft] webhook handler failed", event.type, error);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
