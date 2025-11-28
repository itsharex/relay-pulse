import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  PATH_LANGUAGE_MAP,
  isSupportedLanguage,
  type SupportedLanguage,
} from '../i18n';

/**
 * 同步 URL 路径语言前缀与 i18next 语言状态
 *
 * @param pathLang - URL 路径中的语言前缀（如 'en'、'ru'、'ja'），无前缀则为 undefined
 *
 * @example
 * // 根路径（无语言前缀）
 * useSyncLanguage(); // 使用 localStorage 或浏览器语言
 *
 * // 带语言前缀的路径
 * useSyncLanguage('en'); // 强制使用英文
 * useSyncLanguage('ru'); // 强制使用俄文
 */
export function useSyncLanguage(pathLang?: string) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    // 获取当前 i18n 语言，使用类型守卫确保类型安全
    const rawLang = i18n.language;
    const currentLang: SupportedLanguage = isSupportedLanguage(rawLang) ? rawLang : 'zh-CN';

    // 场景 1: 根路径（无语言前缀），兜底非法语言
    if (!pathLang) {
      // 直接检查 rawLang 而非 currentLang，因为 currentLang 永远是有效值
      if (!isSupportedLanguage(rawLang)) {
        i18n.changeLanguage('zh-CN');
      }
      return;
    }

    // 场景 2: 尝试匹配新路径前缀（如 'en' → 'en-US'）
    const targetLang = PATH_LANGUAGE_MAP[pathLang];

    // 场景 3: 无效语言前缀，重定向到根路径
    if (!targetLang) {
      navigate('/', { replace: true });
      return;
    }

    // 场景 4: 有效语言前缀，同步 i18n 语言状态
    if (currentLang !== targetLang) {
      i18n.changeLanguage(targetLang);
    }
  }, [pathLang, i18n, navigate]);
}
