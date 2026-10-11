"use client";

import type { Role } from "@layoutcraft/db";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/(auth)/actions";
import { Pill } from "@/components/ui";
import { cn } from "@/lib/cn";

export function AppNav({
  orgName,
  userName,
  planLabel,
  role,
}: {
  orgName: string;
  userName: string;
  planLabel: string;
  role: Role;
}) {
  const pathname = usePathname();
  const isAdmin = role === "OWNER" || role === "ADMIN";

  const links = [
    { href: "/projects", label: "Projects" },
    { href: "/settings", label: "Studio" },
    ...(isAdmin ? [{ href: "/settings/billing", label: "Billing" }] : []),
  ];

  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
        <Link href="/projects" className="flex shrink-0 items-center gap-2.5">
          <svg viewBox="0 0 26 26" className="h-5 w-5" aria-hidden>
            <rect x="2" y="2" width="22" height="22" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M2 14h11V2M13 14v10M13 19h11" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M13 9a5 5 0 0 1 5 5" fill="none" stroke="var(--accent)" strokeWidth="2" />
          </svg>
          <span className="font-display text-[15.5px] font-bold tracking-[-0.015em]">
            Layoutcraft
          </span>
        </Link>

        <span className="hidden truncate text-[13px] text-muted sm:inline">{orgName}</span>
        <Pill>{planLabel}</Pill>

        <nav className="ml-auto flex items-center gap-1">
          {links.map((link) => {
            // /settings must not look active while on /settings/billing
            const active =
              link.href === "/settings"
                ? pathname === "/settings"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  active ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            );
          })}

          <span className="mx-1.5 hidden h-5 w-px bg-line sm:block" />
          <span className="hidden max-w-[16ch] truncate text-[12.5px] text-muted sm:inline">
            {userName}
          </span>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-sm btn-ghost" title="Sign out">
              <LogOut size={14} />
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
