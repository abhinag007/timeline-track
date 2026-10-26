import { CalendarCheck, CheckCircle2, CircleCheck, Flame, ListTodo, Moon, PenLine } from "lucide-react";
import Link from "next/link";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import ItemLine from "@/components/ItemLine";
import { PageHeader, SegLink, Stat } from "@/components/ui";
import { getDayCounts, getItems, getLoggedDays, type ItemRow } from "@/lib/data";
import { addDays, currentStreak, formatDay, weekdayName } from "@/lib/dates";
import { requireToday } from "@/lib/session";
import { plural } from "@/lib/ui";

const RANGES = [7, 30, 90];

type Row = { kind: "day"; day: string; items: ItemRow[] } | { kind: "gap"; from: string; to: string; count: number };

export default async function TimelinePage({ searchParams }: PageProps<"/timeline">) {
  const [{ userId, today }, params] = await Promise.all([requireToday(), searchParams]);
  const days = RANGES.includes(Number(params.days)) ? Number(params.days) : 30;
  const saved = typeof params.saved === "string" ? params.saved : null;

  const from = addDays(today, -(days - 1));
  const [items, loggedDays, dayCounts] = await Promise.all([
    getItems(userId, from, today),
    getLoggedDays(userId),
    getDayCounts(userId, addDays(today, -190), today),
  ]);

  const byDay = new Map<string, ItemRow[]>();
  for (const item of items) byDay.set(item.entry_date, [...(byDay.get(item.entry_date) ?? []), item]);
  const logged = [...loggedDays].filter((d) => d >= from).length;
  const done = items.filter((i) => i.kind === "done").length;
  const open = items.filter((i) => i.kind !== "done" && !i.closed_on).length;

  // Newest first; runs of days without a log collapse into one gap row.
  const rows: Row[] = [];
  for (let day = today; day >= from; day = addDays(day, -1)) {
    if (loggedDays.has(day) || day === today) {
      rows.push({ kind: "day", day, items: byDay.get(day) ?? [] });
      continue;
    }
    const last = rows[rows.length - 1];
    if (last?.kind === "gap") {
      last.from = day;
      last.count++;
    } else rows.push({ kind: "gap", from: day, to: day, count: 1 });
  }

  return (
    <div className="space-y-8">
      {saved && (
        <div className="rise flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CircleCheck className="size-5 shrink-0" />
          <p>
            <strong>Saved.</strong> Your log for {formatDay(saved)} is on the timeline.
          </p>
        </div>
      )}

      <PageHeader
        eyebrow={`${formatDay(from)} – ${formatDay(today)}`}
        title="Timeline"
        description="Every day you logged, newest first. Gaps show the days you skipped."
        actions={
          <div className="seg">
            {RANGES.map((r) => (
              <SegLink key={r} href={`/timeline?days=${r}`} active={r === days}>
                {r} days
              </SegLink>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={CalendarCheck} label="Days logged" value={`${logged}/${days}`} hint={`${Math.round((logged / days) * 100)}% of the range`} />
        <Stat icon={Flame} label="Streak" value={plural(currentStreak(loggedDays, today), "day")} tone="bg-orange-500/10 text-orange-500" />
        <Stat icon={CheckCircle2} label="Done" value={done} hint={plural(items.length, "item") + " total"} tone="bg-emerald-500/10 text-emerald-500" />
        <Stat icon={ListTodo} label="Still open" value={open} hint="From this range" tone="bg-amber-500/10 text-amber-500" />
      </div>

      <ActivityHeatmap counts={dayCounts} today={today} />

      <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[27px] before:w-px before:bg-line sm:before:left-[31px]">
        {rows.map((row) => {
          if (row.kind === "gap") {
            return (
              <li key={row.to} className="relative flex items-center gap-4 py-1">
                <span className="relative z-10 flex w-14 justify-center sm:w-16">
                  <span className="flex size-7 items-center justify-center rounded-full border border-line bg-bg text-faint">
                    <Moon className="size-3.5" />
                  </span>
                </span>
                <p className="text-sm text-faint">
                  {row.count === 1 ? `No log on ${formatDay(row.from)}` : `${row.count} days without a log · ${formatDay(row.from)} – ${formatDay(row.to)}`}
                </p>
              </li>
            );
          }
          const { day, items: dayItems } = row;
          const isToday = day === today;
          const [, , dd] = day.split("-");
          const month = new Date(`${day}T00:00:00Z`).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
          const dayDone = dayItems.filter((i) => i.kind === "done");
          const next = dayItems.filter((i) => i.kind !== "done");
          return (
            <li key={day} className="relative flex gap-4">
              <div className="relative z-10 w-14 shrink-0 sm:w-16">
                <div
                  className={`flex flex-col items-center rounded-2xl border py-2 ${
                    isToday ? "gradient-accent border-transparent text-white shadow-card" : "border-line bg-surface"
                  }`}
                >
                  <span className={`text-[10px] font-semibold uppercase ${isToday ? "text-white/80" : "text-faint"}`}>{weekdayName(day).slice(0, 3)}</span>
                  <span className="text-xl leading-tight font-semibold">{Number(dd)}</span>
                  <span className={`text-[10px] ${isToday ? "text-white/80" : "text-faint"}`}>{month}</span>
                </div>
              </div>

              {!loggedDays.has(day) ? (
                <Link href="/" className="card-flat flex flex-1 items-center justify-between gap-3 border-dashed px-5 py-4 text-sm transition hover:border-accent">
                  <span className="text-muted">Today isn&apos;t logged yet.</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-accent">
                    <PenLine className="size-4" />
                    Write it
                  </span>
                </Link>
              ) : (
                <div className="card min-w-0 flex-1">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold">{isToday ? "Today" : weekdayName(day)}</h2>
                    <span className="text-xs text-faint">
                      {dayDone.length} done{next.length ? ` · ${next.length} planned` : ""}
                    </span>
                  </div>
                  {dayDone.length > 0 && (
                    <ul className="divide-y divide-line">
                      {dayDone.map((i) => (
                        <ItemLine key={i.id} item={i} />
                      ))}
                    </ul>
                  )}
                  {next.length > 0 && (
                    <div className={dayDone.length ? "mt-4 border-t border-line pt-4" : ""}>
                      <p className="eyebrow mb-3">Next</p>
                      <ul className="divide-y divide-line">
                        {next.map((i) => (
                          <ItemLine key={i.id} item={i} />
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
