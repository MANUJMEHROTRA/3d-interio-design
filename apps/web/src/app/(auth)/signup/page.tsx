import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, TRIAL_DAYS } from "@/server";
import { AuthShell } from "../AuthShell";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Start a trial" };

export default async function SignupPage() {
  if (await getSession()) redirect("/projects");

  return (
    <AuthShell
      title="Start your studio"
      subtitle={`${TRIAL_DAYS} days, three projects, the whole editor. No card needed.`}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
