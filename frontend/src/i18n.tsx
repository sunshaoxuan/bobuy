import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ConfigProvider } from 'antd';
import antdZhCN from 'antd/locale/zh_CN';
import antdZhTW from 'antd/locale/zh_TW';
import antdEnUS from 'antd/locale/en_US';
import antdJaJP from 'antd/locale/ja_JP';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/zh-tw';
import 'dayjs/locale/ja';
import type { Dictionary } from './locales/types';
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';
import jaJP from './locales/ja-JP';
import zhTW from './locales/zh-TW';

export type Locale = 'zh-CN' | 'ja-JP' | 'en-US' | 'zh-TW';

const STORAGE_KEY = 'bobbuy_locale';
const DEFAULT_LOCALE: Locale = 'zh-CN';

const translations: Record<Locale, Dictionary> = {
  'zh-CN': zhCN,
  'ja-JP': jaJP,
  'en-US': enUS,
  'zh-TW': zhTW
};

export const supportedLocales: Locale[] = ['zh-CN', 'en-US', 'ja-JP', 'zh-TW'];
const componentLocales = { 'zh-CN': antdZhCN, 'zh-TW': antdZhTW, 'en-US': antdEnUS, 'ja-JP': antdJaJP };
const dateLocales = { 'zh-CN': 'zh-cn', 'zh-TW': 'zh-tw', 'en-US': 'en', 'ja-JP': 'ja' };

export const getStoredLocale = (): Locale => {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return supportedLocales.includes(stored as Locale) ? (stored as Locale) : DEFAULT_LOCALE;
  } catch { return DEFAULT_LOCALE; }
};

export const translate = (locale: Locale, key: string, values?: Record<string, string | number>): string => {
  return (translations[locale][key] ?? key).replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    values?.[name] === undefined ? placeholder : String(values[name]));
};

// Merchant-authored content can have fewer translations than the UI resources.
export const localizedContent = (value: Record<string, string>, locale: Locale): string =>
  value[locale] || value['zh-CN'] || value['en-US'] || Object.values(value).find(Boolean) || '';

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* Keep the current session usable when storage is disabled. */ }
    }
  }, []);

  const t = useCallback((key: string, values?: Record<string, string | number>) => translate(locale, key, values), [locale]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t('app.brand');
    dayjs.locale(dateLocales[locale]);
  }, [locale, t]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  const fontFamily=locale==='ja-JP'?'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", "Noto Sans SC", sans-serif':'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Noto Sans JP", sans-serif';
  return <I18nContext.Provider value={value}><ConfigProvider locale={componentLocales[locale]} theme={{ token: { colorPrimary: '#d93630', borderRadius: 8, fontFamily } }}>{children}</ConfigProvider></I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
