import { ArrowLeft, CalendarClock, CheckCircle2, Clock, Flag, History, ListTodo, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addMilestone, completeMilestone, setProjectStatus } from "@/app/actions";
import ItemLine from "@/components/ItemLine";
import { EmptyState, ProjectAvatar, SectionTitle, Stat } from "@/components/ui";
import { getMilestones, getProject, getProjectItems, type ItemRow } from "@/lib/data";
import { formatDay, formatMinutes } from "@/lib/dates";
import { requireUserId } from "@/lib/session";
import { STATUS } from "@/lib/ui";
import SubmitButton from "@/components/SubmitButton";

const STATUSES = ["active", "paused", "shipped"] as const;

function groupByDay(items: ItemRow[]): [string, ItemRow[]][] {
  const groups = new Map<string, ItemRow[]>();
  for (const item of items) groups.set(item.entry_date, [...(groups.get(item.entry_date) ?? []), item]);
  return [...groups];
}

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const project = await getProject(userId, id);
  if (!project) notFound();
  const [items, milestones] = await Promise.all([getProjectItems(userId, id), getMilestones(userId, id)]);

  const open = items.filter((i) => i.kind !== "done" && !i.closed_on);
  const history = items.filter((i) => i.kind === "done" || i.closed_on).reverse();
  const minutes = items.reduce((sum, i) => sum + (i.duration_minutes ?? 0), 0);
  const lastDate = items.length ? items[items.length - 1].entry_date : null;
  const reached = milestones.filter((m) => m.done_on).length;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/projects" className="btn-ghost -ml-2.5 mb-4">
          <ArrowLeft className="size-4" />
          Projects
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <ProjectAvatar name={project.name} size="lg" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
              <p className="mt-1 text-sm text-muted">{lastDate ? `Last active ${formatDay(lastDate)}` : "No activity yet"}</p>
            </div>
          </div>
          <div className="seg">
            {STATUSES.map((s) => (
              <form key={s} action={setProjectStatus.bind(null, project.id, s)}>
                <SubmitButton className="seg-item data-[pending=true]:bg-surface data-[pending=true]:text-ink" data-active={project.status === s}>
                  <span className={`size-1.5 rounded-full ${STATUS[s].dot}`} />
                  {STATUS[s].label}
                </SubmitButton>
              </form>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={CheckCircle2} label="Done" value={items.filter((i) => i.kind === "done").length} tone="bg-emerald-500/10 text-emerald-500" />
        <Stat icon={ListTodo} label="Open" value={open.length} tone="bg-amber-500/10 text-amber-500" />
        <Stat icon={Clock} label="Time logged" value={minutes ? formatMinutes(minutes) : "—"} />
        <Stat icon={Flag} label="Milestones" value={`${reached}/${milestones.length}`} tone="bg-sky-500/10 text-sky-500" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card">
          <SectionTitle count={history.length}>
            <History className="size-4 text-faint" />
            History
          </SectionTitle>
          {history.length === 0 ? (
            <EmptyState icon={History} title="Nothing logged yet">
              Items about {project.name} show up here once you log them.
            </EmptyState>
          ) : (
            <div className="space-y-6">
              {groupByDay(history).map(([day, dayItems]) => (
                <div key={day}>
                  <p className="eyebrow mb-3">{formatDay(day)}</p>
                  <ul className="divide-y divide-line">
                    {dayItems.map((i) => (
                      <ItemLine key={i.id} item={i} showProject={false} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="card">
            <SectionTitle count={open.length}>
              <CalendarClock className="size-4 text-faint" />
              Open
            </SectionTitle>
            {open.length === 0 ? (
              <p className="text-sm text-muted">Nothing open. Nice.</p>
            ) : (
              <ul className="divide-y divide-line">
                {open.map((i) => (
                  <ItemLine key={i.id} item={i} showProject={false} />
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <SectionTitle count={milestones.length}>
              <Flag className="size-4 text-faint" />
              Milestones
            </SectionTitle>
            {milestones.length === 0 && <p className="mb-4 text-sm text-muted">Mark the big moments: first user, launch, first sale.</p>}
            <ol className="relative mb-4 space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[9px] before:w-px before:bg-line">
              {milestones.map((m) => (
                <li key={m.id} className="relative flex items-start gap-3">
                  <span
                    className={`relative z-10 mt-0.5 flex size-[19px] shrink-0 items-center justify-center rounded-full border-2 ${
                      m.done_on ? "border-transparent bg-emerald-500 text-white" : "border-line-strong bg-surface"
                    }`}
                  >
                    {m.done_on && <CheckCircle2 className="size-3" strokeWidth={3} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${m.done_on ? "" : "text-muted"}`}>{m.title}</p>
                    {m.done_on && <p className="text-xs text-faint">{formatDay(m.done_on)}</p>}
                  </div>
                  {!m.done_on && (
                    <form action={completeMilestone.bind(null, project.id, m.id)}>
                      <SubmitButton className="btn-ghost px-2 py-1 text-xs">Mark done</SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ol>
            <form action={addMilestone.bind(null, project.id)} className="space-y-2 border-t border-line pt-4">
              <input name="title" placeholder="e.g. Launched on X" className="input" required />
              <div className="flex gap-2">
                <input name="done_on" type="date" className="input flex-1" title="Leave empty if not reached yet" />
                <SubmitButton className="btn-secondary">
                  <Plus className="size-4" />
                  Add
                </SubmitButton>
              </div>
              <p className="text-xs text-faint">Leave the date empty if you haven&apos;t reached it yet.</p>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
