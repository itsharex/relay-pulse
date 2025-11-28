import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';
import ruRU from './locales/ru-RU.json';
import jaJP from './locales/ja-JP.json';

// 语言显示名称（保留用于未来扩展，如显示完整语言名称）
export const LANGUAGE_NAMES: Record<string, { native: string; english: string }> = {
  'zh-CN': { native: '中文', english: 'Chinese' },
  'en-US': { native: 'English', english: 'English' },
  'ru-RU': { native: 'Русский', english: 'Russian' },
  'ja-JP': { native: '日本語', english: 'Japanese' },
};

// 支持的语言列表
export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US', 'ru-RU', 'ja-JP'] as const;

// 支持的语言类型（内部仍使用完整 locale 编码，如 en-US）
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * 类型守卫：检查语言编码是否为支持的语言
 *
 * @param lng - 语言编码字符串
 * @returns 是否为支持的语言（类型收窄为 SupportedLanguage）
 *
 * 用途：
 * - 替代 `SUPPORTED_LANGUAGES.includes(lng as SupportedLanguage)` 的强制类型断言
 * - 让 TypeScript 正确收窄类型，提升类型安全
 */
export const isSupportedLanguage = (lng: string): lng is SupportedLanguage =>
  (SUPPORTED_LANGUAGES as readonly string[]).includes(lng);

/**
 * 语言归一化：将浏览器语言码标准化为支持的语言
 *
 * @param lng - 原始语言码（如 'en'、'zh'、'en-US'）
 * @returns 标准化后的语言码（SupportedLanguage）
 *
 * 用途：
 * - 处理无地区码的语言（'en' → 'en-US'、'zh' → 'zh-CN'）
 * - 提升首次访问时的语言检测准确性
 *
 * 示例：
 * - 'en' → 'en-US'
 * - 'zh' → 'zh-CN'
 * - 'en-US' → 'en-US'（已标准）
 * - 'fr' → 'zh-CN'（不支持，回退到默认）
 */
export const normalizeLanguage = (lng: string): SupportedLanguage => {
  // 完整匹配（如 'en-US'、'zh-CN'）
  if (isSupportedLanguage(lng)) {
    return lng;
  }

  // 处理无地区码的语言（提取前缀）
  const prefix = lng.split('-')[0].toLowerCase();

  switch (prefix) {
    case 'zh':
      return 'zh-CN'; // 中文 → 简体中文
    case 'en':
      return 'en-US'; // 英文 → 美国英语
    case 'ru':
      return 'ru-RU'; // 俄语
    case 'ja':
      return 'ja-JP'; // 日语
    default:
      return 'zh-CN'; // 默认中文
  }
};

/**
 * URL 路径前缀到语言编码的映射
 *
 * 设计说明：
 * - 简化 URL 路径以提升美观性（/en/ 而非 /en-US/）
 * - 内部仍使用完整 locale 编码（en-US）以兼容 i18next
 *
 * 示例：
 * - '' (空字符串) → zh-CN（默认语言，无前缀）
 * - 'en' → en-US（英文）
 * - 'ru' → ru-RU（俄语）
 * - 'ja' → ja-JP（日语）
 */
export const PATH_LANGUAGE_MAP: Record<string, SupportedLanguage> = {
  '': 'zh-CN',
  en: 'en-US',
  ru: 'ru-RU',
  ja: 'ja-JP',
};

/**
 * 语言编码到 URL 路径前缀的映射（反向映射）
 *
 * 用于生成多语言 URL，例如语言切换时
 *
 * 示例：
 * - zh-CN → ''（中文无前缀）
 * - en-US → 'en'
 * - ru-RU → 'ru'
 * - ja-JP → 'ja'
 */
export const LANGUAGE_PATH_MAP: Record<SupportedLanguage, string> = {
  'zh-CN': '',
  'en-US': 'en',
  'ru-RU': 'ru',
  'ja-JP': 'ja',
};

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
      // 语言归一化：将浏览器语言标准化
      convertDetectedLanguage: (lng) => normalizeLanguage(lng),
    },
  });

export default i18n;
