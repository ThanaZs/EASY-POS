export function Alert({ kind = "error", children }: { kind?: "error" | "success"; children: React.ReactNode }) {
  const style =
    kind === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
      : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-xl border px-3 py-2 text-sm ${style}`}>
      {children}
    </p>
  );
}

/** เลือกข้อความจาก dictionary ตาม ?error=... (กันค่าแปลกๆ จาก URL) */
export function pickMessage<T extends Record<string, string>>(map: T, key: unknown): string | null {
  return typeof key === "string" && Object.hasOwn(map, key) ? map[key] : null;
}
