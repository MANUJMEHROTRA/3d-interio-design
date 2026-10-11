import { Lock } from "lucide-react";

/**
 * Password prompt for a protected link.
 *
 * A plain GET form, so it works without JavaScript. The password travels as a
 * query parameter, which is why the page sets `noindex` and why the server
 * re-checks it on every request rather than issuing a cookie.
 */
export function PasswordGate({ token, wrong }: { token: string; wrong: boolean }) {
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <form action={`/share/${token}`} method="get" className="w-full max-w-[380px]">
        <div className="card flex flex-col gap-3.5 p-5">
          <span className="text-accent">
            <Lock size={18} />
          </span>
          <h1 className="m-0 font-display text-[20px] font-bold tracking-tight">
            This link is protected
          </h1>
          <p className="m-0 text-[13px] text-muted">
            Enter the password your designer gave you.
          </p>

          {wrong ? (
            <p className="m-0 rounded-lg bg-bad-soft px-3 py-2 text-[12.5px] text-bad" role="alert">
              That password is not right.
            </p>
          ) : null}

          <label className="field">
            <span>Password</span>
            <input className="input" type="password" name="pw" required autoFocus />
          </label>

          <button type="submit" className="btn btn-primary">
            Open the design
          </button>
        </div>
      </form>
    </div>
  );
}
