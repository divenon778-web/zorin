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
  flag: string;
}

export const LOCALES: LocaleEntry[] = [
  { code: "en", label: "English",       native: "English", flag: "🇺🇸" },
  { code: "es", label: "Spanish",       native: "Español", flag: "🇪🇸" },
  { code: "fr", label: "French",        native: "Français", flag: "🇫🇷" },
  { code: "de", label: "German",        native: "Deutsch", flag: "🇩🇪" },
  { code: "pt", label: "Portuguese",    native: "Português", flag: "🇵🇹" },
  { code: "ja", label: "Japanese",      native: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "Korean",        native: "한국어", flag: "🇰🇷" },
  { code: "zh", label: "Chinese",       native: "中文", flag: "🇨🇳" },
  { code: "ru", label: "Russian",       native: "Русский", flag: "🇷🇺" },
  { code: "ar", label: "Arabic",        native: "العربية", flag: "🇸🇦" },
  { code: "it", label: "Italian",       native: "Italiano", flag: "🇮🇹" },
  { code: "pl", label: "Polish",        native: "Polski", flag: "🇵🇱" },
  { code: "tr", label: "Turkish",       native: "Türkçe", flag: "🇹🇷" },
  { code: "nl", label: "Dutch",         native: "Nederlands", flag: "🇳🇱" },
  { code: "id", label: "Indonesian",    native: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "hi", label: "Hindi",         native: "हिन्दी", flag: "🇮🇳" },
  { code: "vi", label: "Vietnamese",    native: "Tiếng Việt", flag: "🇻🇳" },
  { code: "th", label: "Thai",          native: "ไทย", flag: "🇹🇭" },
  { code: "sv", label: "Swedish",       native: "Svenska", flag: "🇸🇪" },
  { code: "da", label: "Danish",        native: "Dansk", flag: "🇩🇰" },
  { code: "no", label: "Norwegian",     native: "Norsk", flag: "🇳🇴" },
  { code: "fi", label: "Finnish",       native: "Suomi", flag: "🇫🇮" },
  { code: "cs", label: "Czech",         native: "Čeština", flag: "🇨🇿" },
  { code: "ro", label: "Romanian",      native: "Română", flag: "🇷🇴" },
  { code: "uk", label: "Ukrainian",     native: "Українська", flag: "🇺🇦" },
  { code: "el", label: "Greek",         native: "Ελληνικά", flag: "🇬🇷" },
  { code: "he", label: "Hebrew",        native: "עברית", flag: "🇮🇱" },
  { code: "ms", label: "Malay",         native: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "tl", label: "Filipino",      native: "Filipino", flag: "🇵🇭" },
  { code: "bn", label: "Bengali",       native: "বাংলা", flag: "🇧🇩" },
];

const STORAGE_KEY = "wisp_locale";

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
  es: {},
  fr: {},
  de: {},
  pt: {},
  ja: {},
  ko: {},
  zh: {},
  ru: {},
  ar: {},
  it: {},
  pl: {},
  tr: {},
  nl: {},
  id: {},
  hi: {},
  vi: {},
  th: {},
  sv: {},
  da: {},
  no: {},
  fi: {},
  cs: {},
  ro: {},
  uk: {},
  el: {},
  he: {},
  ms: {},
  tl: {},
  bn: {},
};

/* Fallback: if a locale is missing a key, use English */
function t(locale: SupportedLocale, key: string, options?: { query?: string }): string {
  let text = translations[locale]?.[key] ?? translations.en[key] ?? key;
  if (options?.query !== undefined) {
    text = text.replace(/{query}/, options.query);
  }
  return text;
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
    (key: string, options?: { query?: string }) => t(locale, key, options),
    [locale],
  );

  return useMemo(
    () => ({ locale, setLocale, t: translate }),
    [locale, setLocale, translate],
  );
}
