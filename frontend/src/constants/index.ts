import type { Provider, TimeRange, StatusConfig } from '../types';
import type { TFunction } from 'i18next';

// 服务商列表
export const PROVIDERS: Provider[] = [
  { id: '88code', name: '88code', services: ['cc', 'cx'] },
  { id: 'xychatai', name: 'xychatai', services: ['cx'] },
  { id: 'duckcoding', name: 'duckcoding', services: ['cc', 'cx'] },
  { id: 'www.right.codes', name: 'www.right.codes', services: ['cx'] },
];

// 时间范围配置（保留以兼容现有代码）
export const TIME_RANGES: TimeRange[] = [
  { id: '24h', label: '近24小时', points: 24, unit: 'hour' },
  { id: '7d', label: '近7天', points: 7, unit: 'day' },
  { id: '30d', label: '近30天', points: 30, unit: 'day' },
];

// 时间范围配置工厂函数（i18n 版本）
export const getTimeRanges = (t: TFunction): TimeRange[] => [
  { id: '24h', label: t('controls.timeRanges.24h'), points: 24, unit: 'hour' },
  { id: '7d', label: t('controls.timeRanges.7d'), points: 7, unit: 'day' },
  { id: '30d', label: t('controls.timeRanges.30d'), points: 30, unit: 'day' },
];

// 状态配置（保留以兼容现有代码）
export const STATUS: Record<string, StatusConfig> = {
  AVAILABLE: {
    color: 'bg-emerald-500',
    text: 'text-emerald-400',
    glow: 'shadow-[0_0_10px_rgba(16,185,129,0.6)]',
    label: '可用',
    weight: 3,
  },
  DEGRADED: {
    color: 'bg-amber-400',
    text: 'text-amber-400',
    glow: 'shadow-[0_0_10px_rgba(251,191,36,0.6)]',
    label: '波动',
    weight: 2,
  },
  MISSING: {
    color: 'bg-slate-400',
    text: 'text-slate-400',
    glow: 'shadow-[0_0_10px_rgba(148,163,184,0.4)]',
    label: '无数据',
    weight: 1,  // 算作可用（避免初期可用率过低）
  },
  UNAVAILABLE: {
    color: 'bg-rose-500',
    text: 'text-rose-400',
    glow: 'shadow-[0_0_10px_rgba(244,63,94,0.6)]',
    label: '不可用',
    weight: 1,
  },
};

// 状态配置工厂函数（i18n 版本）
export const getStatusConfig = (t: TFunction): Record<string, StatusConfig> => ({
  AVAILABLE: {
    color: 'bg-emerald-500',
    text: 'text-emerald-400',
    glow: 'shadow-[0_0_10px_rgba(16,185,129,0.6)]',
    label: t('status.available'),
    weight: 3,
  },
  DEGRADED: {
    color: 'bg-amber-400',
    text: 'text-amber-400',
    glow: 'shadow-[0_0_10px_rgba(251,191,36,0.6)]',
    label: t('status.degraded'),
    weight: 2,
  },
  MISSING: {
    color: 'bg-slate-400',
    text: 'text-slate-400',
    glow: 'shadow-[0_0_10px_rgba(148,163,184,0.4)]',
    label: t('status.missing'),
    weight: 1,  // 算作可用（避免初期可用率过低）
  },
  UNAVAILABLE: {
    color: 'bg-rose-500',
    text: 'text-rose-400',
    glow: 'shadow-[0_0_10px_rgba(244,63,94,0.6)]',
    label: t('status.unavailable'),
    weight: 1,
  },
});

// 保留原有导出以兼容不需要翻译的场景
export const STATUS_COLORS = {
  AVAILABLE: {
    color: 'bg-emerald-500',
    text: 'text-emerald-400',
    glow: 'shadow-[0_0_10px_rgba(16,185,129,0.6)]',
  },
  DEGRADED: {
    color: 'bg-amber-400',
    text: 'text-amber-400',
    glow: 'shadow-[0_0_10px_rgba(251,191,36,0.6)]',
  },
  MISSING: {
    color: 'bg-slate-400',
    text: 'text-slate-400',
    glow: 'shadow-[0_0_10px_rgba(148,163,184,0.4)]',
  },
  UNAVAILABLE: {
    color: 'bg-rose-500',
    text: 'text-rose-400',
    glow: 'shadow-[0_0_10px_rgba(244,63,94,0.6)]',
  },
} as const;

// API 基础 URL（使用相对路径，自动适配当前域名）
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// 是否使用模拟数据
export const USE_MOCK_DATA =
  (import.meta.env.VITE_USE_MOCK_DATA || '').toLowerCase() === 'true';

// 反馈链接配置
// 向后兼容：优先使用新的环境变量，回退到旧的 VITE_FEEDBACK_URL
const legacyFeedbackUrl = import.meta.env.VITE_FEEDBACK_URL;
export const FEEDBACK_URLS = {
  // 推荐服务商
  PROVIDER_SUGGESTION:
    import.meta.env.VITE_FEEDBACK_PROVIDER_URL ||
    legacyFeedbackUrl ||
    'https://github.com/prehisle/relay-pulse/issues/new?template=1-provider-suggestion.yml',
  // 问题反馈
  BUG_REPORT:
    import.meta.env.VITE_FEEDBACK_BUG_URL ||
    legacyFeedbackUrl ||
    'https://github.com/prehisle/relay-pulse/issues/new?template=2-bug-report.yml',
} as const;
