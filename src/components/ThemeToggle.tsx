"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

/** สลับธีมสว่าง/มืด — เปลี่ยนทันทีฝั่ง browser และจำไว้ใน cookie ให้ server render ถูกตั้งแต่แรก (ไม่กระพริบ) */
export function ThemeToggle({ initial, labels }: { initial: "light" | "dark"; labels: { light: string; dark: string } }) {
  const [theme, setTheme] = useState(initial);
  const next = theme === "dark" ? "light" : "dark";

  function toggle() {
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#0f1115" : "#ea580c");
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={next === "dark" ? labels.dark : labels.light}
      title={next === "dark" ? labels.dark : labels.light}
      className="grid size-8 place-items-center rounded-lg border border-line bg-card text-muted hover:text-brand-ink"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
