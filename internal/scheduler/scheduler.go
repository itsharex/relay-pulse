package scheduler

import (
	"context"
	"math/rand"
	"sync"
	"time"

	"monitor/internal/config"
	"monitor/internal/logger"
	"monitor/internal/monitor"
	"monitor/internal/storage"
)

// Scheduler 调度器
type Scheduler struct {
	prober   *monitor.Prober
	interval time.Duration
	ticker   *time.Ticker
	running  bool
	mu       sync.Mutex

	// 配置引用（支持热更新）
	cfg   *config.AppConfig
	cfgMu sync.RWMutex

	// 防止重复触发
	checkInProgress bool
	checkMu         sync.Mutex

	// 保存context用于TriggerNow
	ctx context.Context
}

// NewScheduler 创建调度器
func NewScheduler(store storage.Storage, interval time.Duration) *Scheduler {
	return &Scheduler{
		prober:   monitor.NewProber(store),
		interval: interval,
	}
}

// Start 启动调度器
func (s *Scheduler) Start(ctx context.Context, cfg *config.AppConfig) {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return
	}
	s.running = true
	s.ticker = time.NewTicker(s.interval)
	s.ctx = ctx // 保存context用于TriggerNow

	// 保存初始配置
	s.cfgMu.Lock()
	s.cfg = cfg
	s.cfgMu.Unlock()
	s.mu.Unlock()

	// 立即执行一次（启动模式错峰，使用固定 2 秒间隔避免瞬时压力）
	go s.runChecks(ctx, true, true)

	// 定时执行
	go func() {
		for {
			select {
			case <-ctx.Done():
				logger.Info("scheduler", "调度器已停止")
				s.mu.Lock()
				s.ticker.Stop()
				s.running = false
				s.mu.Unlock()
				return

			case <-s.ticker.C:
				s.runChecks(ctx, true, false) // 周期性巡检启用错峰，非启动模式
			}
		}
	}()

	logger.Info("scheduler", "调度器已启动", "interval", s.interval)
}

// runChecks 执行所有检查（防重复）
// allowStagger 为 true 时，会在当前巡检周期内为不同监控项注入错峰延迟
// startupMode 为 true 时，使用固定 2 秒间隔而非按 interval 计算，避免启动过慢
func (s *Scheduler) runChecks(ctx context.Context, allowStagger bool, startupMode bool) {
	// 防止重复执行
	s.checkMu.Lock()
	if s.checkInProgress {
		logger.Info("scheduler", "上一轮检查尚未完成，跳过本次")
		s.checkMu.Unlock()
		return
	}
	s.checkInProgress = true
	s.checkMu.Unlock()

	defer func() {
		s.checkMu.Lock()
		s.checkInProgress = false
		s.checkMu.Unlock()
	}()

	// 获取当前配置（支持热更新）
	s.cfgMu.RLock()
	cfg := s.cfg
	s.cfgMu.RUnlock()

	if cfg == nil || len(cfg.Monitors) == 0 {
		return
	}

	logger.Info("scheduler", "开始巡检", "count", len(cfg.Monitors))

	var wg sync.WaitGroup

	// 并发控制：根据配置决定并发策略
	monitorCount := len(cfg.Monitors)
	maxConcurrency := cfg.MaxConcurrency

	// MaxConcurrency 语义：
	// - -1: 无限制，自动扩容到监控项数量
	// - >0: 硬上限，严格限制并发数
	if maxConcurrency == -1 {
		// 无限制模式：每个监控项一个 goroutine
		maxConcurrency = monitorCount
		logger.Info("scheduler", "并发模式: 无限制", "concurrency", maxConcurrency)
	} else if monitorCount > maxConcurrency {
		// 硬上限模式：监控数超过上限时会排队
		logger.Info("scheduler", "并发模式: 硬上限", "limit", maxConcurrency, "monitors", monitorCount)
	} else {
		logger.Info("scheduler", "并发模式: 正常", "concurrency", maxConcurrency, "monitors", monitorCount)
	}

	// 限制并发数
	sem := make(chan struct{}, maxConcurrency)

	// 错峰策略：在周期内均匀分散探测
	useStagger := allowStagger && cfg.ShouldStaggerProbes() && monitorCount > 1 && s.interval > 0
	var baseDelay time.Duration
	var jitterRange time.Duration
	if useStagger {
		if startupMode {
			// 启动模式：固定 2 秒间隔，避免同时发起大量请求
			baseDelay = 2 * time.Second
			jitterRange = 400 * time.Millisecond // ±20%
			logger.Info("scheduler", "启动模式：探测将以固定间隔错峰执行", "base_delay", baseDelay, "jitter", jitterRange)
		} else {
			// 常规模式：按 interval 均分
			baseDelay = s.interval / time.Duration(monitorCount)
			if baseDelay <= 0 {
				useStagger = false
			} else {
				jitterRange = baseDelay / 5 // ±20% 抖动
				logger.Info("scheduler", "探测将错峰执行", "base_delay", baseDelay, "jitter", jitterRange)
			}
		}
	}

	for idx, task := range cfg.Monitors {
		wg.Add(1)
		go func(t config.ServiceConfig, index int) {
			defer wg.Done()

			// 错峰延迟（在获取信号量之前）
			if useStagger {
				delay := s.computeStaggerDelay(baseDelay, jitterRange, index)
				if delay > 0 && !sleepWithContext(ctx, delay) {
					return // context 取消
				}
			}

			// 获取信号量
			select {
			case sem <- struct{}{}:
			case <-ctx.Done():
				return
			}
			defer func() { <-sem }()

			// 执行探测
			result := s.prober.Probe(ctx, &t)

			// 保存结果
			if err := s.prober.SaveResult(result); err != nil {
				logger.Error("scheduler", "保存结果失败",
					"provider", t.Provider, "service", t.Service, "channel", t.Channel, "error", err)
			}
		}(task, idx)
	}

	wg.Wait()
	logger.Info("scheduler", "巡检完成")
}

// UpdateConfig 更新配置（热更新时调用）
func (s *Scheduler) UpdateConfig(cfg *config.AppConfig) {
	s.cfgMu.Lock()
	s.cfg = cfg
	s.cfgMu.Unlock()

	// 如果配置中带有新的巡检间隔，动态调整 ticker
	if cfg.IntervalDuration > 0 {
		s.mu.Lock()
		if s.interval != cfg.IntervalDuration {
			s.interval = cfg.IntervalDuration
			if s.ticker != nil {
				s.ticker.Reset(s.interval)
				logger.Info("scheduler", "巡检间隔已更新", "interval", s.interval)
			}
		}
		s.mu.Unlock()
	}

	logger.Info("scheduler", "配置已更新，下次巡检将使用新配置")
}

// TriggerNow 立即触发一次巡检（热更新后调用）
func (s *Scheduler) TriggerNow() {
	s.mu.Lock()
	running := s.running
	ctx := s.ctx
	s.mu.Unlock()

	if running && ctx != nil {
		go s.runChecks(ctx, false, false) // 手动触发不错峰
		logger.Info("scheduler", "已触发即时巡检")
	}
}

// Stop 停止调度器
func (s *Scheduler) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running && s.ticker != nil {
		s.ticker.Stop()
		s.running = false
	}

	s.prober.Close()
}

// computeStaggerDelay 计算错峰延迟时间
// 基准延迟 + 随机抖动（±20%）
// 注意：使用全局 rand（Go 1.20+ 并发安全）
func (s *Scheduler) computeStaggerDelay(baseDelay, jitterRange time.Duration, index int) time.Duration {
	delay := baseDelay * time.Duration(index)
	if jitterRange <= 0 {
		if delay < 0 {
			return 0
		}
		return delay
	}

	max := int64(jitterRange)
	if max <= 0 {
		if delay < 0 {
			return 0
		}
		return delay
	}

	// 随机抖动：±jitterRange（使用全局 rand，Go 1.20+ 并发安全）
	offset := rand.Int63n(max*2+1) - max
	delay += time.Duration(offset)
	if delay < 0 {
		return 0
	}
	return delay
}

// sleepWithContext 在指定时间内休眠，支持 context 取消
func sleepWithContext(ctx context.Context, d time.Duration) bool {
	if d <= 0 {
		return true
	}

	timer := time.NewTimer(d)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return false // 被取消
	case <-timer.C:
		return true // 正常完成
	}
}
