"use client";

import { ErrorScreen } from "@/components/ErrorScreen";
import "./globals.css";

// error ที่ layout หลัก (ต้องมี <html>/<body> เอง)
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="th">
      <body className="min-h-dvh bg-surface text-ink">
        <ErrorScreen error={error} retry={retry} />
      </body>
    </html>
  );
}
