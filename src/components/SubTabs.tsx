import Link from "next/link";

/** แท็บสลับหน้าย่อย (เช่น ยอดขาย: ภาพรวม | บิลทั้งหมด) — เป็นลิงก์ธรรมดา */
export function SubTabs({ tabs }: { tabs: Array<{ href: string; label: string; active: boolean }> }) {
  if (tabs.length < 2) return null;
  return (
    <nav className="flex gap-1 rounded-xl border border-line bg-card p-1" aria-label="tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          prefetch={false}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={`flex-1 rounded-lg px-3 py-2 text-center text-sm transition active:scale-[0.98] ${
            tab.active ? "bg-brand font-semibold text-white shadow-sm" : "text-muted hover:bg-surface hover:text-ink"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
