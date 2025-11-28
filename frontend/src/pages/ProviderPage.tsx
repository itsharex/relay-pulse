import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useMonitorData } from '../hooks/useMonitorData';
import { Header } from '../components/Header';
import { Controls } from '../components/Controls';
import { StatusTable } from '../components/StatusTable';
import { StatusCard } from '../components/StatusCard';
import { Tooltip } from '../components/Tooltip';
import { Footer } from '../components/Footer';
import type { ViewMode, SortConfig, TooltipState, ProcessedMonitorData } from '../types';

// Provider 名称规范化（小写、去空格）
function canonicalize(value?: string): string {
  return value?.trim().toLowerCase() ?? '';
}

/**
 * 服务商专属页面
 * URL: /p/:provider
 * 支持嵌入模式: ?embed=1
 */
export default function ProviderPage() {
  const { provider } = useParams<{ provider: string }>();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();

  // 嵌入模式检测
  const isEmbedMode = searchParams.get('embed') === '1';

  // 规范化 provider slug
  const normalizedProvider = canonicalize(provider);

  // 状态管理
  const [timeRange, setTimeRange] = useState('24h');
  const [filterService, setFilterService] = useState('all');
  const [filterChannel, setFilterChannel] = useState('all');
  // filterCategory 在 Provider 页面固定为 'all'，不需要状态
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'uptime',
    direction: 'desc',
  });
  const [tooltip, setTooltip] = useState<TooltipState>({
    show: false,
    x: 0,
    y: 0,
    data: null,
  });

  // 数据获取 - 先获取全部数据用于构建映射
  const { data: allData, loading, error, stats, channels, refetch } = useMonitorData({
    timeRange,
    filterService,
    filterProvider: 'all', // 先获取全部数据
    filterChannel,
    filterCategory: 'all', // Provider页面不筛选分类，固定为all
    sortConfig,
  });

  // 构建 slug -> providerId 映射
  const slugToProviderId = new Map<string, string>();
  allData.forEach((item) => {
    slugToProviderId.set(item.providerSlug, item.providerId);
  });

  // 将 URL slug 映射回 providerId
  const realProviderId = slugToProviderId.get(normalizedProvider) || normalizedProvider;

  // 按 providerId 过滤数据
  const data = allData.filter((item) => item.providerId === realProviderId);

  // 过滤 channels：只显示当前 provider 的通道
  const providerChannels = channels.filter((channel) => {
    return allData.some(
      (item) => item.providerId === realProviderId && item.channel === channel
    );
  });

  // 软 404 处理：无数据时显示 404 页面
  if (!loading && data.length === 0) {
    return <ProviderNotFound providerSlug={provider || ''} isEmbedMode={isEmbedMode} />;
  }

  // 从数据中获取 provider 显示名称
  const providerDisplayName = data[0]?.providerName || provider || '';

  // Tooltip 处理
  const handleBlockHover = (
    e: React.MouseEvent<HTMLDivElement>,
    point: ProcessedMonitorData['history'][number]
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      show: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      data: point,
    });
  };

  const handleBlockLeave = () => {
    setTooltip((prev) => ({ ...prev, show: false }));
  };

  // 排序处理
  const handleSort = (key: string) => {
    setSortConfig((prevConfig) => ({
      key,
      direction:
        prevConfig.key === key && prevConfig.direction === 'asc'
          ? 'desc'
          : 'asc',
    }));
  };

  // 刷新处理
  const handleRefresh = () => {
    refetch();
  };

  return (
    <>
      <Helmet>
        <html lang={i18n.language} />
        <title>{t('provider.pageTitle', { name: providerDisplayName })}</title>
        <meta name="description" content={t('provider.pageDescription', { name: providerDisplayName })} />
      </Helmet>

      <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500 selection:text-white overflow-x-hidden">
        {/* 全局 Tooltip */}
        <Tooltip tooltip={tooltip} onClose={handleBlockLeave} />

        {/* 背景装饰 */}
        {!isEmbedMode && (
          <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[120px]" />
          </div>
        )}

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-4 sm:py-6 sm:px-6 lg:px-8">
        {/* 完整模式：显示 Header */}
        {!isEmbedMode && <Header stats={stats} />}

        {/* 控制面板 - 隐藏 provider 和 category 筛选器，只显示当前 provider 的通道 */}
        <Controls
          timeRange={timeRange}
          filterService={filterService}
          filterProvider="all"
          filterChannel={filterChannel}
          filterCategory="all"
          viewMode={viewMode}
          loading={loading}
          providers={[]} // 空数组 → 隐藏 provider 筛选器
          channels={providerChannels} // 只显示当前 provider 的通道
          showCategoryFilter={false} // 隐藏分类筛选器
          onTimeRangeChange={setTimeRange}
          onServiceChange={setFilterService}
          onProviderChange={() => {}} // 无操作
          onChannelChange={setFilterChannel}
          onCategoryChange={() => {}} // 无操作
          onViewModeChange={setViewMode}
          onRefresh={handleRefresh}
        />

        {/* 主内容区域 - 移除 py-6 以减小与控制面板的间距 */}
        <main>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-zinc-400">{t('common.loading')}</div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-12">
              <div className="text-red-400">{t('common.error')}: {error}</div>
            </div>
          )}

          {!loading && !error && data.length > 0 && (
            <>
              {viewMode === 'table' && (
                <StatusTable
                  data={data}
                  sortConfig={sortConfig}
                  timeRange={timeRange}
                  showCategoryTag={false}
                  onSort={handleSort}
                  onBlockHover={handleBlockHover}
                  onBlockLeave={handleBlockLeave}
                />
              )}

              {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {data.map((item) => (
                    <StatusCard
                      key={item.id}
                      item={item}
                      timeRange={timeRange}
                      showCategoryTag={false}
                      onBlockHover={handleBlockHover}
                      onBlockLeave={handleBlockLeave}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        {/* 完整模式：显示 Footer */}
        {!isEmbedMode && <Footer />}
        </div>
      </div>
    </>
  );
}

/**
 * 404 页面组件 - 服务商未找到
 */
interface ProviderNotFoundProps {
  providerSlug: string;
  isEmbedMode: boolean;
}

function ProviderNotFound({ providerSlug, isEmbedMode }: ProviderNotFoundProps) {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>{t('provider.notFoundTitle')}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className={`min-h-screen flex items-center justify-center ${isEmbedMode ? '' : 'bg-black'}`}>
        <div className="text-center px-4">
          <h1 className="text-6xl font-bold text-zinc-100 mb-4">404</h1>
          <p className="text-xl text-zinc-400 mb-8">
            {t('provider.notFoundMessage', { slug: providerSlug })}
          </p>
          {!isEmbedMode && (
            <a
              href="/"
              className="inline-block px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors"
            >
              {t('provider.backToHome')}
            </a>
          )}
        </div>
      </div>
    </>
  );
}
