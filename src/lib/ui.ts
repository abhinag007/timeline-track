// Shared visual vocabulary. Class names are spelled out in full so Tailwind finds them.

export type CategoryStyle = { dot: string; soft: string };

const CATEGORY: Record<string, CategoryStyle> = {
  Work: { dot: "bg-sky-500", soft: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  Building: { dot: "bg-violet-500", soft: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  Sales: { dot: "bg-emerald-500", soft: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  Brand: { dot: "bg-pink-500", soft: "bg-pink-500/10 text-pink-700 dark:text-pink-300" },
  Learning: { dot: "bg-amber-500", soft: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  Practice: { dot: "bg-orange-500", soft: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  Career: { dot: "bg-cyan-500", soft: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300" },
  Health: { dot: "bg-lime-500", soft: "bg-lime-500/10 text-lime-700 dark:text-lime-300" },
  Personal: { dot: "bg-slate-400", soft: "bg-slate-500/10 text-slate-700 dark:text-slate-300" },
};

export function categoryStyle(name: string | null | undefined): CategoryStyle {
  return (name && CATEGORY[name]) || CATEGORY.Personal;
}

export const KIND = {
  done: { label: "Done", soft: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/30" },
  todo: { label: "To-do", soft: "bg-amber-500/10 text-amber-600 dark:text-amber-400", ring: "ring-amber-500/30" },
  event: { label: "Event", soft: "bg-violet-500/10 text-violet-600 dark:text-violet-400", ring: "ring-violet-500/30" },
} as const;

export const STATUS = {
  active: { label: "Active", soft: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  paused: { label: "Paused", soft: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  shipped: { label: "Shipped", soft: "bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
} as const;

const AVATARS = [
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-pink-500 to-rose-500",
  "from-cyan-500 to-blue-500",
];

export function avatarGradient(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 13 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length];
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
