import { CalendarClock, Check, CheckCircle2, Circle, Clock, FolderOpen, Route } from "lucide-react";
import Link from "next/link";
import { CategoryChip } from "@/components/ui";
import type { ItemRow } from "@/lib/data";
import { formatDay, formatMinutes } from "@/lib/dates";
import { KIND } from "@/lib/ui";

const ICON = { done: CheckCircle2, todo: Circle, event: CalendarClock } as const;

export function KindIcon({ kind, closed }: { kind: ItemRow["kind"]; closed?: boolean }) {
  const Icon = closed ? Check : ICON[kind];
  return (
    <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${closed ? "bg-surface-2 text-faint" : KIND[kind].soft}`}>
      <Icon className="size-3.5" strokeWidth={2.4} />
    </span>
  );
}

export default function ItemLine({ item, showProject = true }: { item: ItemRow; showProject?: boolean }) {
  const closed = item.kind !== "done" && !!item.closed_on;
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <KindIcon kind={item.kind} closed={closed} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-6 ${closed ? "text-faint line-through" : "font-medium"}`}>{item.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-muted">
          {item.category && <CategoryChip name={item.category} />}
          {showProject && item.project_id && (
            <Link href={`/projects/${item.project_id}`} className="inline-flex items-center gap-1 hover:text-accent">
              <FolderOpen className="size-3.5" />
              {item.project_name}
            </Link>
          )}
          {item.roadmap_step && (
            <span className="inline-flex items-center gap-1">
              <Route className="size-3.5" />
              {item.roadmap_step}
            </span>
          )}
          {item.duration_minutes && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {formatMinutes(item.duration_minutes)}
            </span>
          )}
          {item.due_date && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              {item.kind === "event" ? "on" : "due"} {formatDay(item.due_date)}
            </span>
          )}
          {closed && <span>closed {formatDay(item.closed_on!)}</span>}
          {item.tags.map((t) => (
            <span key={t} className="text-faint">
              #{t}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}
