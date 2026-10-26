import { ArrowLeft, Check, CheckCircle2, ChevronDown, CircleDashed, CircleDot, ClipboardList, Clock, Gauge, Map as MapIcon, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteRoadmap, setStepStatus, toggleChecklistItem } from "@/app/actions";
import { Stat } from "@/components/ui";
import { getRoadmap, type RoadmapDetail } from "@/lib/data";
import { daysBetween, formatDay, formatMinutes } from "@/lib/dates";
import { requireToday } from "@/lib/session";
import { plural } from "@/lib/ui";
import SubmitButton from "@/components/SubmitButton";

type Step = RoadmapDetail["phases"][number]["steps"][number];

const NEXT_STATUS = { not_started: "in_progress", in_progress: "done", done: "not_started" } as const;
const STATUS_UI = {
  not_started: { icon: CircleDashed, label: "Not started", cls: "border-line-strong text-faint hover:border-accent hover:text-accent" },
  in_progress: { icon: CircleDot, label: "In progress", cls: "border-amber-500/40 bg-amber-500/10 text-amber-500 hover:border-emerald-500" },
  done: { icon: Check, label: "Done", cls: "border-transparent bg-emerald-500 text-white" },
} as const;

export default async function RoadmapPage({ params }: PageProps<"/roadmaps/[id]">) {
  const [{ userId, today }, { id }] = await Promise.all([requireToday(), params]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const roadmap = await getRoadmap(userId, id);
  if (!roadmap) notFound();

  const steps = roadmap.phases.flatMap((p) => p.steps);
  const done = steps.filter((s) => s.status === "done").length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const checklist = steps.flatMap((s) => s.checklist);
  const ticked = checklist.filter((c) => c.done_on).length;
  const planned = steps.reduce((n, s) => n + (s.planned_minutes ?? 0), 0);
  const logged = steps.reduce((n, s) => n + s.logged_minutes, 0);
  const behind = steps.filter((s) => s.status !== "done" && s.target_date && s.target_date < today).length;
  const end = steps.reduce<string | null>((max, s) => (s.target_date && (!max || s.target_date > max) ? s.target_date : max), null);
  const current = steps.find((s) => s.status === "in_progress") ?? steps.find((s) => s.status !== "done");

  return (
    <div className="space-y-8">
      <div>
        <Link href="/roadmaps" className="btn-ghost -ml-2.5 mb-4">
          <ArrowLeft className="size-4" />
          Roadmaps
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-bg shadow-card">
              <MapIcon className="size-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight">{roadmap.title}</h1>
              {roadmap.summary && <p className="mt-1.5 max-w-2xl text-sm text-muted">{roadmap.summary}</p>}
              {roadmap.start_date && (
                <p className="mt-2 text-xs text-faint">
                  {formatDay(roadmap.start_date)}
                  {end ? ` → ${formatDay(end)}` : ""}
                </p>
              )}
            </div>
          </div>
          <form action={deleteRoadmap.bind(null, roadmap.id)}>
            <SubmitButton confirm={`Delete "${roadmap.title}"? Its phases, steps and checklists go too.`} className="btn-ghost hover:bg-rose-500/10 hover:text-rose-500">
              <Trash2 className="size-4" />
              Delete
            </SubmitButton>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={CheckCircle2} label="Progress" value={`${pct}%`} hint={`${done}/${steps.length} steps done`} tone="bg-emerald-500/10 text-emerald-500">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
        </Stat>
        <Stat icon={ClipboardList} label="Checklist" value={`${ticked}/${checklist.length}`} hint="items ticked" />
        <Stat
          icon={Clock}
          label="Time"
          value={logged ? formatMinutes(logged) : "—"}
          hint={planned ? `of ${formatMinutes(planned)} planned` : "No estimates"}
          tone="bg-sky-500/10 text-sky-500"
        />
        <Stat
          icon={Gauge}
          label="Schedule"
          value={behind ? `${behind} behind` : "On track"}
          hint={current ? `Now: ${current.title}` : "All done"}
          tone={behind ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"}
        />
      </div>

      <ol className="space-y-5">
        {roadmap.phases.map((phase, p) => {
          const phaseDone = phase.steps.filter((s) => s.status === "done").length;
          const isCurrent = phase.steps.some((s) => s.id === current?.id);
          return (
            <li key={phase.id}>
              <details open={isCurrent || p === 0} className="card group/phase p-0">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4 sm:p-5">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
                      phaseDone === phase.steps.length ? "bg-emerald-500 text-white" : isCurrent ? "bg-ink text-bg" : "bg-surface-2 text-muted ring-1 ring-line"
                    }`}
                  >
                    {phaseDone === phase.steps.length ? <Check className="size-4" strokeWidth={3} /> : p + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">{phase.title}</h2>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full bg-accent" style={{ width: `${(phaseDone / phase.steps.length) * 100}%` }} />
                      </div>
                      <span className="text-xs text-faint">
                        {phaseDone}/{plural(phase.steps.length, "step")}
                      </span>
                    </div>
                  </div>
                  {isCurrent && <span className="chip bg-accent-soft text-accent-ink">Current</span>}
                  <ChevronDown className="size-4 text-faint transition group-open/phase:rotate-180" />
                </summary>
                <ul className="divide-y divide-line border-t border-line">
                  {phase.steps.map((step) => (
                    <StepItem key={step.id} step={step} today={today} isCurrent={step.id === current?.id} />
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepItem({ step, today, isCurrent }: { step: Step; today: string; isCurrent: boolean }) {
  const ui = STATUS_UI[step.status];
  const Icon = ui.icon;
  const tickedCount = step.checklist.filter((c) => c.done_on).length;
  const overdue = step.status !== "done" && step.target_date && step.target_date < today;
  const dueIn = step.target_date ? daysBetween(today, step.target_date) : null;

  return (
    <li className={`flex gap-3 px-4 py-4 sm:px-5 ${isCurrent ? "bg-accent-soft/40" : ""}`}>
      <form action={setStepStatus.bind(null, step.id, NEXT_STATUS[step.status])}>
        <SubmitButton
          className={`mt-0.5 flex size-7 items-center justify-center rounded-full border-2 transition data-[pending=true]:scale-110 data-[pending=true]:animate-pulse data-[pending=true]:border-accent ${ui.cls}`}
          title={`${ui.label} · click to mark ${NEXT_STATUS[step.status].replace("_", " ")}`}
          aria-label={`${step.title}: ${ui.label}. Change status`}
        >
          <Icon className="size-3.5" strokeWidth={3} />
        </SubmitButton>
      </form>

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${step.status === "done" ? "text-faint line-through" : ""}`}>{step.title}</p>
        {step.description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{step.description}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
          {step.status === "in_progress" && <span className="chip bg-amber-500/10 text-amber-600 dark:text-amber-400">In progress</span>}
          {step.target_date && (
            <span className={`chip ${overdue ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-surface-2 ring-1 ring-line"}`}>
              {overdue
                ? `${plural(-dueIn!, "day")} late · ${formatDay(step.target_date)}`
                : step.status === "done"
                  ? `Planned ${formatDay(step.target_date)}`
                  : dueIn! <= 7
                    ? `Due in ${plural(dueIn!, "day")}`
                    : `By ${formatDay(step.target_date)}`}
            </span>
          )}
          {(step.planned_minutes || step.logged_minutes > 0) && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {step.logged_minutes ? formatMinutes(step.logged_minutes) : "0m"}
              {step.planned_minutes ? ` / ${formatMinutes(step.planned_minutes)}` : ""}
            </span>
          )}
          {step.log_count > 0 && <span>{plural(step.log_count, "log")}</span>}
          {step.source_ref && <span className="truncate text-faint">§ {step.source_ref}</span>}
        </div>

        {step.checklist.length > 0 && (
          <details open={step.status === "in_progress"} className="group/list mt-3">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-accent">
              <ClipboardList className="size-3.5" />
              Checklist {tickedCount}/{step.checklist.length}
              <ChevronDown className="size-3.5 transition group-open/list:rotate-180" />
            </summary>
            <ul className="mt-2 space-y-0.5">
              {step.checklist.map((c) => (
                <li key={c.id}>
                  <form action={toggleChecklistItem.bind(null, c.id)}>
                    <SubmitButton className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-surface-2">
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded border transition ${
                          c.done_on
                            ? "border-emerald-500 bg-emerald-500 text-white group-data-[pending=true]:border-line-strong group-data-[pending=true]:bg-transparent"
                            : "border-line-strong group-data-[pending=true]:border-emerald-500 group-data-[pending=true]:bg-emerald-500"
                        }`}
                      >
                        {c.done_on && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className={c.done_on ? "text-faint line-through" : ""}>{c.title}</span>
                      {c.done_on && <span className="ml-auto shrink-0 text-[11px] text-faint">{formatDay(c.done_on)}</span>}
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </li>
  );
}
