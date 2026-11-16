import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, locales } from "@/i18n/config";

// เลือกภาษา: cookie "locale" > Accept-Language > ค่าเริ่มต้น แล้ว redirect ไป /<locale>/...
function pickLocale(req: NextRequest) {
  const fromCookie = req.cookies.get("locale")?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const header = req.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const code = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return defaultLocale;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasLocale = locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (hasLocale) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/${pickLocale(req)}${pathname === "/" ? "/login" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // ข้าม api, ไฟล์ static และไฟล์ที่มีนามสกุล
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
