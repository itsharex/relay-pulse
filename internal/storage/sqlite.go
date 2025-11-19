package storage

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite" // 纯Go实现的SQLite驱动
)

// SQLiteStorage SQLite存储实现
type SQLiteStorage struct {
	db *sql.DB
}

// NewSQLiteStorage 创建SQLite存储
func NewSQLiteStorage(dbPath string) (*SQLiteStorage, error) {
	// 使用WAL模式和其他参数解决并发锁问题
	dsn := fmt.Sprintf("file:%s?_journal_mode=WAL&_timeout=5000&_busy_timeout=5000", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("打开数据库失败: %w", err)
	}

	// 设置连接池参数（WAL模式支持更好的并发）
	db.SetMaxOpenConns(1)  // SQLite建议单个写连接
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(time.Hour)

	return &SQLiteStorage{db: db}, nil
}

// Init 初始化数据库表
func (s *SQLiteStorage) Init() error {
	schema := `
	CREATE TABLE IF NOT EXISTS probe_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		provider TEXT NOT NULL,
		service TEXT NOT NULL,
		status INTEGER NOT NULL,
		latency INTEGER NOT NULL,
		timestamp INTEGER NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_provider_service_timestamp
	ON probe_history(provider, service, timestamp DESC);
	`

	_, err := s.db.Exec(schema)
	if err != nil {
		return fmt.Errorf("初始化数据库失败: %w", err)
	}

	return nil
}

// Close 关闭数据库
func (s *SQLiteStorage) Close() error {
	return s.db.Close()
}

// SaveRecord 保存探测记录
func (s *SQLiteStorage) SaveRecord(record *ProbeRecord) error {
	query := `
		INSERT INTO probe_history (provider, service, status, latency, timestamp)
		VALUES (?, ?, ?, ?, ?)
	`

	result, err := s.db.Exec(query,
		record.Provider,
		record.Service,
		record.Status,
		record.Latency,
		record.Timestamp,
	)

	if err != nil {
		return fmt.Errorf("保存记录失败: %w", err)
	}

	id, _ := result.LastInsertId()
	record.ID = id
	return nil
}

// GetLatest 获取最新记录
func (s *SQLiteStorage) GetLatest(provider, service string) (*ProbeRecord, error) {
	query := `
		SELECT id, provider, service, status, latency, timestamp
		FROM probe_history
		WHERE provider = ? AND service = ?
		ORDER BY timestamp DESC
		LIMIT 1
	`

	var record ProbeRecord
	err := s.db.QueryRow(query, provider, service).Scan(
		&record.ID,
		&record.Provider,
		&record.Service,
		&record.Status,
		&record.Latency,
		&record.Timestamp,
	)

	if err == sql.ErrNoRows {
		return nil, nil // 没有记录不算错误
	}

	if err != nil {
		return nil, fmt.Errorf("查询最新记录失败: %w", err)
	}

	return &record, nil
}

// GetHistory 获取历史记录
func (s *SQLiteStorage) GetHistory(provider, service string, since time.Time) ([]*ProbeRecord, error) {
	query := `
		SELECT id, provider, service, status, latency, timestamp
		FROM probe_history
		WHERE provider = ? AND service = ? AND timestamp >= ?
		ORDER BY timestamp ASC
	`

	rows, err := s.db.Query(query, provider, service, since.Unix())
	if err != nil {
		return nil, fmt.Errorf("查询历史记录失败: %w", err)
	}
	defer rows.Close()

	var records []*ProbeRecord
	for rows.Next() {
		var record ProbeRecord
		err := rows.Scan(
			&record.ID,
			&record.Provider,
			&record.Service,
			&record.Status,
			&record.Latency,
			&record.Timestamp,
		)
		if err != nil {
			return nil, fmt.Errorf("扫描记录失败: %w", err)
		}
		records = append(records, &record)
	}

	// 检查迭代过程中是否发生错误
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("迭代记录失败: %w", err)
	}

	return records, nil
}

// CleanOldRecords 清理旧记录
func (s *SQLiteStorage) CleanOldRecords(days int) error {
	cutoff := time.Now().AddDate(0, 0, -days).Unix()
	query := `DELETE FROM probe_history WHERE timestamp < ?`

	result, err := s.db.Exec(query, cutoff)
	if err != nil {
		return fmt.Errorf("清理旧记录失败: %w", err)
	}

	deleted, _ := result.RowsAffected()
	if deleted > 0 {
		fmt.Printf("[Storage] 已清理 %d 条超过 %d 天的旧记录\n", deleted, days)
	}

	return nil
}
