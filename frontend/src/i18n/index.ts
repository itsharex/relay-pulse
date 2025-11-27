import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';
import ruRU from './locales/ru-RU.json';
import jaJP from './locales/ja-JP.json';

// 语言显示名称
export const LANGUAGE_NAMES: Record<string, { native: string; english: string; flag: string }> = {
  'zh-CN': { native: '中文', english: 'Chinese', flag: '🇨🇳' },
  'en-US': { native: 'English', english: 'English', flag: '🇺🇸' },
  'ru-RU': { native: 'Русский', english: 'Russian', flag: '🇷🇺' },
  'ja-JP': { native: '日本語', english: 'Japanese', flag: '🇯🇵' },
};

// 支持的语言列表
export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US', 'ru-RU', 'ja-JP'] as const;

i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
      'ru-RU': { translation: ruRU },
      'ja-JP': { translation: jaJP },
    },
    fallbackLng: 'zh-CN',
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false, // React 已经处理 XSS
    },
    detection: {
      // 语言检测优先级：localStorage > 浏览器语言
      // URL 路径语言由 router.tsx 中的 LanguageWrapper 组件处理
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;
