import { useState, useEffect, useMemo } from 'react';
import i18n from '../i18n';
import type {
  ApiResponse,
  ProcessedMonitorData,
  SortConfig,
  StatusKey,
  StatusCounts,
  ProviderOption,
} from '../types';
import { API_BASE_URL, USE_MOCK_DATA } from '../constants';
import { fetchMockMonitorData } from '../utils/mockMonitor';
import { trackAPIPerformance, trackAPIError } from '../utils/analytics';
import { sortMonitors } from '../utils/sortMonitors';

// URL 二次校验函数
function validateUrl(url: string | undefined): string | null {
  if (!url || url.trim() === '') return null;
  try {
    new URL(url);
    return url;
  } catch {
    console.warn(`Invalid URL: ${url}`);
    return null;
  }
}

// Provider 名称标准化（用于筛选和去重）
function canonicalize(value?: string): string {
  return value?.trim().toLowerCase() ?? '';
}

// Provider 显示标签格式化（保留原始大小写，首字母大写）
function formatProviderLabel(value?: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return i18n.t('common.unknownProvider');
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// 导入 STATUS_MAP
const statusMap: Record<number, StatusKey> = {
  1: 'AVAILABLE',
  2: 'DEGRADED',
  0: 'UNAVAILABLE',
  3: 'MISSING',  // 未配置/认证失败
  '-1': 'MISSING',  // 缺失数据
};

// 映射状态计数，提供默认值以向后兼容
const mapStatusCounts = (counts?: StatusCounts): StatusCounts => ({
  available: counts?.available ?? 0,
  degraded: counts?.degraded ?? 0,
  unavailable: counts?.unavailable ?? 0,
  missing: counts?.missing ?? 0,
  slow_latency: counts?.slow_latency ?? 0,
  rate_limit: counts?.rate_limit ?? 0,
  server_error: counts?.server_error ?? 0,
  client_error: counts?.client_error ?? 0,
  auth_error: counts?.auth_error ?? 0,
  invalid_request: counts?.invalid_request ?? 0,
  network_error: counts?.network_error ?? 0,
  content_mismatch: counts?.content_mismatch ?? 0,
});

interface UseMonitorDataOptions {
  timeRange: string;
  filterService: string;
  filterProvider: string;
  filterChannel: string;
  filterCategory: string;
  sortConfig: SortConfig;
}

export function useMonitorData({
  timeRange,
  filterService,
  filterProvider,
  filterChannel,
  filterCategory,
  sortConfig,
}: UseMonitorDataOptions) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<ProcessedMonitorData[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const [slowLatencyMs, setSlowLatencyMs] = useState<number>(5000); // 默认 5 秒

  // 数据获取 - 支持双模式（Mock / API）
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      // 记录开始时间（在 try 外面，确保网络错误也能追踪性能）
      const startTime = USE_MOCK_DATA ? 0 : performance.now();

      try {
        let processed: ProcessedMonitorData[];

        if (USE_MOCK_DATA) {
          // 使用模拟数据 - 完全复刻 docs/front.jsx
          processed = await fetchMockMonitorData(timeRange);
        } else {
          // 使用真实 API
          const url = `${API_BASE_URL}/api/status?period=${timeRange}`;

          const response = await fetch(url);
          const duration = Math.round(performance.now() - startTime);

          if (!response.ok) {
            // 追踪 HTTP 错误（失败的性能和错误事件）
            trackAPIPerformance('/api/status', duration, false);
            trackAPIError('/api/status', `HTTP_${response.status}`, 'HTTP Error');
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const json: ApiResponse = await response.json();

          // 追踪成功的 API 性能
          trackAPIPerformance('/api/status', duration, true);

          // 提取慢延迟阈值（用于延迟颜色渐变）
          if (json.meta.slow_latency_ms && json.meta.slow_latency_ms > 0) {
            setSlowLatencyMs(json.meta.slow_latency_ms);
          }

          // 转换为前端数据格式
          processed = json.data.map((item) => {
            const history = item.timeline.map((point, index) => ({
              index,
              status: statusMap[point.status] || 'UNAVAILABLE',
              timestamp: point.time,
              timestampNum: point.timestamp,  // Unix 时间戳（秒）
              latency: point.latency,
              availability: point.availability,  // 可用率百分比
              statusCounts: mapStatusCounts(point.status_counts), // 映射状态计数
            }));

            const currentStatus = item.current_status
              ? statusMap[item.current_status.status] || 'UNAVAILABLE'
              : 'UNAVAILABLE';

            // 计算可用率：仅统计有数据的时间块
            // - 过滤掉 availability < 0 的无数据时间段
            // - 若所有时间块均无数据，返回 -1 由 UI 层展示为 "--"
            const validAvailabilityPoints = history.filter(point => point.availability >= 0);
            const uptime = validAvailabilityPoints.length > 0
              ? parseFloat((
                  validAvailabilityPoints.reduce((acc, point) => acc + point.availability, 0)
                  / validAvailabilityPoints.length
                ).toFixed(2))
              : -1;

            // 标准化 provider 名称
            const providerKey = canonicalize(item.provider);
            const providerLabel = formatProviderLabel(item.provider);

            return {
              id: `${providerKey || item.provider}-${item.service}-${item.channel || 'default'}`,
              providerId: providerKey || item.provider,  // 规范化的 ID（小写）
              providerSlug: item.provider_slug || canonicalize(item.provider), // URL slug
              providerName: providerLabel,  // 格式化的显示名称
              providerUrl: validateUrl(item.provider_url),
              serviceType: item.service,
              category: item.category,
              sponsor: item.sponsor,
              sponsorUrl: validateUrl(item.sponsor_url),
              channel: item.channel || undefined,
              history,
              currentStatus,
              uptime,
              lastCheckTimestamp: item.current_status?.timestamp,
              lastCheckLatency: item.current_status?.latency,
            };
          });
        }

        // 防止组件卸载后的状态更新
        if (!isMounted) return;
        setRawData(processed);
      } catch (err) {
        if (!isMounted) return;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);

        // 只追踪真正的网络错误（fetch 失败、连接超时等）
        // HTTP 错误已经在上面追踪过了，避免重复
        if (!USE_MOCK_DATA && !errorMessage.startsWith('HTTP error!')) {
          const duration = Math.round(performance.now() - startTime);
          // 追踪网络错误的性能和错误事件
          trackAPIPerformance('/api/status', duration, false);
          trackAPIError('/api/status', 'NETWORK_ERROR', 'Network failure');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [timeRange, reloadToken]);

  // 提取所有通道列表（去重并排序）
  const channels = useMemo(() => {
    const set = new Set<string>();
    rawData.forEach((item) => {
      if (item.channel) {
        set.add(item.channel);
      }
    });
    return Array.from(set).sort();
  }, [rawData]);

  // 提取所有服务商列表（去重并排序）
  // 返回 ProviderOption[] 格式，支持 label/value 分离
  const providers = useMemo<ProviderOption[]>(() => {
    const map = new Map<string, string>();  // value -> label
    rawData.forEach((item) => {
      if (item.providerId) {
        // 如果同一个 providerId 有多个 providerName，保留第一个
        if (!map.has(item.providerId)) {
          map.set(item.providerId, item.providerName);
        }
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'))  // 按 label 排序
      .map(([value, label]) => ({ value, label }));
  }, [rawData]);

  // 数据过滤和排序
  const processedData = useMemo(() => {
    const filtered = rawData.filter((item) => {
      const matchService = filterService === 'all' || item.serviceType === filterService;
      const matchProvider = filterProvider === 'all' || item.providerId === filterProvider;
      const matchChannel = filterChannel === 'all' || item.channel === filterChannel;
      const matchCategory = filterCategory === 'all' || item.category === filterCategory;
      return matchService && matchProvider && matchChannel && matchCategory;
    });

    return sortMonitors(filtered, sortConfig);
  }, [rawData, filterService, filterProvider, filterChannel, filterCategory, sortConfig]);

  // 统计数据
  const stats = useMemo(() => {
    const total = processedData.length;
    const healthy = processedData.filter((i) => i.currentStatus === 'AVAILABLE').length;
    const issues = total - healthy;
    return { total, healthy, issues };
  }, [processedData]);

  return {
    loading,
    error,
    data: processedData,
    stats,
    channels,
    providers,
    slowLatencyMs,
    refetch: () => {
      // 真正触发重新获取 - 修复刷新按钮无效的问题
      // 保持旧数据可见，直到新数据到来（与 docs/front.jsx 一致）
      setLoading(true);
      setReloadToken((token) => token + 1);
    },
  };
}
