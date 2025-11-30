import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ViewMode, SortConfig } from '../types';

/**
 * URL 查询参数与状态同步的配置
 *
 * 需要同步的状态：
 * - period: 时间范围（默认 24h）
 * - provider: 服务商筛选
 * - service: 服务筛选
 * - channel: 渠道筛选
 * - category: 分类筛选
 * - view: 视图模式（默认 table）
 * - sort: 排序配置（格式：key_direction，如 uptime_desc）
 */

interface UrlState {
  timeRange: string;
  filterProvider: string;
  filterService: string;
  filterChannel: string;
  filterCategory: string;
  viewMode: ViewMode;
  sortConfig: SortConfig;
}

interface UrlStateActions {
  setTimeRange: (value: string) => void;
  setFilterProvider: (value: string) => void;
  setFilterService: (value: string) => void;
  setFilterChannel: (value: string) => void;
  setFilterCategory: (value: string) => void;
  setViewMode: (value: ViewMode) => void;
  setSortConfig: (value: SortConfig) => void;
}

// 默认值
const DEFAULTS = {
  timeRange: '24h',
  filterProvider: 'all',
  filterService: 'all',
  filterChannel: 'all',
  filterCategory: 'all',
  viewMode: 'table' as ViewMode,
  sortKey: 'uptime',
  sortDirection: 'desc' as const,
};

// URL 参数名映射
const PARAM_KEYS = {
  timeRange: 'period',
  filterProvider: 'provider',
  filterService: 'service',
  filterChannel: 'channel',
  filterCategory: 'category',
  viewMode: 'view',
  sort: 'sort',
};

/**
 * 解析排序参数
 * 格式：key_direction，如 uptime_desc、latency_asc
 */
function parseSortParam(param: string | null): SortConfig {
  if (!param) {
    return { key: DEFAULTS.sortKey, direction: DEFAULTS.sortDirection };
  }

  const lastUnderscore = param.lastIndexOf('_');
  if (lastUnderscore === -1) {
    return { key: param, direction: DEFAULTS.sortDirection };
  }

  const key = param.substring(0, lastUnderscore);
  const direction = param.substring(lastUnderscore + 1);

  if (direction === 'asc' || direction === 'desc') {
    return { key, direction };
  }

  return { key: param, direction: DEFAULTS.sortDirection };
}

/**
 * 序列化排序配置为 URL 参数
 */
function serializeSortConfig(config: SortConfig): string {
  return `${config.key}_${config.direction}`;
}

/**
 * 双向同步 URL 查询参数和组件状态的 Hook
 *
 * 特性：
 * - 初始化时从 URL 恢复状态
 * - 状态变化时自动更新 URL
 * - 默认值不会出现在 URL 中（保持 URL 简洁）
 * - 使用 replace 模式避免污染浏览器历史
 */
export function useUrlState(): [UrlState, UrlStateActions] {
  const [searchParams, setSearchParams] = useSearchParams();

  // 从 URL 读取当前状态
  const state = useMemo<UrlState>(() => {
    // 验证 viewMode 参数，防止 URL 被篡改导致内容区空白
    const rawViewMode = searchParams.get(PARAM_KEYS.viewMode);
    const viewMode: ViewMode = (rawViewMode === 'table' || rawViewMode === 'grid')
      ? rawViewMode
      : DEFAULTS.viewMode;

    return {
      timeRange: searchParams.get(PARAM_KEYS.timeRange) || DEFAULTS.timeRange,
      filterProvider: searchParams.get(PARAM_KEYS.filterProvider) || DEFAULTS.filterProvider,
      filterService: searchParams.get(PARAM_KEYS.filterService) || DEFAULTS.filterService,
      filterChannel: searchParams.get(PARAM_KEYS.filterChannel) || DEFAULTS.filterChannel,
      filterCategory: searchParams.get(PARAM_KEYS.filterCategory) || DEFAULTS.filterCategory,
      viewMode,
      sortConfig: parseSortParam(searchParams.get(PARAM_KEYS.sort)),
    };
  }, [searchParams]);

  // 更新单个参数的通用函数
  const updateParam = useCallback((key: string, value: string, defaultValue: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === defaultValue) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // 各个状态的 setter
  const setTimeRange = useCallback((value: string) => {
    updateParam(PARAM_KEYS.timeRange, value, DEFAULTS.timeRange);
  }, [updateParam]);

  const setFilterProvider = useCallback((value: string) => {
    updateParam(PARAM_KEYS.filterProvider, value, DEFAULTS.filterProvider);
  }, [updateParam]);

  const setFilterService = useCallback((value: string) => {
    updateParam(PARAM_KEYS.filterService, value, DEFAULTS.filterService);
  }, [updateParam]);

  const setFilterChannel = useCallback((value: string) => {
    updateParam(PARAM_KEYS.filterChannel, value, DEFAULTS.filterChannel);
  }, [updateParam]);

  const setFilterCategory = useCallback((value: string) => {
    updateParam(PARAM_KEYS.filterCategory, value, DEFAULTS.filterCategory);
  }, [updateParam]);

  const setViewMode = useCallback((value: ViewMode) => {
    updateParam(PARAM_KEYS.viewMode, value, DEFAULTS.viewMode);
  }, [updateParam]);

  const setSortConfig = useCallback((config: SortConfig) => {
    const serialized = serializeSortConfig(config);
    const defaultSerialized = serializeSortConfig({ key: DEFAULTS.sortKey, direction: DEFAULTS.sortDirection });
    updateParam(PARAM_KEYS.sort, serialized, defaultSerialized);
  }, [updateParam]);

  const actions: UrlStateActions = {
    setTimeRange,
    setFilterProvider,
    setFilterService,
    setFilterChannel,
    setFilterCategory,
    setViewMode,
    setSortConfig,
  };

  return [state, actions];
}
