import type { Provider, TimeRange, StatusConfig } from '../types';

// 服务商列表
export const PROVIDERS: Provider[] = [
  { id: '88code', name: '88code', services: ['cc', 'cx'] },
  { id: 'xychatai', name: 'xychatai', services: ['cx'] },
  { id: 'duckcoding', name: 'duckcoding', services: ['cc', 'cx'] },
  { id: 'www.right.codes', name: 'www.right.codes', services: ['cx'] },
];

// 时间范围配置
export const TIME_RANGES: TimeRange[] = [
  { id: '24h', label: '近24小时', points: 24, unit: 'hour' },
  { id: '7d', label: '近7天', points: 7, unit: 'day' },
  { id: '30d', label: '近30天', points: 30, unit: 'day' },
];

// 状态配置
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

// API 基础 URL（使用相对路径，自动适配当前域名）
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// 是否使用模拟数据
export const USE_MOCK_DATA =
  (import.meta.env.VITE_USE_MOCK_DATA || '').toLowerCase() === 'true';

// 反馈/推荐服务商链接
export const FEEDBACK_URL =
  import.meta.env.VITE_FEEDBACK_URL ||
  'https://github.com/prehisle/relay-pulse/issues/new?template=provider.md&labels=provider';
