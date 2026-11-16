"use client";

import { useEffect, useState } from "react";

/** ส่งทามโซนของเครื่องผู้ใช้ไปกับฟอร์ม (เช่นตอนสมัคร) */
export function TimeZoneInput({ name = "timeZone", fallback }: { name?: string; fallback: string }) {
  const [tz, setTz] = useState(fallback);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ค่ามีเฉพาะฝั่ง browser
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || fallback);
  }, [fallback]);
  return <input type="hidden" name={name} value={tz} />;
}
