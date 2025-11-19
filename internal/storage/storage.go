package storage

import "time"

// ProbeRecord 探测记录
type ProbeRecord struct {
	ID        int64
	Provider  string
	Service   string
	Status    int   // 1=绿, 0=红, 2=黄
	Latency   int   // ms
	Timestamp int64 // Unix时间戳
}

// TimePoint 时间轴数据点（用于前端展示）
type TimePoint struct {
	Time    string `json:"time"`
	Status  int    `json:"status"`
	Latency int    `json:"latency"`
}

// Storage 存储接口
type Storage interface {
	// Init 初始化存储
	Init() error

	// Close 关闭存储
	Close() error

	// SaveRecord 保存探测记录
	SaveRecord(record *ProbeRecord) error

	// GetLatest 获取最新记录
	GetLatest(provider, service string) (*ProbeRecord, error)

	// GetHistory 获取历史记录（时间范围）
	GetHistory(provider, service string, since time.Time) ([]*ProbeRecord, error)

	// CleanOldRecords 清理旧记录（保留最近N天）
	CleanOldRecords(days int) error
}
