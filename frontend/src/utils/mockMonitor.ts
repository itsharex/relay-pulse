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

      PROVIDERS.forEach((provider, providerIndex) => {
        provider.services.forEach((service) => {
          // 生成历史数据点
          const history = Array.from({ length: count }).map((_, index) => {
            const rand = Math.random();
            let statusKey: StatusKey = 'AVAILABLE';

            // 与 docs/front.jsx 完全一致的状态分配逻辑，并添加缺失数据
            if (rand > 0.98) statusKey = 'MISSING';        // 2% 概率缺失
            else if (rand > 0.95) statusKey = 'UNAVAILABLE';  // 3% 概率不可用
            else if (rand > 0.85) statusKey = 'DEGRADED';     // 10% 概率降级

            // 生成模拟延迟（缺失数据延迟为0）
            const latency = statusKey === 'MISSING' ? 0 : 180 + Math.floor(Math.random() * 220);

            const timestampMs = Date.now() - (count - index) * (rangeConfig.unit === 'hour' ? 3600000 : 86400000);

            return {
              index,
              status: statusKey,
              timestamp: new Date(timestampMs).toISOString(),
              timestampNum: Math.floor(timestampMs / 1000),  // Unix 时间戳（秒）
              latency
            };
          });

          const currentStatus = history[history.length - 1].status;

          // 计算可用率（MISSING按50%权重计入）
          const uptimeScore = history.reduce((acc, point) => {
            if (point.status === 'AVAILABLE') return acc + 1;      // 100%
            if (point.status === 'MISSING') return acc + 0.5;      // 50%
            return acc;                                             // 0%
          }, 0);
          const uptime = history.length > 0
            ? parseFloat((uptimeScore / history.length * 100).toFixed(1))
            : 0;

          // 模拟通道名（按照 provider 分配）
          const channels = ['vip-channel', 'standard-channel', 'test-channel'];
          const channel = channels[providerIndex % channels.length];

          // 模拟分类和赞助者
          const categories: Array<'commercial' | 'public'> = ['commercial', 'public'];
          const category = categories[providerIndex % 2];
          const sponsors = ['团队自有', '社区赞助', 'duckcoding官方', '示例数据'];
          const sponsor = sponsors[providerIndex % sponsors.length];

          // 最后一次检测信息
          const lastCheckTimestamp = Math.floor(Date.now() / 1000);
          const lastCheckLatency = 180 + Math.floor(Math.random() * 220);

          data.push({
            id: `${provider.id}-${service}`,
            providerId: provider.id,
            providerName: provider.name,
            serviceType: service,
            category,
            sponsor,
            channel,
            history,
            currentStatus,
            uptime,
            lastCheckTimestamp,
            lastCheckLatency
          });
        });
      });

      resolve(data);
    }, 600); // 与 docs/front.jsx 一致的延迟时间
  });
}
