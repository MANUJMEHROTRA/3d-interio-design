import { redirect } from "next/navigation";
import { planLimits } from "@layoutcraft/db";
import { getSession, type SessionContext } from "./auth.js";
import { AccessError } from "./errors.js";

/**
 * Page and route guards.
 *
 * `requireSession` redirects, because that is what a page should do. `apiSession`
 * throws, because that is what a route handler should do. Keeping the two
 * separate avoids pages that return JSON errors and endpoints that 302.
 */

export async function requireSession(returnTo?: string): Promise<SessionContext> {
  const session = await getSession();
  if (!session) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/login${next}`);
  }
  return session;
}

export async function apiSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) throw new AccessError("Sign in to continue.", 401);
  return session;
}

/** Gate a feature on the plan, with a message naming what to do about it. */
export function requireFeature(
  session: SessionContext,
  feature: "stillRender" | "modelExport" | "printExport" | "shareLinks" | "whiteLabel",
  label: string,
): void {
  const limits = planLimits(session.plan);
  if (!limits[feature]) {
    throw new AccessError(
      `${label} is not included in the ${limits.label} plan. Upgrade from Settings → Billing.`,
      402,
    );
  }
}

/** Clamp a requested render quality to what the plan allows. */
export function allowedQuality(
  session: SessionContext,
  requested: "draft" | "standard" | "high",
): "draft" | "standard" | "high" {
  const order = { draft: 0, standard: 1, high: 2 } as const;
  const max = planLimits(session.plan).maxQuality;
  return order[requested] > order[max] ? max : requested;
}
