"use client";

import { useActionState } from "react";
import { Spinner } from "@/components/ui";
import { loginAction, type AuthState } from "../actions";
import { FormError } from "../AuthShell";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, {});

  return (
    <form action={action} className="flex flex-col gap-3.5">
      <FormError message={state.error} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <label className="field">
        <span>Email</span>
        <input
          className="input"
          type="email"
          name="email"
          autoComplete="email"
          required
          autoFocus
        />
      </label>

      <label className="field">
        <span>Password</span>
        <input
          className="input"
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>

      <button type="submit" className="btn btn-primary mt-1" disabled={pending}>
        {pending ? <Spinner /> : null} Sign in
      </button>
    </form>
  );
}
