"use client";

import { CalendarRange, FileDown, FolderKanban, Map as MapIcon, PenLine } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/", label: "Today", icon: PenLine },
  { href: "/timeline", label: "Timeline", icon: CalendarRange },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/roadmaps", label: "Roadmaps", icon: MapIcon },
  { href: "/export", label: "Export", icon: FileDown },
] as const;

// Fixed-size dot that fades in while a clicked link is still loading, so the layout never shifts.
function PendingDot({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`size-1.5 rounded-full bg-accent transition-opacity duration-200 ${pending ? "animate-pulse opacity-100" : "opacity-0"} ${className}`}
    />
  );
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SidebarNav() {
  const pathname = usePathname();
  return <SidebarNavList pathname={pathname} />;
}

export function SidebarNavList({ pathname }: { pathname: string | null }) {
  return (
    <nav className="space-y-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-muted hover:bg-surface/60 hover:text-ink"
            }`}
          >
            <Icon className={`size-[18px] ${active ? "text-accent" : "text-faint group-hover:text-muted"}`} strokeWidth={2.2} />
            {label}
            <PendingDot className="ml-auto" />
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar() {
  const pathname = usePathname();
  return <TabBarList pathname={pathname} />;
}

export function TabBarList({ pathname }: { pathname: string | null }) {
  return (
    <nav className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-2xl border border-line bg-surface/85 px-2 py-1.5 shadow-card backdrop-blur-xl lg:hidden">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-medium transition ${
              active ? "text-accent" : "text-faint"
            }`}
          >
            <span className={`relative flex h-7 w-12 items-center justify-center rounded-full transition ${active ? "bg-accent-soft" : ""}`}>
              <Icon className="size-[18px]" strokeWidth={2.2} />
              <PendingDot className="absolute top-0.5 right-2" />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
