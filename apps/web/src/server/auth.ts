import { prisma, type Role } from "@layoutcraft/db";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Session handling.
 *
 * Sessions are opaque random tokens stored in an httpOnly cookie, with only a
 * SHA-256 of the token in the database. A stolen database dump therefore
 * contains no usable sessions, and we can revoke one by deleting a row —
 * neither of which a self-contained JWT gives you.
 */

export const SESSION_COOKIE = "lc_session";
const SESSION_DAYS = 30;
/** bcrypt work factor. 12 is ~250 ms on current server hardware. */
const BCRYPT_ROUNDS = 12;

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, BCRYPT_ROUNDS);

export const verifyPassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);

/** Constant-time comparison for tokens we look up by hash. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface SessionContext {
  user: SessionUser;
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: Role;
  plan: string;
  subscriptionStatus: string;
  /** True when the subscription is in a state that still permits editing. */
  canEdit: boolean;
  trialEndsAt: Date | null;
}

/** Issue a session and set the cookie. */
export async function createSession(
  userId: string,
  meta: { userAgent?: string; ip?: string } = {},
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 400),
      ip: meta.ip?.slice(0, 64),
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } }).catch(() => {});
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Resolve the current request to a user and their active organisation.
 * Returns null rather than throwing, so a page can decide whether to redirect.
 */
export async function getSession(): Promise<SessionContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        include: {
          memberships: {
            include: { organization: { include: { subscription: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  const membership = session.user.memberships[0];
  if (!membership) return null;

  const org = membership.organization;
  const sub = org.subscription;
  const status = sub?.status ?? "TRIALING";
  const trialExpired =
    status === "TRIALING" && sub?.trialEndsAt ? sub.trialEndsAt < new Date() : false;

  // Past-due is intentionally still editable: locking a designer out mid-
  // presentation over a failed card is a good way to lose the customer.
  const canEdit =
    !trialExpired && (status === "ACTIVE" || status === "TRIALING" || status === "PAST_DUE");

  // touch lastSeenAt at most once an hour
  const lastSeen = session.user.lastSeenAt;
  if (!lastSeen || Date.now() - lastSeen.getTime() > 3_600_000) {
    void prisma.user
      .update({ where: { id: session.user.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatarUrl: session.user.avatarUrl,
    },
    orgId: org.id,
    orgName: org.name,
    orgSlug: org.slug,
    role: membership.role,
    plan: trialExpired ? "TRIAL" : (sub?.plan ?? "TRIAL"),
    subscriptionStatus: trialExpired ? "EXPIRED" : status,
    canEdit,
    trialEndsAt: sub?.trialEndsAt ?? null,
  };
}

/* ------------------------------------------------------------------ *
 * Sign-up
 * ------------------------------------------------------------------ */

const SLUG_MAX = 40;

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, SLUG_MAX) || "studio"
  );
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base);
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const taken = await prisma.organization.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
  }
  return `${root}-${randomBytes(3).toString("hex")}`;
}

export const TRIAL_DAYS = 14;

/**
 * Create a user, their studio and a trial subscription in one transaction.
 * A half-created account that cannot be billed or logged into is worse than a
 * failed sign-up, so this is all-or-nothing.
 */
export async function registerStudio(input: {
  email: string;
  password: string;
  name: string;
  studioName: string;
}): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: "That does not look like an email address." };
  }
  if (input.password.length < 10) {
    return { ok: false, error: "Use at least 10 characters for your password." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account already exists for that email. Try signing in." };
  }

  const passwordHash = await hashPassword(input.password);
  const slug = await uniqueSlug(input.studioName || input.name || email.split("@")[0]!);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, name: input.name.trim() || null, passwordHash },
    });
    const org = await tx.organization.create({
      data: {
        name: input.studioName.trim() || `${input.name.trim() || "My"} studio`,
        slug,
        studioName: input.studioName.trim() || null,
      },
    });
    await tx.membership.create({
      data: { userId: created.id, orgId: org.id, role: "OWNER" },
    });
    await tx.subscription.create({
      data: { orgId: org.id, plan: "TRIAL", status: "TRIALING", trialEndsAt, seats: 1 },
    });
    return created;
  });

  return { ok: true, userId: user.id };
}

export async function authenticate(
  email: string,
  password: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  // Always run a bcrypt comparison so a missing account and a wrong password
  // take the same time, and the endpoint cannot be used to enumerate emails.
  const hash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";
  const valid = await verifyPassword(password, hash);

  if (!user || !user.passwordHash || !valid) {
    return { ok: false, error: "That email and password do not match." };
  }
  return { ok: true, userId: user.id };
}

/* ------------------------------------------------------------------ *
 * Role checks
 * ------------------------------------------------------------------ */

const RANK: Record<Role, number> = { VIEWER: 0, DESIGNER: 1, ADMIN: 2, OWNER: 3 };

export const atLeast = (role: Role, required: Role): boolean =>
  RANK[role] >= RANK[required];

export const hashToken = sha256;
export const newToken = (): string => randomBytes(32).toString("base64url");
