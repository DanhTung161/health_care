"use client";

import { Moon } from "lucide-react";

const THEME_STORAGE_KEY = "health-care-theme";

export default function ThemeToggle() {
  function toggleTheme() {
    const nextIsDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextIsDark);
    document.documentElement.style.colorScheme = nextIsDark ? "dark" : "light";
    localStorage.setItem(THEME_STORAGE_KEY, nextIsDark ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="hidden text-slate-500 transition hover:text-slate-900 sm:block"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      <Moon className="h-5 w-5" />
    </button>
  );
}
