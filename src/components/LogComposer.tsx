"use client";

import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  FolderPlus,
  Loader2,
  Plus,
  Quote,
  RotateCcw,
  Route,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState, useTransition } from "react";
import { openClaudeKeyDialog } from "@/components/ClaudeKey";
import { analyzeLog, saveEntry } from "@/app/actions";
import type { ChecklistItem, OpenItem, Project, RoadmapStep } from "@/lib/data";
import { formatDay } from "@/lib/dates";
import type { Proposal } from "@/lib/split";
import { categoryStyle, KIND, plural } from "@/lib/ui";

type Kind = "done" | "todo" | "event";

type Draft = {
  key: string;
  kind: Kind;
  title: string;
  category: string;
  tags: string;
  duration: string;
  dueDate: string;
  project: string; // "" | project id | "new:<name>"
  stepId: string;
  checklistIds: string[];
  closesIds: string[];
  updatesId: string;
};

type StepChange = Proposal["step_status_changes"][number] & { accepted: boolean };

const KIND_ICON = { done: CheckCircle2, todo: Circle, event: CalendarClock } as const;
const KINDS: Kind[] = ["done", "todo", "event"];

function toDraft(item: Proposal["items"][number], i: number): Draft {
  return {
    key: `${Date.now()}-${i}`,
    kind: item.kind,
    title: item.title,
    category: item.category,
    tags: item.tags.join(", "),
    duration: item.duration_minutes ? String(item.duration_minutes) : "",
    dueDate: item.due_date ?? "",
    project: item.project_id ?? (item.new_project_name ? `new:${item.new_project_name}` : ""),
    stepId: item.roadmap_step_id ?? "",
    checklistIds: item.checklist_item_ids,
    closesIds: item.closes_open_item_ids,
    updatesId: item.updates_open_item_id ?? "",
  };
}

type Props = {
  defaultDate: string;
  categories: string[];
  projects: Project[];
  openItems: OpenItem[];
  steps: RoadmapStep[];
  checklist: ChecklistItem[];
};

export default function LogComposer({ defaultDate, categories, projects, openItems, steps, checklist }: Props) {
  const [text, setText] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [stepChanges, setStepChanges] = useState<StepChange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, startAnalyze] = useTransition();
  const [saving, startSave] = useTransition();

  const newProjectNames = [...new Set((drafts ?? []).filter((d) => d.project.startsWith("new:")).map((d) => d.project.slice(4)))];
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  function analyze() {
    if (!text.trim() || analyzing) return;
    setError(null);
    startAnalyze(async () => {
      const result = await analyzeLog(text, date);
      if ("error" in result) {
        setError(result.error);
        if (result.needKey) openClaudeKeyDialog();
        return;
      }
      setDrafts(result.proposal.items.map(toDraft));
      setStepChanges(result.proposal.step_status_changes.map((c) => ({ ...c, accepted: true })));
    });
  }

  function update(key: string, patch: Partial<Draft>) {
    setDrafts((ds) => ds && ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function save() {
    if (!drafts) return;
    setError(null);
    startSave(async () => {
      const result = await saveEntry({
        entryDate: date,
        rawText: text,
        items: drafts.map((d) => ({
          kind: d.kind,
          title: d.title,
          category: d.category,
          tags: d.tags
            .split(",")
            .map((t) => t.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-"))
            .filter(Boolean),
          duration_minutes: d.duration ? Math.max(1, Math.round(Number(d.duration))) || null : null,
          due_date: d.kind === "done" ? null : d.dueDate || null,
          project_id: d.project && !d.project.startsWith("new:") ? d.project : null,
          new_project_name: d.project.startsWith("new:") ? d.project.slice(4) : null,
          roadmap_step_id: d.stepId || null,
          checklist_item_ids: d.kind === "done" ? d.checklistIds : [],
          closes_open_item_ids: d.kind === "done" ? d.closesIds : [],
          updates_open_item_id: d.kind !== "done" && d.updatesId ? d.updatesId : null,
        })),
        stepStatusChanges: stepChanges
          .filter((c) => c.accepted)
          .map((c) => ({ step_id: c.step_id, new_status: c.new_status, reason: c.reason })),
      });
      if (result?.error) setError(result.error);
    });
  }

  if (!drafts) {
    return (
      <div className="space-y-4">
        <section className="card relative overflow-hidden p-0">
          <div className="relative flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-ink text-bg">
                <Sparkles className="size-4" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold">What did you get done?</h2>
                <p className="text-xs text-muted">Write it messy. One long sentence is fine.</p>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted transition hover:border-line-strong">
              <CalendarDays className="size-3.5" />
              <input
                type="date"
                value={date}
                max={defaultDate}
                onChange={(e) => setDate(e.target.value || defaultDate)}
                className="bg-transparent text-ink outline-none"
                aria-label="Log date"
              />
            </label>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) analyze();
            }}
            rows={7}
            disabled={analyzing}
            placeholder="Fixed the token refresh bug in the API, took about 2 hours. Reviewed two PRs and read a chapter of the Rust book. Still need to write tests for the webhook handler. Sprint demo tomorrow at 11…"
            className="relative block min-h-48 w-full resize-y bg-transparent px-5 py-4 text-[15px] leading-7 outline-none placeholder:text-faint disabled:opacity-60"
          />

          <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-5 py-3">
            <div className="flex items-center gap-3 text-xs text-faint">
              <span>{plural(words, "word")}</span>
              <span className="hidden items-center gap-1 sm:inline-flex">
                <kbd className="rounded-md border border-line bg-surface px-1.5 py-px font-sans">⌘</kbd>
                <kbd className="rounded-md border border-line bg-surface px-1.5 py-px font-sans">↵</kbd>
                to split
              </span>
              {date !== defaultDate && <span className="chip bg-amber-500/10 text-amber-600 dark:text-amber-400">Back-filling {formatDay(date)}</span>}
            </div>
            <button className="btn" onClick={analyze} disabled={analyzing || !text.trim()}>
              {analyzing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {analyzing ? "Splitting…" : "Split with Claude"}
            </button>
          </div>
        </section>

        {error && <ErrorNote>{error}</ErrorNote>}
        {analyzing && <SplittingSkeleton />}
      </div>
    );
  }

  const counts = KINDS.map((k) => [k, drafts.filter((d) => d.kind === k).length] as const).filter(([, n]) => n > 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Review · {formatDay(date)}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {counts.map(([k, n]) => (
              <span key={k} className={`chip ${KIND[k].soft}`}>
                {n} {KIND[k].label.toLowerCase()}
                {k === "todo" && n !== 1 ? "s" : k === "event" && n !== 1 ? "s" : ""}
              </span>
            ))}
            {counts.length === 0 && <span className="text-sm text-muted">No items</span>}
          </div>
        </div>
        <button className="btn-ghost" onClick={() => setDrafts(null)}>
          <ArrowLeft className="size-4" />
          Edit text
        </button>
      </div>

      <OriginalText text={text} />

      {newProjectNames.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent-ink">
          <FolderPlus className="mt-0.5 size-4 shrink-0" />
          <p>
            {newProjectNames.length > 1 ? "New projects" : "A new project"} will be created: <strong>{newProjectNames.join(", ")}</strong>. Change the
            project on an item if that&apos;s wrong.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {drafts.map((d, i) => (
          <DraftCard
            key={d.key}
            index={i}
            draft={d}
            categories={categories}
            projects={projects}
            newProjectNames={newProjectNames}
            openItems={openItems}
            steps={steps}
            checklist={checklist}
            onChange={(patch) => update(d.key, patch)}
            onRemove={() => setDrafts((ds) => ds && ds.filter((x) => x.key !== d.key))}
          />
        ))}
      </div>

      <button
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong py-3 text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
        onClick={() =>
          setDrafts((ds) => [
            ...(ds ?? []),
            { key: `${Date.now()}`, kind: "done", title: "", category: categories[0], tags: "", duration: "", dueDate: "", project: "", stepId: "", checklistIds: [], closesIds: [], updatesId: "" },
          ])
        }
      >
        <Plus className="size-4" />
        Add item
      </button>

      {stepChanges.length > 0 && (
        <div className="card space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Route className="size-4 text-accent" />
            Suggested roadmap updates
          </h3>
          {stepChanges.map((c, i) => {
            const step = steps.find((s) => s.id === c.step_id);
            return (
              <label key={c.step_id} className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={c.accepted}
                  onChange={(e) => setStepChanges((cs) => cs.map((x, j) => (j === i ? { ...x, accepted: e.target.checked } : x)))}
                  className="mt-0.5 size-4 accent-[var(--accent)]"
                />
                <span>
                  Mark <strong>{step?.title}</strong> as {c.new_status === "done" ? "done" : "in progress"}
                  <span className="mt-0.5 block text-xs text-muted">{c.reason}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="sticky bottom-24 z-10 lg:bottom-6">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface/90 p-2 pl-4 shadow-card backdrop-blur-xl">
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink">{plural(drafts.length, "item")}</span> ready
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary px-3" onClick={analyze} disabled={analyzing || saving} title="Ask Claude to split it again">
              {analyzing ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              <span className="hidden sm:inline">Re-split</span>
            </button>
            <button className="btn" onClick={save} disabled={saving || drafts.length === 0}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {saving ? "Saving…" : "Save to timeline"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">{children}</p>;
}

function OriginalText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button onClick={() => setOpen((o) => !o)} className="card-flat flex w-full items-start gap-3 px-4 py-3 text-left">
      <Quote className="mt-0.5 size-4 shrink-0 text-faint" />
      <p className={`flex-1 text-sm leading-relaxed text-muted ${open ? "" : "line-clamp-2"}`}>{text}</p>
      <ChevronDown className={`mt-0.5 size-4 shrink-0 text-faint transition ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

function SplittingSkeleton() {
  return (
    <div className="space-y-3" aria-live="polite">
      <p className="flex items-center gap-2 text-sm text-muted">
        <Sparkles className="size-4 animate-pulse text-accent" />
        Claude is reading your day…
      </p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card flex gap-3" style={{ animationDelay: `${i * 120}ms` }}>
          <div className="skeleton size-8 rounded-lg" />
          <div className="flex-1 space-y-2.5">
            <div className="skeleton h-3.5" style={{ width: `${70 - i * 12}%` }} />
            <div className="flex gap-2">
              <div className="skeleton h-5 w-16 rounded-full" />
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DraftCard({
  index,
  draft: d,
  categories,
  projects,
  newProjectNames,
  openItems,
  steps,
  checklist,
  onChange,
  onRemove,
}: {
  index: number;
  draft: Draft;
  categories: string[];
  projects: Project[];
  newProjectNames: string[];
  openItems: OpenItem[];
  steps: RoadmapStep[];
  checklist: ChecklistItem[];
  onChange: (patch: Partial<Draft>) => void;
  onRemove: () => void;
}) {
  const stepChecklist = checklist.filter((c) => c.step_id === d.stepId);
  const cat = categoryStyle(d.category);
  return (
    <div className="card rise space-y-4" style={{ animationDelay: `${index * 50}ms` }}>
      <div className="flex items-center justify-between gap-2">
        <div className="seg">
          {KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            const active = d.kind === k;
            return (
              <button
                key={k}
                type="button"
                className={`seg-item px-2.5 py-1 text-xs ${active ? KIND[k].soft : ""}`}
                data-active={active}
                onClick={() => onChange({ kind: k })}
              >
                <Icon className="size-3.5" />
                {KIND[k].label}
              </button>
            );
          })}
        </div>
        <button className="icon-btn size-8 hover:bg-rose-500/10 hover:text-rose-500" onClick={onRemove} title="Remove item" aria-label="Remove item">
          <Trash2 className="size-4" />
        </button>
      </div>

      <input
        value={d.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="What happened?"
        className="w-full rounded-lg bg-transparent text-base font-medium outline-none placeholder:text-faint focus:bg-surface-2 focus:px-2 focus:py-1"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label>
          <span className="label">Category</span>
          <span className="relative block">
            <span className={`pointer-events-none absolute top-1/2 left-3 size-2 -translate-y-1/2 rounded-full ${cat.dot}`} />
            <select value={d.category} onChange={(e) => onChange({ category: e.target.value })} className="select pl-7">
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </span>
        </label>
        <label>
          <span className="label">Project</span>
          <select value={d.project} onChange={(e) => onChange({ project: e.target.value })} className="select">
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            {newProjectNames.map((n) => (
              <option key={n} value={`new:${n}`}>
                {n} (new)
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Tags</span>
          <input value={d.tags} onChange={(e) => onChange({ tags: e.target.value })} placeholder="comma, separated" className="input" />
        </label>
        {d.kind === "done" ? (
          <label>
            <span className="label">Minutes</span>
            <input value={d.duration} onChange={(e) => onChange({ duration: e.target.value })} inputMode="numeric" placeholder="—" className="input" />
          </label>
        ) : (
          <label>
            <span className="label">{d.kind === "event" ? "When" : "Due"}</span>
            <input type="date" value={d.dueDate} onChange={(e) => onChange({ dueDate: e.target.value })} className="input" />
          </label>
        )}
      </div>

      {steps.length > 0 && (
        <label className="block">
          <span className="label">Roadmap step</span>
          <select value={d.stepId} onChange={(e) => onChange({ stepId: e.target.value, checklistIds: [] })} className="select">
            <option value="">None</option>
            {steps.map((s) => (
              <option key={s.id} value={s.id}>
                {s.roadmap} › {s.phase} › {s.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {d.kind === "done" && stepChecklist.length > 0 && (
        <CheckList
          label="Ticks checklist items"
          options={stepChecklist.map((c) => ({ id: c.id, label: c.title }))}
          selected={d.checklistIds}
          onChange={(checklistIds) => onChange({ checklistIds })}
        />
      )}

      {d.kind !== "done" && openItems.length > 0 && (
        <label className="block">
          <span className="label">Updates planned item</span>
          <select value={d.updatesId} onChange={(e) => onChange({ updatesId: e.target.value })} className="select">
            <option value="">None, add as new</option>
            {openItems.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
                {o.due_date ? ` (${o.due_date})` : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      {d.kind === "done" && openItems.length > 0 && (
        <CheckList
          label="Closes open items"
          options={openItems.map((o) => ({ id: o.id, label: o.title }))}
          selected={d.closesIds}
          onChange={(closesIds) => onChange({ closesIds })}
          onlySelectedByDefault
        />
      )}
    </div>
  );
}

function CheckList({
  label,
  options,
  selected,
  onChange,
  onlySelectedByDefault,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onlySelectedByDefault?: boolean;
}) {
  const [expanded, setExpanded] = useState(!onlySelectedByDefault);
  const visible = expanded ? options : options.filter((o) => selected.includes(o.id));
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted">
        <span>
          {label}
          {selected.length > 0 && <span className="ml-1.5 text-accent">· {selected.length} selected</span>}
        </span>
        {onlySelectedByDefault && (
          <button type="button" className="text-accent hover:underline" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Show selected" : `Choose (${options.length})`}
          </button>
        )}
      </div>
      {visible.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {visible.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                onChange={(e) => onChange(e.target.checked ? [...selected, o.id] : selected.filter((id) => id !== o.id))}
                className="size-4 accent-[var(--accent)]"
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
