import { CURRENCIES, formatMoney } from "@layoutcraft/core";
import { planLimits, type ProjectStatus } from "@layoutcraft/db";
import type { Metadata } from "next";
import Link from "next/link";
import { listProjects, projectQuota, requireSession } from "@/server";
import { Pill } from "@/components/ui";
import { NewProjectButtons } from "./NewProjectButtons";

export const metadata: Metadata = { title: "Projects" };

const STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFT: "Draft",
  QUOTED: "Quoted",
  APPROVED: "Approved",
  IN_PRODUCTION: "In production",
  COMPLETED: "Completed",
  LOST: "Lost",
};

const STATUS_TONE: Record<ProjectStatus, "on" | "ok" | "warn" | "bad"> = {
  DRAFT: "on",
  QUOTED: "warn",
  APPROVED: "ok",
  IN_PRODUCTION: "ok",
  COMPLETED: "ok",
  LOST: "bad",
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const session = await requireSession("/projects");
  const [projects, quota, { welcome }] = await Promise.all([
    listProjects(session),
    projectQuota(session),
    searchParams,
  ]);
  const limits = planLimits(session.plan);

  const pipeline = projects
    .filter((p) => p.status === "QUOTED" || p.status === "APPROVED" || p.status === "IN_PRODUCTION")
    .reduce((sum, p) => sum + p.quoteTotal, 0);
  const inr = CURRENCIES.INR!;

  return (
    <div className="flex flex-col gap-6">
      {welcome ? (
        <div className="rounded-xl border border-accent bg-accent-soft p-4">
          <h2 className="m-0 font-display text-[16px] font-bold">Your studio is ready.</h2>
          <p className="m-0 mt-1 text-[13.5px]">
            Start from the sample 2BHK to see what a finished project looks like, then put your
            studio details on your quotations in{" "}
            <Link href="/settings" className="underline">
              Studio settings
            </Link>
            .
          </p>
        </div>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 font-display text-[26px] font-bold tracking-tight">Projects</h1>
          <p className="m-0 mt-1 text-[13px] text-muted">
            {projects.length} project{projects.length === 1 ? "" : "s"}
            {quota.limit >= 0 ? ` of ${quota.limit} on the ${limits.label} plan` : ""}
            {pipeline > 0 ? ` · ${formatMoney(pipeline, inr, true)} quoted or won` : ""}
          </p>
        </div>
        <NewProjectButtons
          disabled={!session.canEdit || (quota.limit >= 0 && quota.remaining <= 0)}
          quotaMessage={
            quota.limit >= 0 && quota.remaining <= 0
              ? `The ${limits.label} plan includes ${quota.limit} projects.`
              : undefined
          }
        />
      </header>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
          <h2 className="m-0 font-display text-[18px] font-semibold">Nothing here yet</h2>
          <p className="mx-auto mt-2 max-w-[48ch] text-[13.5px] text-muted">
            Start from the sample 2BHK — it is fully furnished and priced, so you can see the whole
            workflow before you draw anything of your own.
          </p>
          <div className="mt-5 flex justify-center">
            <NewProjectButtons disabled={!session.canEdit} />
          </div>
        </div>
      ) : (
        <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const currency = CURRENCIES[project.currency] ?? inr;
            return (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex h-full flex-col gap-3 rounded-xl border border-line bg-paper p-4 shadow-card transition-colors hover:border-muted"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <b className="block truncate font-display text-[15.5px] font-semibold">
                        {project.name}
                      </b>
                      <span className="block truncate text-[12.5px] text-muted">
                        {project.clientName || "No client yet"}
                      </span>
                    </div>
                    <Pill tone={STATUS_TONE[project.status]}>{STATUS_LABEL[project.status]}</Pill>
                  </div>

                  <dl className="m-0 grid grid-cols-3 gap-2 text-[12px]">
                    <Stat label="Rooms" value={String(project.roomCount)} />
                    <Stat label="Pieces" value={String(project.itemCount)} />
                    <Stat
                      label="Quote"
                      value={formatMoney(project.quoteTotal, currency, true)}
                    />
                  </dl>

                  <p className="m-0 mt-auto flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
                    <span>
                      Edited{" "}
                      {new Date(project.updatedAt).toLocaleDateString(currency.locale, {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    {project._count.shareLinks > 0 ? (
                      <span>
                        · {project._count.shareLinks} share link
                        {project._count.shareLinks === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    {project._count.comments > 0 ? (
                      <span className="text-accent">
                        · {project._count.comments} client comment
                        {project._count.comments === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="truncate text-[10.5px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className="tnum m-0 truncate text-[13px] font-medium">{value}</dd>
    </div>
  );
}
