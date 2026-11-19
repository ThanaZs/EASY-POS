import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** ปุ่ม "← กลับ" บนสุดของหน้า — ทุกหน้าที่ไม่ใช่หน้าหลักต้องมี */
/** mobileHidden = มือถือมีปุ่ม ← บนแถบบนแล้ว (ผ่าน <PageTitle back>) */
export function BackLink({ href, label, mobileHidden = false }: { href: string; label: string; mobileHidden?: boolean }) {
  return (
    <Link
      prefetch={false}
      href={href}
      className={`${mobileHidden ? "hidden lg:inline-flex" : "inline-flex"} items-center gap-1 rounded-lg py-1 pr-2 text-sm text-muted transition hover:text-ink active:scale-95`}
    >
      <ArrowLeft className="size-4" /> {label}
    </Link>
  );
}
