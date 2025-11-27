import { useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import App from './App';
import { SUPPORTED_LANGUAGES } from './i18n';

// 语言包装器组件
function LanguageWrapper() {
  const { lang } = useParams<{ lang: string }>();
  const { i18n } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    // 根路径（无语言前缀），不做重定向，只确保语言有效
    if (!lang) {
      if (!SUPPORTED_LANGUAGES.includes(i18n.language as any)) {
        i18n.changeLanguage('zh-CN');
      }
      return;
    }

    // 验证语言参数是否有效
    if (SUPPORTED_LANGUAGES.includes(lang as any)) {
      // 如果 URL 中的语言与当前 i18n 语言不同，更新 i18n
      if (i18n.language !== lang) {
        i18n.changeLanguage(lang);
      }
    } else {
      // 无效语言，重定向到根路径
      navigate('/', { replace: true });
    }
  }, [lang, i18n, navigate]);

  return <App />;
}

export default function AppRouter() {
  return (
    <Routes>
      {/* 中文默认路径（无前缀） */}
      <Route path="/" element={<LanguageWrapper />} />

      {/* 语言前缀路径 */}
      <Route path="/:lang/*" element={<LanguageWrapper />} />

      {/* 捕获所有未匹配路径，重定向到根 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
