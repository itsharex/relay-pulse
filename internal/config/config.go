package config

import (
	"fmt"
	"os"
	"strings"
)

// ServiceConfig 单个服务监控配置
type ServiceConfig struct {
	Provider string            `yaml:"provider" json:"provider"`
	Service  string            `yaml:"service" json:"service"`
	URL      string            `yaml:"url" json:"url"`
	Method   string            `yaml:"method" json:"method"`
	Headers  map[string]string `yaml:"headers" json:"headers"`
	Body     string            `yaml:"body" json:"body"`
	APIKey   string            `yaml:"api_key" json:"-"` // 不返回给前端
}

// AppConfig 应用配置
type AppConfig struct {
	Monitors []ServiceConfig `yaml:"monitors"`
}

// Validate 验证配置合法性
func (c *AppConfig) Validate() error {
	if len(c.Monitors) == 0 {
		return fmt.Errorf("至少需要配置一个监控项")
	}

	// 检查重复和必填字段
	seen := make(map[string]bool)
	for i, m := range c.Monitors {
		// 必填字段检查
		if m.Provider == "" {
			return fmt.Errorf("monitor[%d]: provider 不能为空", i)
		}
		if m.Service == "" {
			return fmt.Errorf("monitor[%d]: service 不能为空", i)
		}
		if m.URL == "" {
			return fmt.Errorf("monitor[%d]: URL 不能为空", i)
		}
		if m.Method == "" {
			return fmt.Errorf("monitor[%d]: method 不能为空", i)
		}

		// Method 枚举检查
		validMethods := map[string]bool{"GET": true, "POST": true, "PUT": true, "DELETE": true, "PATCH": true}
		if !validMethods[strings.ToUpper(m.Method)] {
			return fmt.Errorf("monitor[%d]: method '%s' 无效，必须是 GET/POST/PUT/DELETE/PATCH 之一", i, m.Method)
		}

		// 唯一性检查
		key := m.Provider + "/" + m.Service
		if seen[key] {
			return fmt.Errorf("重复的监控项: provider=%s, service=%s", m.Provider, m.Service)
		}
		seen[key] = true
	}

	return nil
}

// ApplyEnvOverrides 应用环境变量覆盖
// 格式：MONITOR_<PROVIDER>_<SERVICE>_API_KEY
func (c *AppConfig) ApplyEnvOverrides() {
	for i := range c.Monitors {
		m := &c.Monitors[i]
		envKey := fmt.Sprintf("MONITOR_%s_%s_API_KEY",
			strings.ToUpper(strings.ReplaceAll(m.Provider, "-", "_")),
			strings.ToUpper(strings.ReplaceAll(m.Service, "-", "_")))

		if envVal := os.Getenv(envKey); envVal != "" {
			m.APIKey = envVal
		}
	}
}

// ProcessPlaceholders 处理 {{API_KEY}} 占位符替换（headers 和 body）
func (m *ServiceConfig) ProcessPlaceholders() {
	// Headers 中替换
	for k, v := range m.Headers {
		m.Headers[k] = strings.ReplaceAll(v, "{{API_KEY}}", m.APIKey)
	}

	// Body 中替换
	m.Body = strings.ReplaceAll(m.Body, "{{API_KEY}}", m.APIKey)
}

// Clone 深拷贝配置（用于热更新回滚）
func (c *AppConfig) Clone() *AppConfig {
	clone := &AppConfig{
		Monitors: make([]ServiceConfig, len(c.Monitors)),
	}
	copy(clone.Monitors, c.Monitors)
	return clone
}
