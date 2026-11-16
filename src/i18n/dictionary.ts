import "server-only";
import { defaultLocale, isLocale, type Locale } from "./config";
import type th from "./messages/th.json";

export type Dictionary = typeof th;

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  th: () => import("./messages/th.json").then((m) => m.default),
  en: () => import("./messages/en.json").then((m) => m.default),
};

export async function getDictionary(locale: string): Promise<Dictionary> {
  return loaders[isLocale(locale) ? locale : defaultLocale]();
}
