// API 响应类型定义
export interface TimePoint {
  time: string;       // 格式化时间标签（如 "15:04" 或 "2006-01-02"）
  timestamp: number;  // Unix 时间戳（秒）
  status: number;     // 1=可用, 0=不可用, 2=波动, -1=缺失
  latency: number;    // 延迟(ms)
}

export interface CurrentStatus {
  status: number;
  latency: number;
  timestamp: number;
}

export interface MonitorResult {
  provider: string;
  service: string;
  category: 'commercial' | 'public';  // 分类：commercial（推广站）或 public（公益站）
  sponsor: string;                     // 赞助者
  channel: string;                     // 业务通道标识
  current_status: CurrentStatus | null;
  timeline: TimePoint[];
}

export interface ApiResponse {
  meta: {
    period: string;
    count: number;
  };
  data: MonitorResult[];
}

// 前端状态枚举
export type StatusKey = 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE' | 'MISSING';

export interface StatusConfig {
  color: string;
  text: string;
  glow: string;
  label: string;
  weight: number;
}

export const STATUS_MAP: Record<number, StatusKey> = {
  1: 'AVAILABLE',
  2: 'DEGRADED',
  0: 'UNAVAILABLE',
  '-1': 'MISSING',  // 缺失数据
};

// 处理后的数据类型
export interface ProcessedMonitorData {
  id: string;
  providerId: string;
  providerName: string;
  serviceType: string;
  category: 'commercial' | 'public';  // 分类
  sponsor: string;                     // 赞助者
  channel?: string;                    // 业务通道标识
  history: Array<{
    index: number;
    status: StatusKey;
    timestamp: string;
    timestampNum: number;     // Unix 时间戳（秒）
    latency: number;
  }>;
  currentStatus: StatusKey;
  uptime: number;             // 可用率百分比
  lastCheckTimestamp?: number; // 最后检测时间（Unix 时间戳，秒）
  lastCheckLatency?: number;   // 最后检测延迟（毫秒）
}

// 时间范围配置
export interface TimeRange {
  id: string;
  label: string;
  points: number;
  unit: 'hour' | 'day';
}

// 服务商配置
export interface Provider {
  id: string;
  name: string;
  services: string[];
}

// 排序配置
export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

// Tooltip 状态
export interface TooltipState {
  show: boolean;
  x: number;
  y: number;
  data: {
    index: number;
    status: StatusKey;
    timestamp: string;
    timestampNum: number;  // Unix 时间戳（秒）
    latency: number;
  } | null;
}

// 视图模式
export type ViewMode = 'table' | 'grid';
