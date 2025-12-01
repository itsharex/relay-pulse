package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveBodyIncludes(t *testing.T) {
	t.Parallel()

	configDir := t.TempDir()
	dataDir := filepath.Join(configDir, "data")
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		t.Fatalf("创建 data 目录失败: %v", err)
	}

	expected := `{"hello":"world"}`
	payloadPath := filepath.Join(dataDir, "payload.json")
	if err := os.WriteFile(payloadPath, []byte(expected), 0o644); err != nil {
		t.Fatalf("写入 payload 失败: %v", err)
	}

	cfg := AppConfig{
		Monitors: []ServiceConfig{
			{
				Provider: "demo",
				Service:  "codex",
				Body:     "!include data/payload.json",
			},
		},
	}

	if err := cfg.ResolveBodyIncludes(configDir); err != nil {
		t.Fatalf("解析 include 失败: %v", err)
	}

	if cfg.Monitors[0].Body != expected {
		t.Fatalf("body 解析结果不符合预期，got=%s", cfg.Monitors[0].Body)
	}
}

func TestResolveBodyIncludesRejectsOutsideData(t *testing.T) {
	t.Parallel()

	configDir := t.TempDir()
	cfg := AppConfig{
		Monitors: []ServiceConfig{
			{
				Provider: "demo",
				Service:  "codex",
				Body:     "!include ../secret.json",
			},
		},
	}

	if err := cfg.ResolveBodyIncludes(configDir); err == nil {
		t.Fatalf("期望 include 非 data 目录时报错")
	}
}

// Test consecutive hyphens in slug
func TestConsecutiveHyphensSlug(t *testing.T) {
	tests := []struct {
		name      string
		slug      string
		shouldErr bool
	}{
		{"单连字符", "easy-chat", false},
		{"连续两个连字符", "easy--chat", true},
		{"连续三个连字符", "easy---chat", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateProviderSlug(tt.slug)
			if tt.shouldErr && err == nil {
				t.Errorf("validateProviderSlug(%q) should return error", tt.slug)
			}
			if !tt.shouldErr && err != nil {
				t.Errorf("validateProviderSlug(%q) should not return error, got: %v", tt.slug, err)
			}
		})
	}
}

// Test baseURL normalization
func TestBaseURLNormalization(t *testing.T) {
	tests := []struct {
		name        string
		inputURL    string
		expectedURL string
		shouldErr   bool
	}{
		{"正常 HTTPS URL", "https://relaypulse.top", "https://relaypulse.top", false},
		{"带尾随斜杠", "https://relaypulse.top/", "https://relaypulse.top", false},
		{"多个尾随斜杠", "https://relaypulse.top///", "https://relaypulse.top", false},
		{"HTTP URL（警告）", "http://example.com", "http://example.com", false},
		{"无效协议", "ftp://example.com", "", true},
		{"缺少协议", "example.com", "", true},
		{"缺少主机", "https://", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &AppConfig{PublicBaseURL: tt.inputURL}
			err := cfg.Normalize()

			if tt.shouldErr {
				if err == nil {
					t.Errorf("Normalize() should return error for %q", tt.inputURL)
				}
			} else {
				if err != nil {
					t.Errorf("Normalize() should not return error for %q, got: %v", tt.inputURL, err)
				}
				if cfg.PublicBaseURL != tt.expectedURL {
					t.Errorf("Normalize() URL = %q, want %q", cfg.PublicBaseURL, tt.expectedURL)
				}
			}
		})
	}
}
