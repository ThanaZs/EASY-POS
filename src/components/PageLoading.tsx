import { LoaderCircle } from "lucide-react";

/** แสดงทันทีระหว่างรอหน้าใหม่จาก server (ใช้ใน loading.tsx) */
export function PageLoading() {
  return (
    <div className="grid min-h-[40vh] place-items-center" role="status" aria-live="polite">
      <LoaderCircle className="size-8 animate-spin text-brand" aria-hidden />
    </div>
  );
}
