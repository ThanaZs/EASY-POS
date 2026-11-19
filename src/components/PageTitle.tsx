"use client";

import { createContext, useContext, useEffect } from "react";

type Title = { text: string; back?: string } | null;
export const PageTitleContext = createContext<(t: Title) => void>(() => {});

/**
 * หัวข้อหน้า — คอม: แสดงเป็น h1 ในหน้า / มือถือ: ย้ายขึ้นไปแถบบน (แทนชื่อร้าน) ประหยัดพื้นที่
 * back = หน้าย่อย (เช่น เพิ่มสินค้า) → มือถือแสดงปุ่ม ← ที่แถบบนแทน ☰
 */
export function PageTitle({
  title,
  back,
  className = "",
}: {
  title: string;
  back?: string;
  className?: string;
}) {
  const set = useContext(PageTitleContext);
  useEffect(() => {
    set({ text: title, back });
    return () => set(null);
  }, [set, title, back]);
  return (
    <h1 className={`hidden text-xl font-bold lg:block ${className}`}>
      {title}
    </h1>
  );
}
