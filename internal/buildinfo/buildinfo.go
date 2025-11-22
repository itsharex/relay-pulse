// Package buildinfo 提供构建信息（版本号、Git提交、构建时间）
// 这些变量在编译时通过 ldflags 注入实际值
package buildinfo

import "runtime"

// 构建信息变量 (通过 ldflags 注入)
var (
	// Version 是应用程序版本号（如 v1.0.0 或 git describe 输出）
	Version = "dev"

	// GitCommit 是 Git commit hash（短格式）
	GitCommit = "unknown"

	// BuildTime 是构建时间（UTC格式）
	BuildTime = "unknown"
)

// GetVersion 返回应用程序版本号
func GetVersion() string {
	return Version
}

// GetGitCommit 返回 Git commit hash
func GetGitCommit() string {
	return GitCommit
}

// GetBuildTime 返回构建时间
func GetBuildTime() string {
	return BuildTime
}

// GetGoVersion 返回 Go 编译器版本
func GetGoVersion() string {
	return runtime.Version()
}

// GetFullInfo 返回完整的构建信息字符串
func GetFullInfo() string {
	return "Version: " + Version +
		" | Commit: " + GitCommit +
		" | Built: " + BuildTime +
		" | Go: " + runtime.Version()
}
