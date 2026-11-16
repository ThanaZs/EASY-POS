"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

// error ระหว่างโหลดหน้าใดๆ ใต้ /[locale] → แสดงหน้าลองใหม่แทนหน้าขาว/ดำของเบราว์เซอร์
export default function LocaleError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}
