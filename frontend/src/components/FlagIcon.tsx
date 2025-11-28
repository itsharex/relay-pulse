import CN from 'country-flag-icons/react/3x2/CN';
import US from 'country-flag-icons/react/3x2/US';
import RU from 'country-flag-icons/react/3x2/RU';
import JP from 'country-flag-icons/react/3x2/JP';
import type { SupportedLanguage } from '../i18n';

interface FlagIconProps {
  language: SupportedLanguage;
  className?: string;
}

/**
 * 国旗图标组件
 *
 * 使用 SVG 国旗图标替代 Unicode emoji，解决 Windows 系统下国旗 emoji 不显示的问题
 *
 * 特性：
 * - 跨平台一致渲染（Windows、macOS、Linux）
 * - 使用 country-flag-icons 库（3x2 比例，更符合真实国旗）
 * - 类型安全（TypeScript）
 *
 * @param language - 语言编码（zh-CN、en-US、ru-RU、ja-JP）
 * @param className - 可选的 CSS 类名（默认 w-5 h-auto）
 */
export function FlagIcon({ language, className = 'w-5 h-auto' }: FlagIconProps) {
  const flagComponents = {
    'zh-CN': CN,
    'en-US': US,
    'ru-RU': RU,
    'ja-JP': JP,
  };

  const FlagComponent = flagComponents[language];

  return <FlagComponent className={className} />;
}
