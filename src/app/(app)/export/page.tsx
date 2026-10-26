import { Download, FileText, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import CopyButton from "@/components/CopyButton";
import MarkdownView from "@/components/MarkdownView";
import { PageHeader, SegLink } from "@/components/ui";
import { getCategories, getTagNames } from "@/lib/data";
import { addDays, formatDay } from "@/lib/dates";
import { buildExport } from "@/lib/export";
import { requireToday } from "@/lib/session";

export default async function ExportPage({ searchParams }: PageProps<"/export">) {
  const { userId, today } = await requireToday();
  const raw = await searchParams;
  const params = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const [{ markdown, from, to, projects }, categories, tags] = await Promise.all([
    buildExport(userId, today, params),
    getCategories(userId),
    getTagNames(userId),
  ]);
  const { view, ...filters } = params;
  const isRaw = view === "raw";
  const query = new URLSearchParams({ ...filters, from, to } as Record<string, string>).toString();
  const monthStart = `${today.slice(0, 8)}01`;
  const presets = [
    { label: "Today", from: today, to: today },
    { label: "7 days", from: addDays(today, -6), to: today },
    { label: "This month", from: monthStart, to: today },
    { label: "30 days", from: addDays(today, -29), to: today },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`${formatDay(from)} – ${formatDay(to)}`}
        title="Export"
        description="Your log as a Markdown document, grouped by date with a summary on top."
        actions={
          <>
            <CopyButton text={markdown} />
            <a href={`/api/export?${query}`} className="btn">
              <Download className="size-4" />
              Download .md
            </a>
          </>
        }
      />

      <div className="seg overflow-x-auto">
        {presets.map((p) => (
          <SegLink key={p.label} href={`/export?from=${p.from}&to=${p.to}`} active={p.from === from && p.to === to}>
            {p.label}
          </SegLink>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <form className="card space-y-4 lg:sticky lg:top-10">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="size-4 text-faint" />
            Filters
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <label>
              <span className="label">From</span>
              <input type="date" name="from" defaultValue={from} className="input" />
            </label>
            <label>
              <span className="label">To</span>
              <input type="date" name="to" defaultValue={to} className="input" />
            </label>
            <label>
              <span className="label">Category</span>
              <select name="category" defaultValue={params.category ?? ""} className="select">
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Project</span>
              <select name="project" defaultValue={params.project ?? ""} className="select">
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 lg:col-span-1">
              <span className="label">Tag</span>
              <select name="tag" defaultValue={params.tag ?? ""} className="select">
                <option value="">All tags</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {isRaw && <input type="hidden" name="view" value="raw" />}
          <button className="btn-secondary w-full">Apply filters</button>
        </form>

        <section className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-5 py-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <FileText className="size-4 text-faint" />
              timeline-{from}-to-{to}.md
            </span>
            <div className="seg p-0.5">
              <Link href={`/export?${query}`} className="seg-item px-2.5 py-1 text-xs" data-active={!isRaw}>
                Preview
              </Link>
              <Link href={`/export?${query}&view=raw`} className="seg-item px-2.5 py-1 text-xs" data-active={isRaw}>
                Markdown
              </Link>
            </div>
          </div>
          <div className="px-6 py-6 sm:px-10 sm:py-8">
            {isRaw ? (
              <pre className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted">{markdown}</pre>
            ) : (
              <MarkdownView markdown={markdown} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
