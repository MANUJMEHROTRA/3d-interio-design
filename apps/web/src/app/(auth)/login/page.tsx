import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server";
import { AuthShell } from "../AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getSession()) redirect("/projects");
  const { next } = await searchParams;

  return (
    <AuthShell
      title="Sign in"
      subtitle="Open your studio's projects."
      footer={
        <>
          No account yet?{" "}
          <Link href="/signup" className="text-accent hover:underline">
            Start a 14-day trial
          </Link>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
