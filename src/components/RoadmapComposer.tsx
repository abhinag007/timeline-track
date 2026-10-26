"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  FileText,
  FileUp,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { analyzeRoadmap, saveRoadmap } from "@/app/actions";
import { addDays, formatDay } from "@/lib/dates";
import type { RoadmapProposal } from "@/lib/roadmap";
import { plural } from "@/lib/ui";

type StepDraft = {
  key: string;
  title: string;
  description: string;
  hours: string;
  week: number;
  checklist: string; // one item per line
  sourceRef: string | null;
};
type PhaseDraft = { key: string; title: string; steps: StepDraft[] };
type Upload = { name: string; kind: "pdf"; base64: string; size: number };

let seq = 0;
const key = () => `k${++seq}`;

function toDrafts(p: RoadmapProposal): PhaseDraft[] {
  return p.phases.map((ph) => ({
    key: key(),
    title: ph.title,
    steps: ph.steps.map((s) => ({
      key: key(),
      title: s.title,
      description: s.description ?? "",
      hours: s.planned_minutes ? String(Math.round((s.planned_minutes / 60) * 10) / 10) : "",
      week: s.week,
      checklist: s.checklist.join("\n"),
      sourceRef: s.source_ref,
    })),
  }));
}

const weekEnd = (start: string, week: number) => addDays(start, week * 7 - 1);

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function RoadmapComposer({ today }: { today: string }) {
  const [text, setText] = useState("");
  const [upload, setUpload] = useState<Upload | null>(null);
  const [startDate, setStartDate] = useState(today);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [phases, setPhases] = useState<PhaseDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, startAnalyze] = useTransition();
  const [saving, startSave] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const canAnalyze = !!upload || text.trim().length >= 40;

  async function takeFile(file: File) {
    setError(null);
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      if (file.size > 8 * 1024 * 1024) return setError("That PDF is over 8 MB. Paste the text instead.");
      setUpload({ name: file.name, kind: "pdf", base64: await readBase64(file), size: file.size });
      return;
    }
    if (/\.(md|markdown|txt)$/.test(name) || file.type.startsWith("text/")) {
      setUpload(null);
      setText(await file.text());
      return;
    }
    setError("Upload a .md, .txt or .pdf file.");
  }

  function analyze() {
    if (!canAnalyze || analyzing) return;
    setError(null);
    startAnalyze(async () => {
      const result = await analyzeRoadmap(
        upload ? { startDate, pdf: { name: upload.name, base64: upload.base64 } } : { startDate, text },
      );
      if ("error" in result) return setError(result.error);
      setTitle(result.proposal.title);
      setSummary(result.proposal.summary);
      setPhases(toDrafts(result.proposal));
    });
  }

  function save() {
    if (!phases) return;
    setError(null);
    startSave(async () => {
      const result = await saveRoadmap({
        title,
        summary,
        startDate,
        sourceDoc: upload ? `[PDF] ${upload.name}` : text,
        phases: phases.map((ph) => ({
          title: ph.title,
          steps: ph.steps.map((s) => {
            const hours = Number(s.hours);
            return {
              title: s.title,
              description: s.description.trim() || null,
              planned_minutes: s.hours && hours > 0 ? Math.round(hours * 60) : null,
              target_date: weekEnd(startDate, s.week),
              source_ref: s.sourceRef,
              checklist: s.checklist
                .split("\n")
                .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
                .filter(Boolean),
            };
          }),
        })),
      });
      if (result?.error) setError(result.error);
    });
  }

  const updatePhase = (k: string, patch: Partial<PhaseDraft>) => setPhases((ps) => ps && ps.map((p) => (p.key === k ? { ...p, ...patch } : p)));
  const updateStep = (pk: string, sk: string, patch: Partial<StepDraft>) =>
    setPhases((ps) => ps && ps.map((p) => (p.key === pk ? { ...p, steps: p.steps.map((s) => (s.key === sk ? { ...s, ...patch } : s)) } : p)));

  // ---------- input ----------

  if (!phases) {
    return (
      <div className="space-y-4">
        <section className="card relative overflow-hidden p-0">
          <div className="relative flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-ink text-bg">
                <Sparkles className="size-4" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold">Your plan, as written</h2>
                <p className="text-xs text-muted">Paste a guide or playbook of any length, or upload it.</p>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted transition hover:border-line-strong">
              <CalendarDays className="size-3.5" />
              Start
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value || today)}
                className="bg-transparent text-ink outline-none"
                aria-label="Start date"
              />
            </label>
          </div>

          {upload ? (
            <div className="relative m-5 flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{upload.name}</p>
                <p className="text-xs text-faint">PDF · {(upload.size / 1024 / 1024).toFixed(1)} MB · Claude reads it directly</p>
              </div>
              <button className="icon-btn" onClick={() => setUpload(null)} disabled={analyzing} aria-label="Remove file">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div
              className={`relative transition ${dragging ? "bg-accent-soft/60" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) void takeFile(file);
              }}
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
                disabled={analyzing}
                placeholder={"# Learn Rust in 8 weeks\n\nWeek 1–2: The Book, chapters 1–8 (1 hr/day)\n- Ownership, borrowing, structs and enums…\n\nOr drop a .md, .txt or .pdf file here."}
                className="block min-h-72 w-full resize-y bg-transparent px-5 py-4 font-mono text-[13px] leading-6 outline-none placeholder:text-faint disabled:opacity-60"
              />
            </div>
          )}

          <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-5 py-3">
            <div className="flex items-center gap-3 text-xs text-faint">
              <button className="btn-ghost -ml-2.5" onClick={() => fileInput.current?.click()} disabled={analyzing}>
                <FileUp className="size-4" />
                Upload file
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".md,.markdown,.txt,.pdf,text/plain,text/markdown,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void takeFile(file);
                  e.target.value = "";
                }}
              />
              {!upload && <span>{words.toLocaleString("en-IN")} words</span>}
            </div>
            <button className="btn" onClick={analyze} disabled={analyzing || !canAnalyze}>
              {analyzing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {analyzing ? "Building roadmap…" : "Build roadmap"}
            </button>
          </div>
        </section>

        {error && <ErrorNote>{error}</ErrorNote>}
        {analyzing && <BuildingNote words={upload ? null : words} />}
      </div>
    );
  }

  // ---------- review ----------

  const stepCount = phases.reduce((n, p) => n + p.steps.length, 0);
  const checklistCount = phases.reduce((n, p) => n + p.steps.reduce((m, s) => m + s.checklist.split("\n").filter((l) => l.trim()).length, 0), 0);
  const hours = phases.reduce((n, p) => n + p.steps.reduce((m, s) => m + (Number(s.hours) || 0), 0), 0);
  const lastWeek = Math.max(1, ...phases.flatMap((p) => p.steps.map((s) => s.week)));

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="chip bg-accent-soft text-accent-ink">{plural(phases.length, "phase")}</span>
          <span className="chip bg-surface-2 text-muted ring-1 ring-line">{plural(stepCount, "step")}</span>
          <span className="chip bg-surface-2 text-muted ring-1 ring-line">{plural(checklistCount, "checklist item")}</span>
          {hours > 0 && <span className="chip bg-surface-2 text-muted ring-1 ring-line">{Math.round(hours)} h planned</span>}
          <span className="chip bg-surface-2 text-muted ring-1 ring-line">
            {formatDay(startDate)} → {formatDay(weekEnd(startDate, lastWeek))}
          </span>
        </div>
        <button className="btn-ghost" onClick={() => setPhases(null)} disabled={saving}>
          <ArrowLeft className="size-4" />
          Back to document
        </button>
      </div>

      <div className="card space-y-4">
        <label className="block">
          <span className="label">Roadmap name</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input text-base font-semibold" />
        </label>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="label">Goal</span>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className="input resize-y" />
          </label>
          <label className="block">
            <span className="label">Start date</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value || today)} className="input" />
          </label>
        </div>
      </div>

      <ol className="space-y-4">
        {phases.map((phase, p) => (
          <PhaseCard
            key={phase.key}
            index={p}
            total={phases.length}
            phase={phase}
            startDate={startDate}
            onChange={(patch) => updatePhase(phase.key, patch)}
            onStepChange={(sk, patch) => updateStep(phase.key, sk, patch)}
            onMove={(dir) => setPhases((ps) => ps && move(ps, p, p + dir))}
            onRemove={() => setPhases((ps) => ps && ps.filter((x) => x.key !== phase.key))}
          />
        ))}
      </ol>

      <button
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong py-3 text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
        onClick={() =>
          setPhases((ps) => [
            ...(ps ?? []),
            { key: key(), title: "New phase", steps: [{ key: key(), title: "", description: "", hours: "", week: lastWeek, checklist: "", sourceRef: null }] },
          ])
        }
      >
        <Plus className="size-4" />
        Add phase
      </button>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="sticky bottom-24 z-10 lg:bottom-6">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface/90 p-2 pl-4 shadow-card backdrop-blur-xl">
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink">{plural(stepCount, "step")}</span> across {plural(phases.length, "phase")}
          </p>
          <button className="btn" onClick={save} disabled={saving || !title.trim() || stepCount === 0}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {saving ? "Saving…" : "Save roadmap"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">{children}</p>;
}

function BuildingNote({ words }: { words: number | null }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const estimate = words === null ? "a few minutes" : words > 15000 ? "3–6 minutes" : words > 4000 ? "1–3 minutes" : "under a minute";
  return (
    <div className="card flex items-center gap-4" aria-live="polite">
      <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Sparkles className="size-5 animate-pulse" />
      </span>
      <div className="flex-1">
        <p className="text-sm font-medium">Claude is reading your document and laying out phases, steps and checklists…</p>
        <p className="text-xs text-muted">
          Usually takes {estimate} · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} so far. Keep this tab open.
        </p>
      </div>
    </div>
  );
}

function PhaseCard({
  index,
  total,
  phase,
  startDate,
  onChange,
  onStepChange,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  phase: PhaseDraft;
  startDate: string;
  onChange: (patch: Partial<PhaseDraft>) => void;
  onStepChange: (stepKey: string, patch: Partial<StepDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(index < 2);
  const lastWeek = Math.max(1, ...phase.steps.map((s) => s.week));
  return (
    <li className="card p-0">
      <div className="flex items-center gap-3 p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink text-sm font-semibold text-bg">{index + 1}</span>
        <input
          value={phase.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1 text-[15px] font-semibold outline-none focus:bg-surface-2"
          aria-label="Phase title"
        />
        <span className="hidden text-xs text-faint sm:inline">{plural(phase.steps.length, "step")}</span>
        <div className="flex">
          <button className="icon-btn size-8" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move phase up">
            <ArrowUp className="size-4" />
          </button>
          <button className="icon-btn size-8" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move phase down">
            <ArrowDown className="size-4" />
          </button>
          <button className="icon-btn size-8 hover:bg-rose-500/10 hover:text-rose-500" onClick={onRemove} aria-label="Delete phase">
            <Trash2 className="size-4" />
          </button>
          <button className="icon-btn size-8" onClick={() => setOpen((o) => !o)} aria-label={open ? "Collapse phase" : "Expand phase"}>
            <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-2 border-t border-line p-4">
          {phase.steps.map((step, s) => (
            <StepRow
              key={step.key}
              step={step}
              startDate={startDate}
              canUp={s > 0}
              canDown={s < phase.steps.length - 1}
              onChange={(patch) => onStepChange(step.key, patch)}
              onMove={(dir) => onChange({ steps: move(phase.steps, s, s + dir) })}
              onRemove={() => onChange({ steps: phase.steps.filter((x) => x.key !== step.key) })}
            />
          ))}
          <button
            className="btn-ghost w-full justify-center border border-dashed border-line py-2"
            onClick={() =>
              onChange({ steps: [...phase.steps, { key: key(), title: "", description: "", hours: "", week: lastWeek, checklist: "", sourceRef: null }] })
            }
          >
            <Plus className="size-4" />
            Add step
          </button>
        </div>
      )}
    </li>
  );
}

function StepRow({
  step,
  startDate,
  canUp,
  canDown,
  onChange,
  onMove,
  onRemove,
}: {
  step: StepDraft;
  startDate: string;
  canUp: boolean;
  canDown: boolean;
  onChange: (patch: Partial<StepDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [showList, setShowList] = useState(false);
  const items = step.checklist.split("\n").filter((l) => l.trim()).length;
  return (
    <div className="rounded-xl border border-line bg-surface-2/50 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <input
            value={step.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Step title"
            className="w-full rounded-lg bg-transparent px-1 py-0.5 text-sm font-medium outline-none placeholder:text-faint focus:bg-surface"
          />
          <input
            value={step.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="What done looks like (optional)"
            className="w-full rounded-lg bg-transparent px-1 py-0.5 text-xs text-muted outline-none placeholder:text-faint focus:bg-surface"
          />
        </div>
        <div className="flex shrink-0">
          <button className="icon-btn size-7" onClick={() => onMove(-1)} disabled={!canUp} aria-label="Move step up">
            <ArrowUp className="size-3.5" />
          </button>
          <button className="icon-btn size-7" onClick={() => onMove(1)} disabled={!canDown} aria-label="Move step down">
            <ArrowDown className="size-3.5" />
          </button>
          <button className="icon-btn size-7 hover:bg-rose-500/10 hover:text-rose-500" onClick={onRemove} aria-label="Delete step">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-xs text-muted">
        <label className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1">
          <CalendarDays className="size-3.5 text-faint" />
          Week
          <input
            type="number"
            min={1}
            value={step.week}
            onChange={(e) => onChange({ week: Math.max(1, Math.round(Number(e.target.value)) || 1) })}
            className="w-10 bg-transparent font-medium text-ink outline-none"
          />
          <span className="text-faint">· by {formatDay(weekEnd(startDate, step.week))}</span>
        </label>
        <label className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1">
          <Clock className="size-3.5 text-faint" />
          <input
            value={step.hours}
            onChange={(e) => onChange({ hours: e.target.value })}
            inputMode="decimal"
            placeholder="—"
            className="w-10 bg-transparent font-medium text-ink outline-none placeholder:text-faint"
          />
          hours
        </label>
        <button
          className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 transition ${showList ? "border-accent text-accent" : "border-line bg-surface hover:border-line-strong"}`}
          onClick={() => setShowList((s) => !s)}
        >
          <ClipboardList className="size-3.5" />
          {items ? plural(items, "checklist item") : "Add checklist"}
        </button>
        {step.sourceRef && <span className="truncate text-faint">§ {step.sourceRef}</span>}
      </div>

      {showList && (
        <textarea
          value={step.checklist}
          onChange={(e) => onChange({ checklist: e.target.value })}
          rows={Math.min(10, Math.max(3, items + 1))}
          placeholder="One item per line"
          className="input mt-2 resize-y text-xs leading-5"
        />
      )}
    </div>
  );
}
