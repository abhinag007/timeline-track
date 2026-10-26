import { ArrowUpRight, CalendarCheck, Check, CheckCircle2, CircleDashed, CircleDot, Flame, FolderOpen, ListTodo, Map as MapIcon, PartyPopper } from "lucide-react";
import Link from "next/link";
import { closeOpenItem } from "@/app/actions";
import { KindIcon } from "@/components/ItemLine";
import LogComposer from "@/components/LogComposer";
import { EmptyState, PageHeader, SectionTitle, Stat } from "@/components/ui";
import {
  getCategories,
  getItems,
  getLoggedDays,
  getOpenChecklistItems,
  getOpenItems,
  getProjects,
  getRoadmapSteps,
  type OpenItem,
  type RoadmapStep,
} from "@/lib/data";
import { addDays, currentStreak, daysBetween, formatDay, weekdayName } from "@/lib/dates";
import { requireToday } from "@/lib/session";
import { plural } from "@/lib/ui";
import SubmitButton from "@/components/SubmitButton";

function greeting(timezone: string): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(new Date()));
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function dueLabel(due: string, today: string): { text: string; tone: string } {
  const diff = daysBetween(today, due);
  if (diff < 0) return { text: `${plural(-diff, "day")} overdue`, tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400" };
  if (diff === 0) return { text: "Today", tone: "bg-accent-soft text-accent-ink" };
  if (diff === 1) return { text: "Tomorrow", tone: "bg-surface-2 text-muted ring-1 ring-line" };
  return { text: formatDay(due), tone: "bg-surface-2 text-muted ring-1 ring-line" };
}

export default async function TodayPage() {
  const { userId, timezone, today } = await requireToday();
  const weekFrom = addDays(today, -6);
  const [categories, projects, openItems, steps, checklist, loggedDays, weekItems] = await Promise.all([
    getCategories(userId),
    getProjects(userId),
    getOpenItems(userId),
    getRoadmapSteps(userId),
    getOpenChecklistItems(userId),
    getLoggedDays(userId),
    getItems(userId, weekFrom, today),
  ]);
  const streak = currentStreak(loggedDays, today);
  const loggedToday = loggedDays.has(today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekFrom, i));
  const weekLogged = week.filter((d) => loggedDays.has(d)).length;
  const weekDone = weekItems.filter((i) => i.kind === "done").length;
  const overdue = openItems.filter((i) => i.due_date && i.due_date < today).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={formatDay(today)}
        title={greeting(timezone)}
        description={
          loggedToday
            ? "Today is logged. You can add more, and it'll be saved alongside what's already there."
            : "Tell me about your day in one go. Claude will sort it into what you did, what's left and what's coming up."
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Flame} label="Streak" value={plural(streak, "day")} hint={loggedToday ? "Logged today" : "Log today to keep it"} tone="bg-orange-500/10 text-orange-500" />
        <Stat icon={CalendarCheck} label="This week" value={`${weekLogged}/7`} tone="bg-accent-soft text-accent">
          <div className="flex gap-1">
            {week.map((d) => (
              <span
                key={d}
                title={formatDay(d)}
                className={`flex h-6 flex-1 items-end justify-center rounded-md pb-0.5 text-[9px] font-semibold ${
                  loggedDays.has(d) ? "bg-accent text-white dark:text-[#111110]" : "bg-surface-2 text-faint"
                } ${d === today ? "ring-2 ring-accent/40 ring-offset-1 ring-offset-surface" : ""}`}
              >
                {weekdayName(d).slice(0, 1)}
              </span>
            ))}
          </div>
        </Stat>
        <Stat icon={CheckCircle2} label="Done · 7 days" value={weekDone} hint={plural(weekItems.length, "item") + " logged"} tone="bg-emerald-500/10 text-emerald-500" />
        <Stat
          icon={ListTodo}
          label="Open"
          value={openItems.length}
          hint={overdue ? `${overdue} overdue` : "Nothing overdue"}
          tone="bg-amber-500/10 text-amber-500"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <LogComposer
          defaultDate={today}
          categories={categories.map((c) => c.name)}
          projects={projects}
          openItems={openItems}
          steps={steps}
          checklist={checklist}
        />
        <div className="space-y-6 lg:sticky lg:top-10">
          <PlannedList items={openItems} today={today} />
          <RoadmapFocus steps={steps} today={today} />
        </div>
      </div>
    </div>
  );
}

function PlannedList({ items, today }: { items: OpenItem[]; today: string }) {
  return (
    <section className="card">
      <SectionTitle count={items.length}>Planned</SectionTitle>
      {items.length === 0 ? (
        <EmptyState icon={PartyPopper} title="All clear">
          To-dos and events from your logs land here until they&apos;re done.
        </EmptyState>
      ) : (
        <>
          <ul className="-mx-2 space-y-0.5">
            {items.map((item) => {
              const due = item.due_date ? dueLabel(item.due_date, today) : null;
              const age = daysBetween(item.entry_date, today);
              return (
                <li key={item.id} className="group flex items-start gap-3 rounded-xl px-2 py-2.5 transition hover:bg-surface-2">
                  <KindIcon kind={item.kind} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug font-medium">{item.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      {due && <span className={`chip ${due.tone}`}>{due.text}</span>}
                      {item.project_name && (
                        <span className="inline-flex items-center gap-1">
                          <FolderOpen className="size-3" />
                          {item.project_name}
                        </span>
                      )}
                      {!due && <span className="text-faint">{age === 0 ? "added today" : `added ${plural(age, "day")} ago`}</span>}
                    </div>
                  </div>
                  <form action={closeOpenItem.bind(null, item.id)}>
                    <SubmitButton
                      className="flex size-7 items-center justify-center rounded-full border border-line-strong text-transparent transition hover:border-emerald-500 hover:bg-emerald-500 hover:text-white data-[pending=true]:scale-110 data-[pending=true]:border-emerald-500 data-[pending=true]:bg-emerald-500 data-[pending=true]:text-white"
                      title="Mark as done"
                      aria-label={`Mark "${item.title}" as done`}
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-faint">
            Mention these in tonight&apos;s log and Claude will offer to close them.
          </p>
        </>
      )}
    </section>
  );
}

function RoadmapFocus({ steps, today }: { steps: RoadmapStep[]; today: string }) {
  if (steps.length === 0) {
    return (
      <Link href="/roadmaps/new" className="card-flat group flex items-center gap-3 p-4 transition hover:border-accent">
        <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <MapIcon className="size-4" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-medium">Create a roadmap</span>
          <span className="block text-xs text-muted">Turn a long plan into steps your logs tick off.</span>
        </span>
        <ArrowUpRight className="size-4 text-faint group-hover:text-accent" />
      </Link>
    );
  }
  // What you're on first, then whatever is due soonest.
  const next = [...steps]
    .sort((a, b) => Number(b.status === "in_progress") - Number(a.status === "in_progress") || (a.target_date ?? "9").localeCompare(b.target_date ?? "9"))
    .slice(0, 4);
  return (
    <section className="card">
      <SectionTitle action={<Link href="/roadmaps" className="text-xs font-medium text-accent hover:underline">All roadmaps</Link>}>
        Roadmap focus
      </SectionTitle>
      <ul className="-mx-2 space-y-0.5">
        {next.map((s) => {
          const late = s.target_date && s.target_date < today;
          const Icon = s.status === "in_progress" ? CircleDot : CircleDashed;
          return (
            <li key={s.id}>
              <Link href={`/roadmaps/${s.roadmap_id}`} className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition hover:bg-surface-2">
                <Icon className={`mt-0.5 size-4 shrink-0 ${s.status === "in_progress" ? "text-amber-500" : "text-faint"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug font-medium">{s.title}</span>
                  <span className="mt-1 block truncate text-xs text-faint">
                    {s.phase}
                    {s.target_date && (
                      <span className={late ? "text-rose-500" : ""}> · {late ? "was due" : "by"} {formatDay(s.target_date)}</span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-faint">Mention a step in your log and Claude links it and ticks its checklist.</p>
    </section>
  );
}
