"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate, createSession, destroySession, registerStudio } from "@/server";

/**
 * Auth as server actions rather than API routes.
 *
 * The forms post directly, so sign-in works with JavaScript disabled and there
 * is no client-side token handling to get wrong.
 */

export interface AuthState {
  error?: string;
}

const safeNext = (value: FormDataEntryValue | null): string => {
  const next = typeof value === "string" ? value : "";
  // only same-origin paths, or this becomes an open redirect
  return next.startsWith("/") && !next.startsWith("//") ? next : "/projects";
};

async function requestMeta() {
  const list = await headers();
  return {
    userAgent: list.get("user-agent") ?? undefined,
    ip:
      list.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      list.get("x-real-ip") ??
      undefined,
  };
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const result = await authenticate(email, password);
  if (!result.ok) return { error: result.error };

  await createSession(result.userId, await requestMeta());
  redirect(safeNext(formData.get("next")));
}

export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "");
  const studioName = String(formData.get("studioName") ?? "");

  if (!email || !password || !name) {
    return { error: "Fill in your name, email and a password." };
  }

  const result = await registerStudio({ email, password, name, studioName });
  if (!result.ok) return { error: result.error };

  await createSession(result.userId, await requestMeta());
  redirect("/projects?welcome=1");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
