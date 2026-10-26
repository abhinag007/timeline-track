import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { avatarGradient, categoryStyle } from "@/lib/ui";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-[2.1rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone = "text-accent bg-accent-soft",
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: string;
  children?: ReactNode;
}) {
  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className={`flex size-7 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="size-3.5" strokeWidth={2.4} />
        </span>
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-faint">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function SectionTitle({ children, count, action }: { children: ReactNode; count?: number; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {children}
        {count !== undefined && <span className="rounded-full bg-surface-2 px-1.5 py-px text-xs font-medium text-muted ring-1 ring-line">{count}</span>}
      </h2>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
      <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Icon className="size-5" />
      </span>
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function CategoryChip({ name }: { name: string }) {
  const s = categoryStyle(name);
  return (
    <span className={`chip ${s.soft}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {name}
    </span>
  );
}

export function ProjectAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const cls = { sm: "size-5 rounded-md text-[10px]", md: "size-10 rounded-xl text-sm", lg: "size-14 rounded-2xl text-xl" }[size];
  return (
    <span className={`flex shrink-0 items-center justify-center bg-gradient-to-br font-semibold text-white ${avatarGradient(name)} ${cls}`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function SegLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link href={href} className="seg-item" data-active={active}>
      {children}
    </Link>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-8 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-72 rounded-2xl" />
    </div>
  );
}
