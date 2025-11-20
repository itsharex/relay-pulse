import { useState, useEffect, useMemo } from 'react';
import type {
  ApiResponse,
  ProcessedMonitorData,
  SortConfig,
  StatusKey,
} from '../types';
import { API_BASE_URL, STATUS, USE_MOCK_DATA } from '../constants';
import { fetchMockMonitorData } from '../utils/mockMonitor';

// 导入 STATUS_MAP
const statusMap: Record<number, StatusKey> = {
  1: 'AVAILABLE',
  2: 'DEGRADED',
  0: 'UNAVAILABLE',
};

interface UseMonitorDataOptions {
  timeRange: string;
  filterService: string;
  filterProvider: string;
  sortConfig: SortConfig;
}

export function useMonitorData({
  timeRange,
  filterService,
  filterProvider,
  sortConfig,
}: UseMonitorDataOptions) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<ProcessedMonitorData[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  // 数据获取 - 支持双模式（Mock / API）
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        let processed: ProcessedMonitorData[];

        if (USE_MOCK_DATA) {
          // 使用模拟数据 - 完全复刻 docs/front.jsx
          processed = await fetchMockMonitorData(timeRange);
        } else {
          // 使用真实 API
          const url = `${API_BASE_URL}/api/status?period=${timeRange}`;
          const response = await fetch(url);

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const json: ApiResponse = await response.json();

          // 转换为前端数据格式
          processed = json.data.map((item) => {
            const history = item.timeline.map((point, index) => ({
              index,
              status: statusMap[point.status] || 'UNAVAILABLE',
              timestamp: point.time,
              latency: point.latency,
            }));

            const currentStatus = item.current_status
              ? statusMap[item.current_status.status] || 'UNAVAILABLE'
              : 'UNAVAILABLE';

            // 计算可用率
            const availableCount = history.filter((h) => h.status === 'AVAILABLE').length;
            const uptime = parseFloat(((availableCount / history.length) * 100).toFixed(1));

            return {
              id: `${item.provider}-${item.service}`,
              providerId: item.provider,
              providerName: item.provider,
              serviceType: item.service,
              history,
              currentStatus,
              uptime,
            };
          });
        }

        // 防止组件卸载后的状态更新
        if (!isMounted) return;
        setRawData(processed);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
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

  // 数据过滤和排序
  const processedData = useMemo(() => {
    const filtered = rawData.filter((item) => {
      const matchService = filterService === 'all' || item.serviceType === filterService;
      const matchProvider = filterProvider === 'all' || item.providerId === filterProvider;
      return matchService && matchProvider;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue: number | string = a[sortConfig.key as keyof ProcessedMonitorData] as number | string;
        let bValue: number | string = b[sortConfig.key as keyof ProcessedMonitorData] as number | string;

        if (sortConfig.key === 'currentStatus') {
          aValue = STATUS[a.currentStatus].weight;
          bValue = STATUS[b.currentStatus].weight;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [rawData, filterService, filterProvider, sortConfig]);

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
    refetch: () => {
      // 真正触发重新获取 - 修复刷新按钮无效的问题
      // 保持旧数据可见，直到新数据到来（与 docs/front.jsx 一致）
      setLoading(true);
      setReloadToken((token) => token + 1);
    },
  };
}
