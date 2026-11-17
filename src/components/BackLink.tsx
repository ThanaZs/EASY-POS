import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** ปุ่ม "← กลับ" บนสุดของหน้า — ทุกหน้าที่ไม่ใช่หน้าหลักต้องมี */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      prefetch={false}
      href={href}
      className="inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-sm text-muted transition hover:text-ink active:scale-95"
    >
      <ArrowLeft className="size-4" /> {label}
    </Link>
  );
}
