import { ArrowUpRight, CalendarDays, Map as MapIcon, Plus, Route } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui";
import { getRoadmaps } from "@/lib/data";
import { formatDay } from "@/lib/dates";
import { requireUserId } from "@/lib/session";
import { plural } from "@/lib/ui";

export default async function RoadmapsPage() {
  const userId = await requireUserId();
  const roadmaps = await getRoadmaps(userId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={plural(roadmaps.length, "roadmap")}
        title="Roadmaps"
        description="Long plans broken into phases, steps and checklists. Your daily logs tick them off as you go."
        actions={
          <Link href="/roadmaps/new" className="btn">
            <Plus className="size-4" />
            New roadmap
          </Link>
        }
      />

      {roadmaps.length === 0 ? (
        <EmptyState
          icon={MapIcon}
          title="No roadmaps yet"
          action={
            <Link href="/roadmaps/new" className="btn">
              <Plus className="size-4" />
              Create your first roadmap
            </Link>
          }
        >
          Paste or upload a long plan, like an interview prep guide or a launch playbook, and Claude turns it into a trackable roadmap.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {roadmaps.map((r) => {
            const pct = r.step_count ? Math.round((r.steps_done / r.step_count) * 100) : 0;
            return (
              <li key={r.id}>
                <Link href={`/roadmaps/${r.id}`} className="card group flex h-full flex-col gap-5 transition hover:-translate-y-0.5 hover:border-line-strong">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink text-bg">
                      <MapIcon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold">{r.title}</h2>
                      {r.summary && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{r.summary}</p>}
                    </div>
                    <ArrowUpRight className="size-4 shrink-0 text-faint transition group-hover:text-accent" />
                  </div>

                  <div className="mt-auto space-y-2">
                    <div className="flex justify-between text-xs text-muted">
                      <span>
                        {r.steps_done}/{r.step_count} steps · {plural(r.phase_count, "phase")}
                      </span>
                      <span className="font-medium text-ink">{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-faint">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <Route className="size-3.5 shrink-0" />
                      <span className="truncate">{r.next_step ? `Next: ${r.next_step}` : "All steps done"}</span>
                    </span>
                    {r.start_date && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" />
                        {formatDay(r.start_date)}
                        {r.end_date ? ` → ${formatDay(r.end_date)}` : ""}
                      </span>
                    )}
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
