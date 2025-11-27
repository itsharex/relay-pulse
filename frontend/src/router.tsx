import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import App from './App';
import {
  PATH_LANGUAGE_MAP,
  isSupportedLanguage,
  type SupportedLanguage,
} from './i18n';

/**
 * 语言包装器组件
 *
 * 职责：
 * 1. 解析 URL 路径中的语言前缀
 * 2. 同步 URL 语言与 i18next 语言状态
 * 3. 处理无效语言前缀（重定向到根路径）
 */
interface LanguageWrapperProps {
  /** URL 路径中的语言前缀（如 'en'、'ru'、'ja' 或旧格式 'en-US'） */
  pathLang?: string;
}

function LanguageWrapper({ pathLang }: LanguageWrapperProps) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

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
  }, [pathLang, i18n, navigate, location]);

  return <App />;
}

/**
 * 应用路由配置
 *
 * 路由规则：
 * 1. 根路径 `/` → 默认语言（由 i18n 检测器决定）
 * 2. 简化语言路径 `/en/*`、`/ru/*`、`/ja/*` → 对应语言版本
 * 3. 无效路径 → 重定向到根路径
 *
 * 注意：
 * - `/api/*`、`/health` 等技术路径由后端处理，不会被前端路由拦截
 * - 语言前缀仅用于内容页面，不影响 API 路径
 */
export default function AppRouter() {
  return (
    <Routes>
      {/* 中文默认路径（无前缀） */}
      <Route path="/" element={<LanguageWrapper />} />

      {/* 简化语言前缀路径 */}
      <Route path="/en/*" element={<LanguageWrapper pathLang="en" />} />
      <Route path="/ru/*" element={<LanguageWrapper pathLang="ru" />} />
      <Route path="/ja/*" element={<LanguageWrapper pathLang="ja" />} />

      {/* 捕获所有未匹配路径，重定向到根 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
