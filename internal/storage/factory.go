package storage

import (
	"fmt"
	"strings"

	"monitor/internal/config"
)

// New 创建存储实例（工厂模式）
func New(cfg *config.StorageConfig) (Storage, error) {
	storageType := strings.ToLower(strings.TrimSpace(cfg.Type))

	switch storageType {
	case "postgres", "postgresql":
		return NewPostgresStorage(&cfg.Postgres)

	case "sqlite", "":
		// 默认使用 SQLite
		dbPath := cfg.SQLite.Path
		if dbPath == "" {
			dbPath = "monitor.db"
		}
		return NewSQLiteStorage(dbPath)

	default:
		return nil, fmt.Errorf("不支持的存储类型: %s (支持: sqlite, postgres)", cfg.Type)
	}
}
