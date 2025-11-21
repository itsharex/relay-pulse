/**
 * Google Analytics 工具类
 * 用于追踪页面浏览、用户交互、性能指标和错误事件
 */

declare global {
  interface Window {
    gtag?: (
      command: string,
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void;
    GA_MEASUREMENT_ID?: string;
  }
}

/**
 * 检查 GA 是否已初始化
 */
function isGAEnabled(): boolean {
  return typeof window.gtag === 'function' && !!window.GA_MEASUREMENT_ID;
}

/**
 * 追踪自定义事件
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): void {
  if (!isGAEnabled()) return;

  window.gtag!('event', eventName, params);
}

/**
 * 追踪时间范围切换事件
 */
export function trackPeriodChange(period: string): void {
  trackEvent('change_time_range', {
    period,
  });
}

/**
 * 追踪服务筛选事件
 */
export function trackServiceFilter(provider?: string, service?: string): void {
  trackEvent('filter_service', {
    provider: provider || 'all',
    service: service || 'all',
  });
}

/**
 * 追踪查看服务详情事件
 */
export function trackViewServiceDetail(provider: string, service: string): void {
  trackEvent('view_service_detail', {
    provider,
    service,
  });
}

/**
 * 追踪 API 请求性能
 */
export function trackAPIPerformance(
  endpoint: string,
  duration: number,
  success: boolean
): void {
  trackEvent('api_request', {
    endpoint,
    duration,
    success,
  });
}

/**
 * 追踪 API 错误
 */
export function trackAPIError(
  endpoint: string,
  errorType: string,
  errorMessage?: string
): void {
  trackEvent('api_error', {
    endpoint,
    error_type: errorType,
    error_message: errorMessage || 'Unknown error',
  });
}

/**
 * 追踪前端错误
 */
export function trackFrontendError(
  errorType: string,
  errorMessage: string,
  componentStack?: string
): void {
  trackEvent('frontend_error', {
    error_type: errorType,
    error_message: errorMessage,
    component_stack: componentStack || 'N/A',
  });
}

/**
 * 追踪用户交互时长
 */
export function trackEngagementTime(seconds: number): void {
  if (!isGAEnabled()) return;

  window.gtag!('event', 'user_engagement', {
    engagement_time_msec: seconds * 1000,
  });
}
