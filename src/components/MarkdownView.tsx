import type { ReactNode } from "react";

// Renders the small Markdown subset that lib/markdown.ts produces.

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <span key={i} className="text-xs text-faint">{part.slice(1, -1)}</span>;
    if (part.length > 2 && part.startsWith("_") && part.endsWith("_")) return <em key={i} className="text-muted">{part.slice(1, -1)}</em>;
    return part;
  });
}

export default function MarkdownView({ markdown }: { markdown: string }) {
  const out: ReactNode[] = [];
  markdown.split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    if (line.startsWith("# ")) {
      out.push(<h1 key={i} className="mb-4 text-2xl font-semibold tracking-tight">{inline(line.slice(2))}</h1>);
    } else if (line.startsWith("## ")) {
      out.push(<h2 key={i} className="mt-8 mb-3 border-b border-line pb-2 text-lg font-semibold">{inline(line.slice(3))}</h2>);
    } else if (line.startsWith("### ")) {
      out.push(<h3 key={i} className="eyebrow mt-4 mb-2">{inline(line.slice(4))}</h3>);
    } else if (/^\s*- /.test(line)) {
      const nested = /^\s{2,}/.test(line);
      let body = line.replace(/^\s*- /, "");
      let box: boolean | null = null;
      if (body.startsWith("[ ] ") || body.startsWith("[x] ")) {
        box = body[1] === "x";
        body = body.slice(4);
      }
      out.push(
        <div key={i} className={`flex gap-2.5 py-1 text-sm leading-6 text-muted ${nested ? "pl-6" : ""}`}>
          {box === null ? (
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-line-strong" />
          ) : (
            <span className={`mt-1.5 size-3.5 shrink-0 rounded border ${box ? "border-emerald-500 bg-emerald-500" : "border-line-strong"}`} />
          )}
          <span className={box ? "line-through decoration-faint" : ""}>{inline(body)}</span>
        </div>,
      );
    } else {
      out.push(<p key={i} className="py-1 text-sm text-muted">{inline(line)}</p>);
    }
  });
  return <article>{out}</article>;
}
