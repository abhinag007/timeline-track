import { addDays, formatDay } from "@/lib/dates";
import { plural } from "@/lib/ui";

const WEEKS = 26;
const LEVELS = ["bg-surface-2 ring-1 ring-inset ring-line", "bg-accent/30", "bg-accent/50", "bg-accent/75", "bg-accent"];

function level(count: number | undefined): string {
  if (count === undefined) return LEVELS[0];
  if (count >= 8) return LEVELS[4];
  if (count >= 5) return LEVELS[3];
  if (count >= 3) return LEVELS[2];
  return LEVELS[1];
}

const isoDow = (d: string) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon = 0
const monthShort = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });

// GitHub-style grid of the last 26 weeks: one column per week (Mon–Sun), oldest on the left.
// `counts` holds logged days only; a logged day with 0 items still shows as logged.
export default function ActivityHeatmap({ counts, today }: { counts: Map<string, number>; today: string }) {
  const start = addDays(today, -(isoDow(today) + (WEEKS - 1) * 7));
  const weeks = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const logged = [...counts.keys()].filter((d) => d >= start).length;

  return (
    <section className="card">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Activity</h2>
        <p className="text-xs text-faint">
          {plural(logged, "day")} logged in the last 6 months
        </p>
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pt-1 pb-2">
        <div
          className="grid min-w-[520px] gap-[3px] sm:gap-1"
          style={{ gridTemplateColumns: `1.75rem repeat(${WEEKS}, minmax(0, 1fr))` }}
        >
          {/* Month labels: shown on the first week that starts in a new month */}
          <span />
          {weeks.map((week, w) => {
            const show = w === 0 ? week[0].slice(8) <= "21" : monthShort(week[0]) !== monthShort(weeks[w - 1][0]);
            return (
              <span key={week[0]} className="h-4 text-[10px] leading-4 whitespace-nowrap text-faint">
                {show ? monthShort(week[0]) : ""}
              </span>
            );
          })}

          {Array.from({ length: 7 }, (_, d) => (
            <Row key={d} label={["Mon", "", "Wed", "", "Fri", "", "Sun"][d]}>
              {weeks.map((week) => {
                const day = week[d];
                if (day > today) return <span key={day} />;
                const count = counts.get(day);
                return (
                  <span
                    key={day}
                    title={`${formatDay(day)} · ${count === undefined ? "no log" : plural(count, "item")}`}
                    className={`aspect-square rounded-[4px] ${level(count)} ${day === today ? "outline-2 outline-offset-1 outline-accent" : ""}`}
                  />
                );
              })}
            </Row>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-faint">
        Less
        {LEVELS.map((c) => (
          <span key={c} className={`size-2.5 rounded-[3px] ${c}`} />
        ))}
        More
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="flex items-center text-[10px] leading-none text-faint">{label}</span>
      {children}
    </>
  );
}
