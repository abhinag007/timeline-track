"use client";

import { Moon, Sun } from "lucide-react";

// Both icons are rendered and CSS shows the right one, so the server HTML
// never has to know the theme.
export default function ThemeToggle({ className = "icon-btn" }: { className?: string }) {
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  return (
    <button type="button" onClick={toggle} className={className} title="Switch light / dark" aria-label="Switch between light and dark mode">
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  );
}
