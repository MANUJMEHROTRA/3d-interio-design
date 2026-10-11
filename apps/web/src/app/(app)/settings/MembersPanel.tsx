"use client";

import type { Role } from "@layoutcraft/db";
import { Copy, UserPlus, X } from "lucide-react";
import { useActionState, useState } from "react";
import { Note, Pill, Section, Spinner } from "@/components/ui";
import {
  changeRoleAction,
  inviteAction,
  removeMemberAction,
  type ActionResult,
} from "./actions";

interface Member {
  id: string;
  role: Role;
  userId: string;
  name: string | null;
  email: string;
  lastSeenAt: string | null;
}

interface Invite {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
}

const ROLE_NOTE: Record<Role, string> = {
  OWNER: "Everything, including billing and deleting the studio.",
  ADMIN: "Everything except transferring ownership.",
  DESIGNER: "Create and edit projects, share links with clients.",
  VIEWER: "Look at projects and quotes. Cannot change anything.",
};

export function MembersPanel({
  members,
  invites,
  canEdit,
  isOwner,
  currentUserId,
}: {
  members: Member[];
  invites: Invite[];
  canEdit: boolean;
  isOwner: boolean;
  currentUserId: string;
}) {
  const [inviteState, inviteSubmit, inviting] = useActionState<ActionResult, FormData>(
    inviteAction,
    {},
  );
  const [roleState, roleSubmit] = useActionState<ActionResult, FormData>(changeRoleAction, {});
  const [removeState, removeSubmit] = useActionState<ActionResult, FormData>(
    removeMemberAction,
    {},
  );
  const [copied, setCopied] = useState(false);

  const error = inviteState.error ?? roleState.error ?? removeState.error;

  return (
    <Section title="People">
      {error ? (
        <p className="m-0 rounded-lg bg-bad-soft px-3 py-2 text-[12.5px] text-bad">{error}</p>
      ) : null}

      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-xl border border-line bg-paper p-0">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line2 px-3 py-2.5 first:border-t-0"
          >
            <div className="min-w-0 flex-1">
              <b className="block truncate text-[13.5px] font-semibold">
                {member.name ?? member.email}
                {member.userId === currentUserId ? (
                  <span className="ml-1.5 font-normal text-muted">you</span>
                ) : null}
              </b>
              <span className="block truncate text-[12px] text-muted">
                {member.email}
                {member.lastSeenAt
                  ? ` · last seen ${new Date(member.lastSeenAt).toLocaleDateString()}`
                  : " · never signed in"}
              </span>
            </div>

            {canEdit && member.role !== "OWNER" ? (
              <form action={roleSubmit}>
                <input type="hidden" name="membershipId" value={member.id} />
                <select
                  className="input w-auto py-1.5 text-[12.5px]"
                  name="role"
                  defaultValue={member.role}
                  onChange={(event) => event.currentTarget.form?.requestSubmit()}
                >
                  <option value="DESIGNER">Designer</option>
                  <option value="ADMIN">Admin</option>
                  <option value="VIEWER">Viewer</option>
                  {isOwner ? <option value="OWNER">Make owner</option> : null}
                </select>
              </form>
            ) : (
              <Pill tone={member.role === "OWNER" ? "ok" : "on"}>{member.role.toLowerCase()}</Pill>
            )}

            {canEdit && member.role !== "OWNER" && member.userId !== currentUserId ? (
              <form action={removeSubmit}>
                <input type="hidden" name="membershipId" value={member.id} />
                <button
                  type="submit"
                  className="btn btn-sm btn-danger"
                  aria-label={`Remove ${member.email}`}
                >
                  <X size={13} />
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      {invites.length ? (
        <>
          <h4 className="label-caps m-0 mt-2">Waiting to accept</h4>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[12.5px] text-muted">
            {invites.map((invite) => (
              <li key={invite.id}>
                {invite.email} · {invite.role.toLowerCase()} · expires{" "}
                {new Date(invite.expiresAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {canEdit ? (
        <>
          <form action={inviteSubmit} className="mt-2 flex flex-wrap items-end gap-2">
            <label className="field flex-1">
              <span>Invite by email</span>
              <input className="input" type="email" name="email" required placeholder="name@studio.com" />
            </label>
            <label className="field">
              <span>Role</span>
              <select className="input" name="role" defaultValue="DESIGNER">
                <option value="DESIGNER">Designer</option>
                <option value="ADMIN">Admin</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </label>
            <button type="submit" className="btn mb-[1px]" disabled={inviting}>
              {inviting ? <Spinner /> : <UserPlus size={14} />} Invite
            </button>
          </form>

          {inviteState.inviteUrl ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent bg-accent-soft px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <b className="block text-[12.5px]">Send them this link</b>
                <code className="block truncate font-mono text-[11.5px]">
                  {inviteState.inviteUrl}
                </code>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteState.inviteUrl!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                <Copy size={13} /> {copied ? "Copied" : "Copy"}
              </button>
            </div>
          ) : null}

          <Note>
            Email delivery is not wired up on this deployment, so invitations are handed to you as a
            link to send yourself. Roles: {Object.entries(ROLE_NOTE).map(([role, note], i) => (
              <span key={role}>
                {i > 0 ? " " : ""}
                <b className="font-semibold">{role.toLowerCase()}</b> — {note}
              </span>
            ))}
          </Note>
        </>
      ) : null}
    </Section>
  );
}
