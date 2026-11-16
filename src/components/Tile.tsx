import Link from "next/link";
import type { LucideIcon } from "lucide-react";

const tileClass =
  "group relative flex w-full flex-col items-center gap-3 rounded-2xl border border-line bg-card p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5";

type TileProps = {
  label: string;
  Icon: LucideIcon;
  color: string; // tailwind bg-* class
  badge?: string;
};

function TileBody({ label, Icon, color, badge }: TileProps) {
  return (
    <>
      {badge && (
        <span className="absolute right-2 top-2 rounded-full bg-amber-100 px-2 text-[10px] font-semibold text-amber-700">
          {badge}
        </span>
      )}
      <span className={`grid size-14 place-items-center rounded-2xl text-white sm:size-16 ${color}`}>
        <Icon className="size-7 sm:size-8" strokeWidth={1.8} />
      </span>
      <span className="text-sm font-medium sm:text-base">{label}</span>
    </>
  );
}

// การ์ดเมนู — รองรับทั้งมือถือ (2 คอลัมน์) และคอม (3-4 คอลัมน์) ผ่าน grid ของหน้าที่เรียกใช้
export function Tile({ href, ...props }: TileProps & { href: string }) {
  return (
    <Link href={href} className={tileClass}>
      <TileBody {...props} />
    </Link>
  );
}

/** การ์ดเมนูที่เป็นปุ่ม submit (ใช้ใน <form action={...}> เช่น ออกจากระบบ) */
export function TileButton(props: TileProps) {
  return (
    <button type="submit" className={`${tileClass} cursor-pointer`}>
      <TileBody {...props} />
    </button>
  );
}
