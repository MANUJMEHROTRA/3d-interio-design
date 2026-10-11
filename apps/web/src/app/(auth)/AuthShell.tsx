import Link from "next/link";

/** The framing around sign-in and sign-up, so the two pages cannot drift apart. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="mb-7 flex items-center gap-2.5">
          <svg viewBox="0 0 26 26" className="h-6 w-6" aria-hidden>
            <rect x="2" y="2" width="22" height="22" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M2 14h11V2M13 14v10M13 19h11" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M13 9a5 5 0 0 1 5 5" fill="none" stroke="var(--accent)" strokeWidth="2" />
          </svg>
          <span className="font-display text-[18px] font-bold tracking-[-0.015em]">Layoutcraft</span>
        </Link>

        <h1 className="m-0 font-display text-[26px] font-bold tracking-tight">{title}</h1>
        <p className="mb-6 mt-1.5 text-[13.5px] text-muted">{subtitle}</p>

        <div className="card p-5">{children}</div>

        <p className="mt-5 text-center text-[13px] text-muted">{footer}</p>
      </div>
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="m-0 rounded-lg bg-bad-soft px-3 py-2 text-[12.5px] text-bad" role="alert">
      {message}
    </p>
  );
}
