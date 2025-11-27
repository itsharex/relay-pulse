import { Activity, CheckCircle, AlertTriangle, Sparkles, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { FEEDBACK_URLS } from '../constants';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from '../i18n';

interface HeaderProps {
  stats: {
    total: number;
    healthy: number;
    issues: number;
  };
}

export function Header({ stats }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // 语言简称显示（按钮和下拉项共用）
  const getLanguageShortLabel = (lang: string): string => {
    switch (lang) {
      case 'zh-CN':
        return 'CN';
      case 'en-US':
        return 'EN';
      case 'ru-RU':
        return 'RU';
      case 'ja-JP':
        return 'JA';
      default:
        return lang;
    }
  };

  const handleLanguageChange = (newLang: string) => {
    const currentLang = i18n.language;

    // 构建新路径
    let newPath = location.pathname;
    const queryString = location.search + location.hash;

    // 如果当前是语言路径（如 /en-US/），移除语言前缀
    if (currentLang !== 'zh-CN' && newPath.startsWith(`/${currentLang}`)) {
      newPath = newPath.substring(`/${currentLang}`.length) || '/';
    }

    // 添加新语言前缀（中文除外）
    if (newLang !== 'zh-CN') {
      newPath = `/${newLang}${newPath === '/' ? '' : newPath}`;
    }

    // 更新当前语言（包括切回中文的场景）
    i18n.changeLanguage(newLang);

    navigate(newPath + queryString);
  };

  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 border-b border-slate-800/50 pb-3">
      {/* 左侧：Logo 和标语 */}
      <div>
        <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
          <div className="p-1.5 sm:p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
            RelayPulse
          </h1>
        </div>
        <p className="text-slate-400 text-xs sm:text-sm flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          {t('header.tagline')}
        </p>
      </div>

      {/* 右侧：语言切换、统计和推荐按钮 */}
      <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3 sm:gap-4 text-sm md:items-center">
        {/* 语言切换器 */}
        <div className="relative group">
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-600 transition-all duration-200"
            aria-label={t('accessibility.changeLanguage')}
          >
            <Globe size={16} className="text-slate-400" />
            <span className="text-sm font-medium">
              {getLanguageShortLabel(i18n.language)}
            </span>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* 下拉菜单 */}
          <div className="absolute right-0 mt-2 w-48 py-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang)}
                className={`w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-slate-700/50 transition-colors ${
                  i18n.language === lang ? 'bg-slate-700/30 text-cyan-400' : 'text-slate-300'
                }`}
              >
                <span className="text-lg">{LANGUAGE_NAMES[lang].flag}</span>
                <span className="text-sm font-medium">{getLanguageShortLabel(lang)}</span>
                {i18n.language === lang && (
                  <svg className="w-4 h-4 ml-auto text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 推荐按钮 */}
        <a
          href={FEEDBACK_URLS.PROVIDER_SUGGESTION}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 font-semibold tracking-wide shadow-[0_0_12px_rgba(6,182,212,0.25)] hover:bg-cyan-500/20 transition min-h-[44px]"
        >
          <Sparkles size={14} />
          {t('header.recommendBtn')}
        </a>

        {/* 统计卡片 - 移动端横向排列 */}
        <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-4">
          <div className="px-3 sm:px-4 py-2 rounded-xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm flex items-center gap-2 sm:gap-3 shadow-lg">
            <div className="p-1 sm:p-1.5 rounded-full bg-emerald-500/10 text-emerald-400">
              <CheckCircle size={14} className="sm:w-4 sm:h-4" />
            </div>
            <div>
              <div className="text-slate-400 text-[10px] sm:text-xs">{t('header.stats.healthy')}</div>
              <div className="font-mono font-bold text-emerald-400 text-sm sm:text-base">
                {stats.healthy}
              </div>
            </div>
          </div>
          <div className="px-3 sm:px-4 py-2 rounded-xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm flex items-center gap-2 sm:gap-3 shadow-lg">
            <div className="p-1 sm:p-1.5 rounded-full bg-rose-500/10 text-rose-400">
              <AlertTriangle size={14} className="sm:w-4 sm:h-4" />
            </div>
            <div>
              <div className="text-slate-400 text-[10px] sm:text-xs">{t('header.stats.issues')}</div>
              <div className="font-mono font-bold text-rose-400 text-sm sm:text-base">
                {stats.issues}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
