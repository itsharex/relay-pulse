package api

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"monitor/internal/config"
	"monitor/internal/storage"
)

// Handler API处理器
type Handler struct {
	storage storage.Storage
	config  *config.AppConfig
	cfgMu   sync.RWMutex // 保护config的并发访问
}

// NewHandler 创建处理器
func NewHandler(store storage.Storage, cfg *config.AppConfig) *Handler {
	return &Handler{
		storage: store,
		config:  cfg,
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
	Provider string              `json:"provider"`
	Service  string              `json:"service"`
	Current  *CurrentStatus      `json:"current_status"`
	Timeline []storage.TimePoint `json:"timeline"`
}

// GetStatus 获取监控状态
func (h *Handler) GetStatus(c *gin.Context) {
	// 参数解析
	period := c.DefaultQuery("period", "24h")
	qProvider := c.DefaultQuery("provider", "all")
	qService := c.DefaultQuery("service", "all")

	// 解析时间范围
	since, err := h.parsePeriod(period)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("无效的时间范围: %s", period),
		})
		return
	}

	// 获取配置副本（线程安全）
	h.cfgMu.RLock()
	monitors := h.config.Monitors
	h.cfgMu.RUnlock()

	var response []MonitorResult

	// 遍历配置中的监控项
	seen := make(map[string]bool)
	for _, task := range monitors {
		// 过滤
		if qProvider != "all" && qProvider != task.Provider {
			continue
		}
		if qService != "all" && qService != task.Service {
			continue
		}

		// 去重
		key := task.Provider + "/" + task.Service
		if seen[key] {
			continue
		}
		seen[key] = true

		// 获取最新记录
		latest, err := h.storage.GetLatest(task.Provider, task.Service)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("查询失败: %v", err),
			})
			return
		}

		// 获取历史记录
		history, err := h.storage.GetHistory(task.Provider, task.Service, since)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("查询历史失败: %v", err),
			})
			return
		}

		// 转换为时间轴数据
		timeline := h.buildTimeline(history, period)

		// 转换为API响应格式（不暴露数据库主键）
		var current *CurrentStatus
		if latest != nil {
			current = &CurrentStatus{
				Status:    latest.Status,
				Latency:   latest.Latency,
				Timestamp: latest.Timestamp,
			}
		}

		response = append(response, MonitorResult{
			Provider: task.Provider,
			Service:  task.Service,
			Current:  current,
			Timeline: timeline,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"meta": gin.H{
			"period": period,
			"count":  len(response),
		},
		"data": response,
	})
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

// buildTimeline 构建时间轴（从真实历史数据）
func (h *Handler) buildTimeline(records []*storage.ProbeRecord, period string) []storage.TimePoint {
	var timeline []storage.TimePoint

	// 确定时间格式
	format := "15:04"
	if period == "7d" || period == "30d" {
		format = "2006-01-02"
	}

	// 转换记录
	for _, record := range records {
		t := time.Unix(record.Timestamp, 0)
		timeline = append(timeline, storage.TimePoint{
			Time:    t.Format(format),
			Status:  record.Status,
			Latency: record.Latency,
		})
	}

	return timeline
}

// UpdateConfig 更新配置（热更新时调用）
func (h *Handler) UpdateConfig(cfg *config.AppConfig) {
	h.cfgMu.Lock()
	h.config = cfg
	h.cfgMu.Unlock()
}
