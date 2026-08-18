"use client";

import { useState, useCallback, useMemo } from "react";

export type SupportedLocale =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "ja"
  | "ko"
  | "zh"
  | "ru"
  | "ar"
  | "it"
  | "pl"
  | "tr"
  | "nl"
  | "id"
  | "hi"
  | "vi"
  | "th"
  | "sv"
  | "da"
  | "no"
  | "fi"
  | "cs"
  | "ro"
  | "uk"
  | "el"
  | "he"
  | "ms"
  | "tl"
  | "bn";

export interface LocaleEntry {
  code: SupportedLocale;
  label: string;
  native: string;
}

export const LOCALES: LocaleEntry[] = [
  { code: "en", label: "English",       native: "English" },
  { code: "es", label: "Spanish",       native: "Español" },
  { code: "fr", label: "French",        native: "Français" },
  { code: "de", label: "German",        native: "Deutsch" },
  { code: "pt", label: "Portuguese",    native: "Português" },
  { code: "ja", label: "Japanese",      native: "日本語" },
  { code: "ko", label: "Korean",        native: "한국어" },
  { code: "zh", label: "Chinese",       native: "中文" },
  { code: "ru", label: "Russian",       native: "Русский" },
  { code: "ar", label: "Arabic",        native: "العربية" },
  { code: "it", label: "Italian",       native: "Italiano" },
  { code: "pl", label: "Polish",        native: "Polski" },
  { code: "tr", label: "Turkish",       native: "Türkçe" },
  { code: "nl", label: "Dutch",         native: "Nederlands" },
  { code: "id", label: "Indonesian",    native: "Bahasa Indonesia" },
  { code: "hi", label: "Hindi",         native: "हिन्दी" },
  { code: "vi", label: "Vietnamese",    native: "Tiếng Việt" },
  { code: "th", label: "Thai",          native: "ไทย" },
  { code: "sv", label: "Swedish",       native: "Svenska" },
  { code: "da", label: "Danish",        native: "Dansk" },
  { code: "no", label: "Norwegian",     native: "Norsk" },
  { code: "fi", label: "Finnish",       native: "Suomi" },
  { code: "cs", label: "Czech",         native: "Čeština" },
  { code: "ro", label: "Romanian",      native: "Română" },
  { code: "uk", label: "Ukrainian",     native: "Українська" },
  { code: "el", label: "Greek",         native: "Ελληνικά" },
  { code: "he", label: "Hebrew",        native: "עברית" },
  { code: "ms", label: "Malay",         native: "Bahasa Melayu" },
  { code: "tl", label: "Filipino",      native: "Filipino" },
  { code: "bn", label: "Bengali",       native: "বাংলা" },
];

const STORAGE_KEY = "zorin_locale";

function getStoredLocale(): SupportedLocale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && LOCALES.some((l) => l.code === stored)) return stored as SupportedLocale;
  const browser = navigator.language?.split("-")[0];
  if (browser && LOCALES.some((l) => l.code === browser)) return browser as SupportedLocale;
  return "en";
}

/* Minimal translation dictionary — only keys referenced in the codebase */
const translations: Record<SupportedLocale, Record<string, string>> = {
  en: {
    "common.saved": "Saved!",
    "common.failed": "Failed",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.save": "Save",
    "common.confirm": "Confirm",
    "common.close": "Close",
    "common.loading": "Loading…",
    "settings.title": "Settings",
    "settings.appearance": "Appearance",
    "settings.language": "Language",
    "settings.account": "Account",
    "settings.display_name": "Display Name",
    "settings.username": "Username",
    "settings.compact_mode": "Compact Mode",
    "settings.danger_zone": "Danger Zone",
    "settings.delete_account": "Delete Account",
    "settings.clear_data": "Clear All Data",
  },
};

/* Fallback: if a locale is missing a key, use English */
function t(locale: SupportedLocale, key: string): string {
  return translations[locale]?.[key] ?? translations.en[key] ?? key;
}

let listeners: Array<() => void> = [];
let currentLocale: SupportedLocale = "en";

function emitChange() {
  for (const l of listeners) l();
}

export function useI18n() {
  const [locale, setLocalState] = useState<SupportedLocale>(getStoredLocale);

  const setLocale = useCallback((next: SupportedLocale) => {
    currentLocale = next;
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, next);
    emitChange();
  }, []);

  const translate = useCallback(
    (key: string) => t(locale, key),
    [locale],
  );

  return useMemo(
    () => ({ locale, setLocale, t: translate }),
    [locale, setLocale, translate],
  );
}
