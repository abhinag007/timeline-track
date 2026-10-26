// The Timeline mark: past days as small nodes on a rising path, today as the
// green node at the end. The path is drawn in currentColor; the tile stays dark
// in both themes so the brand looks the same everywhere.
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M4.5 17.5 9.5 12l4 2.5L18 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <circle cx="4.5" cy="17.5" r="1.75" fill="currentColor" />
      <circle cx="9.5" cy="12" r="1.75" fill="currentColor" />
      <circle cx="13.5" cy="14.5" r="1.75" fill="currentColor" />
      <circle cx="18" cy="7.5" r="4.25" fill="#3dd68c" opacity="0.25" />
      <circle cx="18" cy="7.5" r="2.5" fill="#3dd68c" />
    </svg>
  );
}

export function LogoTile({ size = "md" }: { size?: "md" | "lg" }) {
  const cls = size === "lg" ? "size-11 rounded-2xl" : "size-9 rounded-xl";
  return (
    <span className={`flex shrink-0 items-center justify-center bg-[#21201c] text-white shadow-card ring-1 ring-white/10 ${cls}`}>
      <LogoMark className={size === "lg" ? "size-6" : "size-5"} />
    </span>
  );
}
