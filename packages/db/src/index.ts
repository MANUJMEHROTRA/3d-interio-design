import { PrismaClient } from "@prisma/client";

/**
 * One Prisma client per process.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * connection pool on every save until Postgres refuses them, so the client is
 * stashed on the global object.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";

/* ------------------------------------------------------------------ *
 * Plan limits
 * ------------------------------------------------------------------ */

export interface PlanLimits {
  label: string;
  /** Monthly price per seat, in INR and USD. */
  priceInr: number;
  priceUsd: number;
  /** -1 means unlimited. */
  maxProjects: number;
  maxSeats: number;
  /** Highest render quality this plan may select. */
  maxQuality: "draft" | "standard" | "high";
  /** Client-facing share links. */
  shareLinks: boolean;
  /** High-resolution still renders. */
  stillRender: boolean;
  /** OBJ/MTL export for a visualiser. */
  modelExport: boolean;
  /** 3D-print STL bundle. */
  printExport: boolean;
  /** Remove Layoutcraft branding from client-facing pages. */
  whiteLabel: boolean;
  /** Version history retained, in days. -1 for unlimited. */
  historyDays: number;
  features: string[];
}

/**
 * Deliberately gated on what a studio of each size actually needs rather than
 * on arbitrary quotas: a sole practitioner needs unlimited projects far more
 * than they need five seats, so projects are generous and seats are the lever.
 */
export const PLAN_LIMITS: Record<string, PlanLimits> = {
  TRIAL: {
    label: "Trial",
    priceInr: 0,
    priceUsd: 0,
    maxProjects: 3,
    maxSeats: 1,
    maxQuality: "standard",
    shareLinks: true,
    stillRender: false,
    modelExport: false,
    printExport: false,
    whiteLabel: false,
    historyDays: 7,
    features: ["3 projects", "Full editor and 3D view", "Client share links", "14 days"],
  },
  SOLO: {
    label: "Solo",
    priceInr: 2400,
    priceUsd: 29,
    maxProjects: -1,
    maxSeats: 1,
    maxQuality: "high",
    shareLinks: true,
    stillRender: true,
    modelExport: false,
    printExport: true,
    whiteLabel: false,
    historyDays: 30,
    features: [
      "Unlimited projects",
      "4K still renders",
      "Quote and BOM export",
      "3D-print bundle",
      "30-day version history",
    ],
  },
  STUDIO: {
    label: "Studio",
    priceInr: 2000,
    priceUsd: 24,
    maxProjects: -1,
    maxSeats: 10,
    maxQuality: "high",
    shareLinks: true,
    stillRender: true,
    modelExport: true,
    printExport: true,
    whiteLabel: true,
    historyDays: 180,
    features: [
      "Everything in Solo",
      "Up to 10 seats",
      "Your branding on client pages",
      "OBJ export for visualisers",
      "Client comments on share links",
      "180-day version history",
    ],
  },
  PRACTICE: {
    label: "Practice",
    priceInr: 1800,
    priceUsd: 21,
    maxProjects: -1,
    maxSeats: -1,
    maxQuality: "high",
    shareLinks: true,
    stillRender: true,
    modelExport: true,
    printExport: true,
    whiteLabel: true,
    historyDays: -1,
    features: [
      "Everything in Studio",
      "Unlimited seats",
      "Shared rate cards",
      "Audit log",
      "Unlimited version history",
      "Priority support",
    ],
  },
};

export const planLimits = (plan: string): PlanLimits =>
  PLAN_LIMITS[plan] ?? PLAN_LIMITS.TRIAL!;
