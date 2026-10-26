import { ArrowUpRight, Clock, FolderKanban, Plus } from "lucide-react";
import Link from "next/link";
import { createProject } from "@/app/actions";
import { EmptyState, PageHeader, ProjectAvatar } from "@/components/ui";
import { getProjects, getProjectStats } from "@/lib/data";
import { formatDay, formatMinutes } from "@/lib/dates";
import { requireUserId } from "@/lib/session";
import { plural, STATUS } from "@/lib/ui";
import SubmitButton from "@/components/SubmitButton";

export default async function ProjectsPage() {
  const userId = await requireUserId();
  const [projects, stats] = await Promise.all([getProjects(userId), getProjectStats(userId)]);
  const active = projects.filter((p) => p.status === "active").length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`${plural(projects.length, "project")} · ${active} active`}
        title="Projects"
        description="Things you're running. Claude links each log item to the right one."
        actions={
          <form action={createProject} className="flex gap-2">
            <input name="name" placeholder="New project name" className="input w-48" required />
            <SubmitButton className="btn">
              <Plus className="size-4" />
              Add
            </SubmitButton>
          </form>
        }
      />

      {projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet">
          When your log names a side project, an app or an open-source repo, Claude will offer to create it. You can also add one above.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const s = stats.get(p.id);
            const total = s?.item_count ?? 0;
            const openCount = s?.open_count ?? 0;
            const pct = total ? Math.round(((total - openCount) / total) * 100) : 0;
            const status = STATUS[p.status];
            return (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="card group flex h-full flex-col gap-5 transition hover:-translate-y-0.5 hover:border-line-strong">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProjectAvatar name={p.name} />
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold">{p.name}</h2>
                        <span className={`chip mt-1 ${status.soft}`}>
                          <span className={`size-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                      </div>
                    </div>
                    <ArrowUpRight className="size-4 text-faint transition group-hover:text-accent" />
                  </div>

                  <div className="mt-auto space-y-2">
                    <div className="flex justify-between text-xs text-muted">
                      <span>
                        {total - openCount} done · {openCount} open
                      </span>
                      <span className="font-medium text-ink">{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="gradient-accent h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-faint">
                    <span>{s?.last_date ? `Last active ${formatDay(s.last_date)}` : "No activity yet"}</span>
                    {s?.minutes ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatMinutes(s.minutes)}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
