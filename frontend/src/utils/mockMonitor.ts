import { PROVIDERS, TIME_RANGES } from '../constants';
import type { ProcessedMonitorData, StatusKey } from '../types';

/**
 * 模拟数据生成器 - 完全复刻 docs/front.jsx 的逻辑
 * 用于演示和本地开发
 */
export function fetchMockMonitorData(timeRangeId: string): Promise<ProcessedMonitorData[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // 默认使用 24h 范围，避免返回空数据
      const rangeConfig = TIME_RANGES.find(r => r.id === timeRangeId) || TIME_RANGES[0];
      if (!rangeConfig) {
        console.error(`Invalid timeRangeId: ${timeRangeId}, falling back to default`);
        resolve([]);
        return;
      }

      const count = rangeConfig.points;
      const data: ProcessedMonitorData[] = [];

      PROVIDERS.forEach(provider => {
        provider.services.forEach(service => {
          // 生成历史数据点
          const history = Array.from({ length: count }).map((_, index) => {
            const rand = Math.random();
            let statusKey: StatusKey = 'AVAILABLE';

            // 与 docs/front.jsx 完全一致的状态分配逻辑
            if (rand > 0.95) statusKey = 'UNAVAILABLE';
            else if (rand > 0.85) statusKey = 'DEGRADED';

            // 生成模拟延迟
            const latency = 180 + Math.floor(Math.random() * 220);

            return {
              index,
              status: statusKey,
              timestamp: new Date(
                Date.now() - (count - index) * (rangeConfig.unit === 'hour' ? 3600000 : 86400000)
              ).toISOString(),
              latency
            };
          });

          const currentStatus = history[history.length - 1].status;
          const uptime = parseFloat(
            (history.filter(h => h.status === 'AVAILABLE').length / count * 100).toFixed(1)
          );

          data.push({
            id: `${provider.id}-${service}`,
            providerId: provider.id,
            providerName: provider.name,
            serviceType: service,
            history,
            currentStatus,
            uptime
          });
        });
      });

      resolve(data);
    }, 600); // 与 docs/front.jsx 一致的延迟时间
  });
}
