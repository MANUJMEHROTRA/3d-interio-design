"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@layoutcraft/db";
import {
  AccessError,
  audit,
  changeRole,
  inviteMember,
  removeMember,
  requireSession,
  updateStudio,
} from "@/server";

export interface ActionResult {
  ok?: boolean;
  error?: string;
  /** The invite URL, which the admin copies and sends themselves. */
  inviteUrl?: string;
}

const fail = (error: unknown): ActionResult => ({
  error: error instanceof AccessError ? error.message : "That did not work. Please try again.",
});

const str = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();

export async function saveStudioAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const rate = Number(formData.get("defaultTaxRate"));
    await updateStudio(session, {
      name: str(formData, "name"),
      studioName: str(formData, "studioName") || null,
      studioAddress: str(formData, "studioAddress") || null,
      studioContact: str(formData, "studioContact") || null,
      taxId: str(formData, "taxId") || null,
      logoUrl: str(formData, "logoUrl") || null,
      brandColor: str(formData, "brandColor") || null,
      defaultCurrency: str(formData, "defaultCurrency") || "INR",
      defaultUnits: str(formData, "defaultUnits") || "metric",
      defaultTaxLabel: str(formData, "defaultTaxLabel") || "GST",
      defaultTaxRate: Number.isFinite(rate) ? rate : 18,
      defaultTerms: str(formData, "defaultTerms") || null,
    });
    await audit(session, "studio.update");
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function inviteAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const email = str(formData, "email");
    const role = (str(formData, "role") || "DESIGNER") as Role;
    const { token } = await inviteMember(session, email, role);
    await audit(session, "member.invite", email, { role });
    revalidatePath("/settings");

    // There is no mail transport configured yet, so the admin is handed the
    // link to send themselves. That is a deliberate stop-gap, not an oversight:
    // a silently un-sent invitation is worse than one you have to paste.
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return { ok: true, inviteUrl: `${base}/invite/${token}` };
  } catch (error) {
    return fail(error);
  }
}

export async function changeRoleAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const membershipId = str(formData, "membershipId");
    const role = str(formData, "role") as Role;
    await changeRole(session, membershipId, role);
    await audit(session, "member.role", membershipId, { role });
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function removeMemberAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const membershipId = str(formData, "membershipId");
    await removeMember(session, membershipId);
    await audit(session, "member.remove", membershipId);
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
