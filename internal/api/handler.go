package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/singleflight"

	"monitor/internal/config"
	"monitor/internal/storage"
)

// statusCache API 响应缓存，防止高频查询打爆数据库
type statusCache struct {
	mu       sync.RWMutex
	entries  map[string]*cacheEntry
	ttl      time.Duration
	maxSize  int                // 最大缓存条目数，防止内存泄漏
	sf       singleflight.Group // 防止缓存击穿
}

type cacheEntry struct {
	data     []byte
	expireAt time.Time
}

func newStatusCache(ttl time.Duration, maxSize int) *statusCache {
	return &statusCache{
		entries: make(map[string]*cacheEntry),
		ttl:     ttl,
		maxSize: maxSize,
	}
}

// get 获取缓存，过期则删除并返回 miss
func (c *statusCache) get(key string) ([]byte, bool) {
	now := time.Now()
	c.mu.RLock()
	entry := c.entries[key]
	c.mu.RUnlock()

	if entry == nil {
		return nil, false
	}

	if now.After(entry.expireAt) {
		// 懒清理：删除过期 key
		c.mu.Lock()
		if cur := c.entries[key]; cur == entry {
			delete(c.entries, key)
		}
		c.mu.Unlock()
		return nil, false
	}

	return entry.data, true
}

// set 存入缓存（拷贝数据，防止 buffer 复用问题）
func (c *statusCache) set(key string, data []byte) {
	buf := make([]byte, len(data))
	copy(buf, data)

	now := time.Now()
	c.mu.Lock()
	defer c.mu.Unlock()

	// 容量限制：超出时清理过期条目
	if len(c.entries) >= c.maxSize {
		for k, v := range c.entries {
			if now.After(v.expireAt) {
				delete(c.entries, k)
			}
		}
	}

	// 仍然超出则跳过写入（防止 DoS）
	if len(c.entries) >= c.maxSize {
		return
	}

	c.entries[key] = &cacheEntry{
		data:     buf,
		expireAt: now.Add(c.ttl),
	}
}

// load 获取缓存，未命中时用 singleflight 合并并发请求
func (c *statusCache) load(key string, loader func() ([]byte, error)) ([]byte, error) {
	// 先检查缓存
	if data, ok := c.get(key); ok {
		return data, nil
	}

	// singleflight: 同 key 多请求只执行一次 loader
	v, err, _ := c.sf.Do(key, func() (interface{}, error) {
		// double check：可能在等待期间已被其他 goroutine 填充
		if data, ok := c.get(key); ok {
			return data, nil
		}

		fresh, err := loader()
		if err != nil {
			return nil, err // 错误不缓存
		}

		c.set(key, fresh)
		return fresh, nil
	})

	if err != nil {
		return nil, err
	}
	return v.([]byte), nil
}

// Handler API处理器
type Handler struct {
	storage storage.Storage
	config  *config.AppConfig
	cfgMu   sync.RWMutex   // 保护config的并发访问
	cache   *statusCache   // API 响应缓存
}

// NewHandler 创建处理器
func NewHandler(store storage.Storage, cfg *config.AppConfig) *Handler {
	return &Handler{
		storage: store,
		config:  cfg,
		cache:   newStatusCache(30*time.Second, 100), // 30 秒缓存，最多 100 条
	}
}

// CurrentStatus API返回的当前状态（不暴露数据库主键）
type CurrentStatus struct {
	Status    int   `json:"status"`
	Latency   int   `json:"latency"`
	Timestamp int64 `json:"timestamp"`
}

// MonitorResult API返回结构
type MonitorResult struct {
	Provider     string              `json:"provider"`
	ProviderSlug string              `json:"provider_slug"` // URL slug（用于生成专属页面链接）
	ProviderURL  string              `json:"provider_url"`  // 服务商官网链接
	Service      string              `json:"service"`
	Category    string              `json:"category"` // 分类：commercial（推广站）或 public（公益站）
	Sponsor     string              `json:"sponsor"`  // 赞助者
	SponsorURL  string              `json:"sponsor_url"` // 赞助者链接
	Channel     string              `json:"channel"`  // 业务通道标识
	Current     *CurrentStatus      `json:"current_status"`
	Timeline    []storage.TimePoint `json:"timeline"`
}

// GetStatus 获取监控状态
func (h *Handler) GetStatus(c *gin.Context) {
	// 参数解析
	period := c.DefaultQuery("period", "24h")
	qProvider := strings.ToLower(strings.TrimSpace(c.DefaultQuery("provider", "all")))
	qService := c.DefaultQuery("service", "all")

	// 验证 period 参数
	if _, err := h.parsePeriod(period); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("无效的时间范围: %s", period),
		})
		return
	}

	// 构建缓存 key（使用明确的分隔符避免碰撞）
	cacheKey := fmt.Sprintf("p=%s|prov=%s|svc=%s", period, qProvider, qService)

	// 使用缓存（singleflight 防止缓存击穿）
	// 注意：使用独立 context，避免单个请求取消影响其他等待的请求
	data, err := h.cache.load(cacheKey, func() ([]byte, error) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		return h.queryAndSerialize(ctx, period, qProvider, qService)
	})

	if err != nil {
		log.Printf("[API] GetStatus 失败 key=%s error=%v", cacheKey, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("查询失败: %v", err),
		})
		return
	}

	// CDN 缓存头：Cloudflare 遵守 s-maxage，浏览器遵守 max-age
	c.Header("Cache-Control", "public, max-age=60, s-maxage=60")
	c.Header("Content-Type", "application/json; charset=utf-8")
	c.Writer.Write(data)
}

// queryAndSerialize 查询数据库并序列化为 JSON（缓存 miss 时调用）
func (h *Handler) queryAndSerialize(ctx context.Context, period, qProvider, qService string) ([]byte, error) {
	since, _ := h.parsePeriod(period) // 已在调用前验证

	// 获取配置副本（线程安全）
	h.cfgMu.RLock()
	monitors := h.config.Monitors
	degradedWeight := h.config.DegradedWeight
	enableConcurrent := h.config.EnableConcurrentQuery
	concurrentLimit := h.config.ConcurrentQueryLimit
	slowLatencyMs := int(h.config.SlowLatencyDuration / time.Millisecond)
	h.cfgMu.RUnlock()

	// 构建 slug -> provider 映射（slug作为provider的路由别名）
	slugToProvider := make(map[string]string)
	for _, task := range monitors {
		normalizedProvider := strings.ToLower(strings.TrimSpace(task.Provider))
		slugToProvider[task.ProviderSlug] = normalizedProvider
	}

	// 将查询参数（可能是slug或provider）映射回真实的provider
	realProvider := qProvider
	if mappedProvider, exists := slugToProvider[qProvider]; exists {
		realProvider = mappedProvider
	}

	// 过滤并去重监控项
	filtered := h.filterMonitors(monitors, realProvider, qService)

	// 根据配置选择串行或并发查询
	var response []MonitorResult
	var err error
	var mode string

	if enableConcurrent {
		mode = "concurrent"
		response, err = h.getStatusConcurrent(ctx, filtered, since, period, degradedWeight, concurrentLimit)
	} else {
		mode = "serial"
		response, err = h.getStatusSerial(ctx, filtered, since, period, degradedWeight)
	}

	if err != nil {
		return nil, err
	}

	log.Printf("[API] GetStatus 查询 mode=%s monitors=%d period=%s count=%d", mode, len(filtered), period, len(response))

	// 序列化为 JSON
	result := gin.H{
		"meta": gin.H{
			"period":          period,
			"count":           len(response),
			"slow_latency_ms": slowLatencyMs,
		},
		"data": response,
	}

	return json.Marshal(result)
}

// filterMonitors 过滤并去重监控项
func (h *Handler) filterMonitors(monitors []config.ServiceConfig, provider, service string) []config.ServiceConfig {
	var filtered []config.ServiceConfig
	seen := make(map[string]bool)

	for _, task := range monitors {
		normalizedTaskProvider := strings.ToLower(strings.TrimSpace(task.Provider))

		// 过滤（统一使用 provider 名称匹配）
		if provider != "all" && provider != normalizedTaskProvider {
			continue
		}
		if service != "all" && service != task.Service {
			continue
		}

		// 去重（使用 provider + service + channel 组合）
		key := task.Provider + "/" + task.Service + "/" + task.Channel
		if seen[key] {
			continue
		}
		seen[key] = true

		filtered = append(filtered, task)
	}

	return filtered
}

// getStatusSerial 串行查询（原有逻辑）
func (h *Handler) getStatusSerial(ctx context.Context, monitors []config.ServiceConfig, since time.Time, period string, degradedWeight float64) ([]MonitorResult, error) {
	var response []MonitorResult
	store := h.storage.WithContext(ctx)

	for _, task := range monitors {
		// 获取最新记录
		latest, err := store.GetLatest(task.Provider, task.Service, task.Channel)
		if err != nil {
			return nil, fmt.Errorf("查询失败 %s/%s/%s: %w", task.Provider, task.Service, task.Channel, err)
		}

		// 获取历史记录
		history, err := store.GetHistory(task.Provider, task.Service, task.Channel, since)
		if err != nil {
			return nil, fmt.Errorf("查询历史失败 %s/%s/%s: %w", task.Provider, task.Service, task.Channel, err)
		}

		// 构建响应
		result := h.buildMonitorResult(task, latest, history, period, degradedWeight)
		response = append(response, result)
	}

	return response, nil
}

// getStatusConcurrent 并发查询（使用 errgroup + 并发限制）
func (h *Handler) getStatusConcurrent(ctx context.Context, monitors []config.ServiceConfig, since time.Time, period string, degradedWeight float64, limit int) ([]MonitorResult, error) {
	// 使用请求的 context（支持取消）
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(limit) // 限制最大并发度
	store := h.storage.WithContext(gctx)

	// 预分配结果数组（保持顺序）
	results := make([]MonitorResult, len(monitors))

	for i, task := range monitors {
		i, task := i, task // 捕获循环变量
		g.Go(func() error {
			// 获取最新记录
			latest, err := store.GetLatest(task.Provider, task.Service, task.Channel)
			if err != nil {
				return fmt.Errorf("GetLatest %s/%s/%s: %w", task.Provider, task.Service, task.Channel, err)
			}

			// 获取历史记录
			history, err := store.GetHistory(task.Provider, task.Service, task.Channel, since)
			if err != nil {
				return fmt.Errorf("GetHistory %s/%s/%s: %w", task.Provider, task.Service, task.Channel, err)
			}

			// 构建响应（固定位置写入，保持顺序）
			results[i] = h.buildMonitorResult(task, latest, history, period, degradedWeight)
			return nil
		})
	}

	// 等待所有 goroutine 完成
	if err := g.Wait(); err != nil {
		return nil, err
	}

	return results, nil
}

// buildMonitorResult 构建单个监控项的响应结构
func (h *Handler) buildMonitorResult(task config.ServiceConfig, latest *storage.ProbeRecord, history []*storage.ProbeRecord, period string, degradedWeight float64) MonitorResult {
	// 转换为时间轴数据
	timeline := h.buildTimeline(history, period, degradedWeight)

	// 转换为API响应格式（不暴露数据库主键）
	var current *CurrentStatus
	if latest != nil {
		current = &CurrentStatus{
			Status:    latest.Status,
			Latency:   latest.Latency,
			Timestamp: latest.Timestamp,
		}
	}

	// 生成 slug：优先使用配置的 provider_slug，回退到 provider 小写
	slug := task.ProviderSlug
	if slug == "" {
		slug = strings.ToLower(strings.TrimSpace(task.Provider))
	}

	return MonitorResult{
		Provider:     task.Provider,
		ProviderSlug: slug,
		ProviderURL:  task.ProviderURL,
		Service:      task.Service,
		Category:     task.Category,
		Sponsor:      task.Sponsor,
		SponsorURL:   task.SponsorURL,
		Channel:      task.Channel,
		Current:      current,
		Timeline:     timeline,
	}
}

// parsePeriod 解析时间范围
func (h *Handler) parsePeriod(period string) (time.Time, error) {
	now := time.Now()

	switch period {
	case "24h", "1d":
		return now.Add(-24 * time.Hour), nil
	case "7d":
		return now.AddDate(0, 0, -7), nil
	case "30d":
		return now.AddDate(0, 0, -30), nil
	default:
		return time.Time{}, fmt.Errorf("不支持的时间范围")
	}
}

// bucketStats 用于聚合每个 bucket 内的探测数据
type bucketStats struct {
	total           int                  // 总探测次数
	weightedSuccess float64              // 累积成功权重（绿=1.0, 黄=degraded_weight, 红=0.0）
	latencySum      int64                // 延迟总和（仅统计可用状态）
	latencyCount    int                  // 有效延迟计数（仅 status > 0 的记录）
	last            *storage.ProbeRecord // 最新一条记录
	statusCounts    storage.StatusCounts // 各状态计数
}

// buildTimeline 构建固定长度的时间轴，计算每个 bucket 的可用率和平均延迟
func (h *Handler) buildTimeline(records []*storage.ProbeRecord, period string, degradedWeight float64) []storage.TimePoint {
	// 根据 period 确定 bucket 策略
	bucketCount, bucketWindow, format := h.determineBucketStrategy(period)

	now := time.Now()

	// 初始化 buckets 和统计数据
	buckets := make([]storage.TimePoint, bucketCount)
	stats := make([]bucketStats, bucketCount)

	for i := 0; i < bucketCount; i++ {
		bucketTime := now.Add(-time.Duration(bucketCount-i) * bucketWindow)
		buckets[i] = storage.TimePoint{
			Time:         bucketTime.Format(format),
			Timestamp:    bucketTime.Unix(),
			Status:       -1,  // 缺失标记
			Latency:      0,
			Availability: -1,  // 缺失标记
		}
	}

	// 聚合每个 bucket 的探测结果
	for _, record := range records {
		t := time.Unix(record.Timestamp, 0)
		timeDiff := now.Sub(t)

		// 计算该记录属于哪个 bucket（从后往前）
		bucketIndex := int(timeDiff / bucketWindow)
		if bucketIndex < 0 {
			bucketIndex = 0
		}
		if bucketIndex >= bucketCount {
			continue // 超出范围，忽略
		}

		// 从前往后的索引
		actualIndex := bucketCount - 1 - bucketIndex
		if actualIndex < 0 || actualIndex >= bucketCount {
			continue
		}

		// 聚合统计
		stat := &stats[actualIndex]
		stat.total++
		stat.weightedSuccess += availabilityWeight(record.Status, degradedWeight)
		// 只统计可用状态（status > 0）的延迟
		if record.Status > 0 {
			stat.latencySum += int64(record.Latency)
			stat.latencyCount++
		}
		incrementStatusCount(&stat.statusCounts, record.Status, record.SubStatus)

		// 保留最新记录
		if stat.last == nil || record.Timestamp > stat.last.Timestamp {
			stat.last = record
		}
	}

	// 根据聚合结果计算可用率和平均延迟
	for i := 0; i < bucketCount; i++ {
		stat := &stats[i]
		buckets[i].StatusCounts = stat.statusCounts
		if stat.total == 0 {
			continue
		}

		// 计算可用率（使用权重）
		buckets[i].Availability = (stat.weightedSuccess / float64(stat.total)) * 100

		// 计算平均延迟（仅统计可用状态，四舍五入）
		if stat.latencyCount > 0 {
			avgLatency := float64(stat.latencySum) / float64(stat.latencyCount)
			buckets[i].Latency = int(avgLatency + 0.5)
		}

		// 使用最新记录的状态和时间
		if stat.last != nil {
			buckets[i].Status = stat.last.Status
			buckets[i].Timestamp = stat.last.Timestamp
			buckets[i].Time = time.Unix(stat.last.Timestamp, 0).Format(format)
		}
	}

	return buckets
}

// determineBucketStrategy 根据 period 确定 bucket 数量、窗口大小和时间格式
func (h *Handler) determineBucketStrategy(period string) (count int, window time.Duration, format string) {
	switch period {
	case "24h", "1d":
		return 24, time.Hour, "15:04"
	case "7d":
		return 7, 24 * time.Hour, "2006-01-02"
	case "30d":
		return 30, 24 * time.Hour, "2006-01-02"
	default:
		return 24, time.Hour, "15:04"
	}
}

// UpdateConfig 更新配置（热更新时调用）
func (h *Handler) UpdateConfig(cfg *config.AppConfig) {
	h.cfgMu.Lock()
	h.config = cfg
	h.cfgMu.Unlock()
}

// availabilityWeight 根据状态码返回可用率权重
func availabilityWeight(status int, degradedWeight float64) float64 {
	switch status {
	case 1: // 绿色（正常）
		return 1.0
	case 2: // 黄色（降级：如慢响应等）
		return degradedWeight
	default: // 红色（不可用）或灰色（未配置）
		return 0.0
	}
}

// incrementStatusCount 统计每种状态及细分出现次数
func incrementStatusCount(counts *storage.StatusCounts, status int, subStatus storage.SubStatus) {
	switch status {
	case 1: // 绿色
		counts.Available++
	case 2: // 黄色
		counts.Degraded++
		// 黄色细分
		switch subStatus {
		case storage.SubStatusSlowLatency:
			counts.SlowLatency++
		case storage.SubStatusRateLimit:
			counts.RateLimit++
		}
	case 0: // 红色
		counts.Unavailable++
		// 红色细分
		switch subStatus {
		case storage.SubStatusRateLimit:
			// 限流现在视为红色不可用，但沿用 rate_limit 细分计数
			counts.RateLimit++
		case storage.SubStatusServerError:
			counts.ServerError++
		case storage.SubStatusClientError:
			counts.ClientError++
		case storage.SubStatusAuthError:
			counts.AuthError++
		case storage.SubStatusInvalidRequest:
			counts.InvalidRequest++
		case storage.SubStatusNetworkError:
			counts.NetworkError++
		case storage.SubStatusContentMismatch:
			counts.ContentMismatch++
		}
	default: // 灰色（3）或其他
		counts.Missing++
	}
}

// GetSitemap 生成 sitemap.xml
func (h *Handler) GetSitemap(c *gin.Context) {
	// 获取配置副本
	h.cfgMu.RLock()
	monitors := h.config.Monitors
	h.cfgMu.RUnlock()

	// 提取唯一的 provider slugs
	providerSlugs := h.extractUniqueProviderSlugs(monitors)

	// 构建 sitemap XML
	sitemap := h.buildSitemapXML(providerSlugs)

	c.Header("Content-Type", "application/xml; charset=utf-8")
	c.Header("Cache-Control", "public, max-age=3600") // 缓存 1 小时
	c.String(http.StatusOK, sitemap)
}

// extractUniqueProviderSlugs 从监控配置中提取唯一的 provider slugs
func (h *Handler) extractUniqueProviderSlugs(monitors []config.ServiceConfig) []string {
	slugSet := make(map[string]bool)
	var slugs []string

	for _, task := range monitors {
		slug := task.ProviderSlug
		if slug == "" {
			slug = strings.ToLower(strings.TrimSpace(task.Provider))
		}

		if !slugSet[slug] {
			slugSet[slug] = true
			slugs = append(slugs, slug)
		}
	}

	return slugs
}

// buildSitemapXML 构建 sitemap.xml 内容
func (h *Handler) buildSitemapXML(providerSlugs []string) string {
	h.cfgMu.RLock()
	baseURL := h.config.PublicBaseURL
	h.cfgMu.RUnlock()
	languages := []struct {
		code string // hreflang 语言码
		path string // URL 路径前缀
	}{
		{"zh-Hans", ""},   // 中文默认无前缀
		{"en", "en"},      // 英文
		{"ru", "ru"},      // 俄文
		{"ja", "ja"},      // 日文
	}

	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8"?>`)
	sb.WriteString("\n")
	sb.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`)
	sb.WriteString("\n")
	sb.WriteString(`        xmlns:xhtml="http://www.w3.org/1999/xhtml">`)
	sb.WriteString("\n")

	// 生成首页 URL（4 个语言版本）
	for _, lang := range languages {
		sb.WriteString("  <url>\n")

		// 生成 loc
		if lang.path == "" {
			sb.WriteString(fmt.Sprintf("    <loc>%s/</loc>\n", baseURL))
		} else {
			sb.WriteString(fmt.Sprintf("    <loc>%s/%s/</loc>\n", baseURL, lang.path))
		}

		// 生成 hreflang 链接（指向所有语言版本）
		for _, altLang := range languages {
			var href string
			if altLang.path == "" {
				href = fmt.Sprintf("%s/", baseURL)
			} else {
				href = fmt.Sprintf("%s/%s/", baseURL, altLang.path)
			}
			sb.WriteString(fmt.Sprintf(`    <xhtml:link rel="alternate" hreflang="%s" href="%s"/>`+"\n", altLang.code, href))
		}

		// x-default 指向中文首页
		sb.WriteString(fmt.Sprintf(`    <xhtml:link rel="alternate" hreflang="x-default" href="%s/"/>`+"\n", baseURL))

		sb.WriteString("    <priority>1.0</priority>\n")
		sb.WriteString("    <changefreq>daily</changefreq>\n")
		sb.WriteString("  </url>\n")
	}

	// 生成服务商页面 URL（每个 provider 4 个语言版本）
	for _, slug := range providerSlugs {
		for _, lang := range languages {
			sb.WriteString("  <url>\n")

			// 生成 loc
			if lang.path == "" {
				sb.WriteString(fmt.Sprintf("    <loc>%s/p/%s</loc>\n", baseURL, slug))
			} else {
				sb.WriteString(fmt.Sprintf("    <loc>%s/%s/p/%s</loc>\n", baseURL, lang.path, slug))
			}

			// 生成 hreflang 链接（指向所有语言版本）
			for _, altLang := range languages {
				var href string
				if altLang.path == "" {
					href = fmt.Sprintf("%s/p/%s", baseURL, slug)
				} else {
					href = fmt.Sprintf("%s/%s/p/%s", baseURL, altLang.path, slug)
				}
				sb.WriteString(fmt.Sprintf(`    <xhtml:link rel="alternate" hreflang="%s" href="%s"/>`+"\n", altLang.code, href))
			}

			// x-default 指向中文版本
			sb.WriteString(fmt.Sprintf(`    <xhtml:link rel="alternate" hreflang="x-default" href="%s/p/%s"/>`+"\n", baseURL, slug))

			sb.WriteString("    <priority>0.8</priority>\n")
			sb.WriteString("    <changefreq>daily</changefreq>\n")
			sb.WriteString("  </url>\n")
		}
	}

	sb.WriteString("</urlset>\n")
	return sb.String()
}

// GetRobots 生成 robots.txt
func (h *Handler) GetRobots(c *gin.Context) {
	h.cfgMu.RLock()
	baseURL := h.config.PublicBaseURL
	h.cfgMu.RUnlock()

	robotsTxt := fmt.Sprintf(`User-agent: *
Allow: /
Disallow: /api/

Sitemap: %s/sitemap.xml
`, baseURL)

	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.Header("Cache-Control", "public, max-age=86400") // 缓存 24 小时
	c.String(http.StatusOK, robotsTxt)
}
