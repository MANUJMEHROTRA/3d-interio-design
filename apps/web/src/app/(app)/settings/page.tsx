import { CURRENCY_LIST } from "@layoutcraft/core";
import type { Metadata } from "next";
import { getOrg, requireSession } from "@/server";
import { MembersPanel } from "./MembersPanel";
import { StudioForm } from "./StudioForm";

export const metadata: Metadata = { title: "Studio settings" };

export default async function SettingsPage() {
  const session = await requireSession("/settings");
  const org = await getOrg(session);
  const isAdmin = session.role === "OWNER" || session.role === "ADMIN";

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="m-0 font-display text-[26px] font-bold tracking-tight">Studio</h1>
        <p className="m-0 mt-1 text-[13px] text-muted">
          These details appear on every quotation and on the pages your clients open.
        </p>
      </header>

      <StudioForm
        canEdit={isAdmin}
        currencies={CURRENCY_LIST.map((c) => ({ code: c.code, symbol: c.symbol }))}
        initial={{
          name: org.name,
          studioName: org.studioName ?? "",
          studioAddress: org.studioAddress ?? "",
          studioContact: org.studioContact ?? "",
          taxId: org.taxId ?? "",
          logoUrl: org.logoUrl ?? "",
          brandColor: org.brandColor ?? "",
          defaultCurrency: org.defaultCurrency,
          defaultUnits: org.defaultUnits,
          defaultTaxLabel: org.defaultTaxLabel,
          defaultTaxRate: org.defaultTaxRate,
          defaultTerms: org.defaultTerms ?? "",
        }}
      />

      <MembersPanel
        canEdit={isAdmin}
        currentUserId={session.user.id}
        isOwner={session.role === "OWNER"}
        members={org.members.map((m) => ({
          id: m.id,
          role: m.role,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          lastSeenAt: m.user.lastSeenAt?.toISOString() ?? null,
        }))}
        invites={org.invites.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          expiresAt: i.expiresAt.toISOString(),
        }))}
      />
    </div>
  );
}
