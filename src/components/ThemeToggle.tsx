"use client";

import { Moon, Sun } from "lucide-react";

// Runs in <head> before first paint: a saved choice wins, otherwise follow the
// system setting (and keep following it until the user picks one).
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)");function a(){d.dataset.theme=localStorage.getItem("theme")||(m.matches?"dark":"light")}a();m.addEventListener("change",a)}catch(e){}})()`;

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
