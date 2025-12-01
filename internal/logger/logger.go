// Package logger 提供统一的结构化日志支持
// 基于 Go 1.21+ 标准库 log/slog，不引入额外依赖
package logger

import (
	"context"
	"log/slog"
	"os"
	"sync"
)

var (
	defaultLogger *slog.Logger
	initOnce      sync.Once
)

// 初始化默认 logger
func init() {
	initOnce.Do(func() {
		defaultLogger = slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelInfo,
		})).With("app", "relay-pulse")
	})
}

// Default 返回默认 logger
func Default() *slog.Logger {
	return defaultLogger
}

// WithComponent 创建带有组件标识的 logger
func WithComponent(component string) *slog.Logger {
	return defaultLogger.With("component", component)
}

// context key 类型（避免与其他包冲突）
type ctxKey string

const (
	// RequestIDKey 用于存储 request_id 的 context key
	RequestIDKey ctxKey = "request_id"
)

// WithRequestID 将 request_id 存入 context
func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, RequestIDKey, requestID)
}

// FromContext 从 context 获取 logger，自动附加 request_id（如果存在）
func FromContext(ctx context.Context, component string) *slog.Logger {
	l := WithComponent(component)
	if reqID, ok := ctx.Value(RequestIDKey).(string); ok && reqID != "" {
		l = l.With("request_id", reqID)
	}
	return l
}

// 便捷方法：直接记录日志（用于渐进式迁移）

// Info 记录 INFO 级别日志
func Info(component, msg string, args ...any) {
	WithComponent(component).Info(msg, args...)
}

// Warn 记录 WARN 级别日志
func Warn(component, msg string, args ...any) {
	WithComponent(component).Warn(msg, args...)
}

// Error 记录 ERROR 级别日志
func Error(component, msg string, args ...any) {
	WithComponent(component).Error(msg, args...)
}

// Debug 记录 DEBUG 级别日志
func Debug(component, msg string, args ...any) {
	WithComponent(component).Debug(msg, args...)
}
