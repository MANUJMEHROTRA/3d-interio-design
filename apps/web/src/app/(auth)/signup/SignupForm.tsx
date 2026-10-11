"use client";

import { useActionState } from "react";
import { Spinner } from "@/components/ui";
import { signupAction, type AuthState } from "../actions";
import { FormError } from "../AuthShell";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signupAction, {});

  return (
    <form action={action} className="flex flex-col gap-3.5">
      <FormError message={state.error} />

      <label className="field">
        <span>Your name</span>
        <input className="input" name="name" autoComplete="name" required autoFocus />
      </label>

      <label className="field">
        <span>Studio name</span>
        <input
          className="input"
          name="studioName"
          autoComplete="organization"
          placeholder="Appears on your quotations"
        />
      </label>

      <label className="field">
        <span>Email</span>
        <input className="input" type="email" name="email" autoComplete="email" required />
      </label>

      <label className="field">
        <span>Password</span>
        <input
          className="input"
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        <span className="text-[11px] text-muted">At least 10 characters.</span>
      </label>

      <button type="submit" className="btn btn-primary mt-1" disabled={pending}>
        {pending ? <Spinner /> : null} Create my studio
      </button>
    </form>
  );
}
