import type { SupportedLocale, TranslationDict } from './types';
import { en } from './locales/en';
import { de } from './locales/de';
import { fr } from './locales/fr';
import { ru } from './locales/ru';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { zh } from './locales/zh';
import { it } from './locales/it';
import { pt } from './locales/pt';
import { es } from './locales/es';
import { browser } from 'wxt/browser';

export * from './types';

const dictionaries: Record<SupportedLocale, TranslationDict> = {
  en,
  de,
  fr,
  ru,
  ja,
  ko,
  zh,
  it,
  pt,
  es,
};

/**
 * Detect the active locale from browser settings.
 * Prioritizes chrome.i18n if available, then navigator.language.
 */
export function detectLocale(): SupportedLocale {
  let rawLocale = 'en';

  if (typeof browser !== 'undefined' && browser.i18n?.getUILanguage) {
    rawLocale = browser.i18n.getUILanguage();
  } else if (typeof navigator !== 'undefined' && navigator.language) {
    rawLocale = navigator.language;
  }

  const primary = rawLocale.toLowerCase().split(/[-_]/)[0];

  if (primary in dictionaries) {
    return primary as SupportedLocale;
  }

  // Handle Chinese variants (zh-CN, zh-HK, zh-TW, etc.)
  if (primary === 'cn' || rawLocale.toLowerCase().startsWith('zh')) {
    return 'zh';
  }

  return 'en';
}

let cachedLocale: SupportedLocale | null = null;

export function getLocale(): SupportedLocale {
  if (!cachedLocale) {
    cachedLocale = detectLocale();
  }
  return cachedLocale;
}

export function setLocale(locale: SupportedLocale): void {
  cachedLocale = locale;
}

export function getDictionary(locale: SupportedLocale = getLocale()): TranslationDict {
  return dictionaries[locale] || dictionaries.en;
}

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<TranslationDict>;

/**
 * Retrieve a localized string by dot-notation key (e.g., 'controls.start').
 * Falls back to English if the translation is missing.
 */
export function t(key: TranslationKey, locale: SupportedLocale = getLocale()): string {
  const dict = getDictionary(locale);
  const fallback = dictionaries.en;

  const parts = key.split('.');

  let current: unknown = dict;
  let fallbackCurrent: unknown = fallback;

  for (const part of parts) {
    current = (current as Record<string, unknown>)?.[part];
    fallbackCurrent = (fallbackCurrent as Record<string, unknown>)?.[part];
  }

  if (typeof current === 'string' && current.length > 0) {
    return current;
  }
  if (typeof fallbackCurrent === 'string' && fallbackCurrent.length > 0) {
    return fallbackCurrent;
  }
  return key;
}
