import "server-only";
import { addDays, currentStreak, daysBetween, formatDay, formatMinutes } from "./dates";
import type { ItemRow } from "./data";

type ExportOptions = {
  from: string;
  to: string;
  today: string;
  items: ItemRow[];
  loggedDays: Set<string>;
  filterLabel?: string;
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function tagList(item: ItemRow): string {
  return item.tags.length ? ` \`${item.tags.map((t) => `#${t}`).join(" ")}\`` : "";
}

function meta(item: ItemRow): string {
  const parts = [item.project_name, item.roadmap_step && `→ ${item.roadmap_step}`, item.duration_minutes && formatMinutes(item.duration_minutes)];
  const shown = parts.filter(Boolean);
  return shown.length ? ` · ${shown.join(" · ")}` : "";
}

function line(item: ItemRow): string {
  const category = item.category ? `**${item.category}**: ` : "";
  if (item.kind === "done") return `- ${category}${item.title}${tagList(item)}${meta(item)}`;
  const box = item.closed_on ? "[x]" : "[ ]";
  const closed = item.closed_on ? ` (closed ${formatDay(item.closed_on)})` : "";
  if (item.kind === "event") {
    const when = item.due_date ? `${formatDay(item.due_date)}: ` : "";
    return `- ${box} 📅 ${when}${item.title}${tagList(item)}${meta(item)}${closed}`;
  }
  const due = item.due_date ? ` (due ${formatDay(item.due_date)})` : "";
  return `- ${box} ${item.title}${due}${tagList(item)}${meta(item)}${closed}`;
}

export function buildMarkdown({ from, to, today, items, loggedDays, filterLabel }: ExportOptions): string {
  const totalDays = daysBetween(from, to) + 1;
  const daysInRange = [...loggedDays].filter((d) => d >= from && d <= to).length;
  const out: string[] = [];

  out.push(`# Timeline: ${formatDay(from)} to ${formatDay(to)}`);
  if (filterLabel) out.push(`_Filtered by ${filterLabel}_`);
  out.push("");

  // Summary
  const done = items.filter((i) => i.kind === "done");
  const todos = items.filter((i) => i.kind === "todo");
  const events = items.filter((i) => i.kind === "event");
  out.push("## Summary", "");
  out.push(`- **Days logged:** ${daysInRange} of ${totalDays}`);
  out.push(`- **Current streak:** ${plural(currentStreak(loggedDays, today), "day")}`);
  out.push(
    `- **Items:** ${done.length} done · ${plural(todos.length, "to-do")} (${todos.filter((t) => t.closed_on).length} closed) · ${plural(events.length, "event")}`,
  );

  const byCategory = new Map<string, { count: number; minutes: number }>();
  for (const item of done) {
    const key = item.category ?? "Uncategorised";
    const entry = byCategory.get(key) ?? { count: 0, minutes: 0 };
    entry.count++;
    entry.minutes += item.duration_minutes ?? 0;
    byCategory.set(key, entry);
  }
  if (byCategory.size) {
    out.push("- **By category:**");
    for (const [name, { count, minutes }] of [...byCategory].sort((a, b) => b[1].count - a[1].count)) {
      out.push(`  - ${name}: ${count} done${minutes ? ` · ${formatMinutes(minutes)}` : ""}`);
    }
  }

  const byProject = new Map<string, { count: number; open: number; minutes: number }>();
  for (const item of items) {
    if (!item.project_name) continue;
    const entry = byProject.get(item.project_name) ?? { count: 0, open: 0, minutes: 0 };
    entry.count++;
    if (item.kind !== "done" && !item.closed_on) entry.open++;
    entry.minutes += item.duration_minutes ?? 0;
    byProject.set(item.project_name, entry);
  }
  if (byProject.size) {
    out.push("- **Projects:**");
    for (const [name, { count, open, minutes }] of byProject) {
      out.push(`  - ${name}: ${plural(count, "item")}${open ? ` · ${open} open` : ""}${minutes ? ` · ${formatMinutes(minutes)}` : ""}`);
    }
  }

  const steps = [...new Set(items.map((i) => i.roadmap_step).filter(Boolean))];
  if (steps.length) out.push(`- **Roadmap steps worked on:** ${steps.join(", ")}`);
  out.push("");

  // Days, newest last so it reads like a diary
  const byDay = new Map<string, ItemRow[]>();
  for (const item of items) byDay.set(item.entry_date, [...(byDay.get(item.entry_date) ?? []), item]);

  for (let day = from; day <= to; day = addDays(day, 1)) {
    const dayItems = byDay.get(day);
    if (!dayItems) {
      if (!filterLabel && day <= today) out.push(`## ${formatDay(day)}`, "", "_No log_", "");
      continue;
    }
    out.push(`## ${formatDay(day)}`, "");
    const dayDone = dayItems.filter((i) => i.kind === "done");
    const dayNext = dayItems.filter((i) => i.kind !== "done");
    if (dayDone.length) out.push("**Done**", ...dayDone.map(line), "");
    if (dayNext.length) out.push("**Next**", ...dayNext.map(line), "");
  }

  return out.join("\n").trimEnd() + "\n";
}
