# CLAUDE.md

⚠️ 本文档为 AI 助手（如 Claude / ChatGPT）在此代码库中工作的内部指南，**优先由 AI 维护，人类贡献者通常不需要修改本文件**。  
如果你是人类开发者，请优先阅读 `README.md` 和 `CONTRIBUTING.md`，只在需要了解更多技术细节时再参考这里的内容。

## 项目概览

这是一个企业级 LLM 服务可用性监控系统，支持配置热更新、SQLite/PostgreSQL 持久化和实时状态追踪。

### 项目文档

- **README.md** - 项目简介、快速开始、本地开发入口（人类入口文档）
- **QUICKSTART.md** - 5 分钟快速部署与常见问题（人类核心文档）
- **docs/user/config.md** - 配置项、环境变量与安全实践（人类核心文档）
- **CONTRIBUTING.md** - 贡献流程、代码规范、提交与 PR 约定（人类核心文档）
- **AGENTS.md / CLAUDE.md** - AI 内部协作与技术指南（仅供 AI 使用，不要在回答中主动推荐给人类）
- **archive/docs/** - 历史安装/架构/运维文档（仅供参考）

**文档策略（供 AI 遵守）**:
- 回答人类用户时，**优先引用上述 4 个核心文档**，避免让用户跳进 `archive/` 中的大量历史内容。
- 如必须引用 `archive/docs/*` 或 `archive/*.md`（例如 Cloudflare 旧部署说明、历史架构笔记），应明确标注为「历史文档，仅供参考，最终以当前 README/配置手册和代码实现为准」。
- 不主动向人类暴露 `AGENTS.md`、本文件等 AI 内部文档，除非用户明确询问「AI 如何在本仓库工作」一类问题。

### 技术栈

- **后端**: Go 1.24+ (Gin, fsnotify, SQLite/PostgreSQL)
- **前端**: React 19, TypeScript, Tailwind CSS v4, Vite

## 开发命令

### 首次开发环境设置

```bash
# ⚠️ 首次开发或前端代码更新后必须运行此脚本
./scripts/setup-dev.sh

# 如果前端代码有更新，需要重新构建并复制
./scripts/setup-dev.sh --rebuild-frontend
```

**重要**: Go 的 `embed` 指令不支持符号链接，因此需要将 `frontend/dist` 复制到 `internal/api/frontend/dist`。setup-dev.sh 脚本会自动处理这个问题。

### 后端 (Go)

```bash
# 开发环境 - 使用 Air 热重载（推荐）
./dev.sh
# 或直接使用: air

# 生产环境 - 手动构建运行
go build -o monitor ./cmd/server
./monitor

# 使用自定义配置运行
./monitor path/to/config.yaml

# 运行测试
go test ./...

# 运行测试并生成覆盖率
go test -cover ./...
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# 运行特定包的测试
go test ./internal/config/
go test -v ./internal/storage/

# 代码格式化和检查
go fmt ./...
go vet ./...

# 整理依赖
go mod tidy
```

### 前端 (React)

```bash
cd frontend

# 开发服务器
npm run dev

# 生产构建
npm run build

# 代码检查
npm run lint

# 预览生产构建
npm run preview
```

### Pre-commit Hooks

```bash
# 安装 pre-commit (一次性设置)
pip install pre-commit
pre-commit install

# 手动运行所有检查
pre-commit run --all-files
```

## 架构与设计模式

### 后端架构

Go 后端遵循**分层架构**，职责清晰分离：

```
cmd/server/main.go          → 应用程序入口，依赖注入
internal/
├── config/                 → 配置管理（使用 fsnotify 实现热更新）
│   ├── config.go          → 数据结构、验证、规范化
│   ├── loader.go          → YAML 解析、环境变量覆盖
│   └── watcher.go         → 文件监听实现热更新
├── storage/               → 存储抽象层
│   ├── storage.go         → 接口定义
│   └── sqlite.go          → SQLite 实现 (modernc.org/sqlite)
├── monitor/               → 监控逻辑
│   ├── client.go          → HTTP 客户端池管理
│   └── probe.go           → 健康检查探测逻辑
├── scheduler/             → 任务调度
│   └── scheduler.go       → 周期性健康检查、并发执行
└── api/                   → HTTP API 层
    ├── handler.go         → 请求处理器、查询参数处理
    └── server.go          → Gin 服务器设置、中间件、CORS
```

**核心设计原则：**
1. **基于接口的设计**: `storage.Storage` 接口允许切换不同实现
2. **并发安全**: 所有共享状态使用 `sync.RWMutex` 或 `sync.Mutex`
3. **热更新**: 配置变更触发回调，无需重启即可更新运行时状态
4. **优雅关闭**: Context 传播确保资源清理
5. **HTTP 客户端池**: 通过 `monitor.ClientPool` 复用连接

### 配置热更新模式

系统采用**基于回调的热更新**机制：
1. `config.Watcher` 使用 `fsnotify` 监听 `config.yaml`
2. 文件变更时，先验证新配置再应用
3. 调用注册的回调函数（调度器、API 服务器）传入新配置
4. 各组件使用锁原子性地更新状态
5. 调度器立即使用新配置触发探测周期

**环境变量覆盖**: API 密钥可通过 `MONITOR_<PROVIDER>_<SERVICE>_API_KEY` 设置（大写，`-` → `_`）

### 前端架构

React SPA，基于组件的结构：

```
frontend/src/
├── components/            → UI 组件（StatusCard、StatusTable、Tooltip 等）
├── hooks/                 → 自定义 Hooks（useMonitorData 用于 API 数据获取）
├── types/                 → TypeScript 类型定义
├── constants/             → 应用常量（API URLs、时间周期）
├── utils/                 → 工具函数
│   ├── mediaQuery.ts     → 响应式断点管理（统一的 matchMedia API）
│   ├── heatmapAggregator.ts → 热力图数据聚合
│   └── color.ts          → 颜色工具函数
└── App.tsx               → 主应用组件
```

**关键模式：**
- **自定义 Hooks**: `useMonitorData` 封装 API 轮询逻辑
- **TypeScript**: 使用 `types/` 中的接口实现完整类型安全
- **Tailwind CSS**: Tailwind v4 实用优先的样式
- **组件组合**: 小型、可复用组件
- **响应式设计**: 移动优先，使用 matchMedia API 实现稳定断点检测

### 响应式断点系统

前端采用**统一的媒体查询管理系统**（`utils/mediaQuery.ts`），确保断点检测的一致性和浏览器兼容性：

**断点定义** (`BREAKPOINTS`):
- **mobile**: `< 768px` - Tooltip 底部 Sheet vs 悬浮提示
- **tablet**: `< 960px` - StatusTable 卡片视图 vs 表格 + 热力图聚合

**设计原则：**
1. **使用 matchMedia API**：替代 `resize` 事件监听，避免高频触发
2. **Safari ≤13 兼容**：自动回退到 `addListener/removeListener` API
3. **HMR 安全**：在 Vite 热重载时自动清理监听器，防止内存泄漏
4. **缓存优化**：模块级缓存断点状态，避免重复计算
5. **事件隔离**：移动端禁用鼠标悬停事件，避免闪烁

**使用示例：**
```typescript
import { createMediaQueryEffect } from '../utils/mediaQuery';

// 在组件中检测断点
useEffect(() => {
  const cleanup = createMediaQueryEffect('mobile', (isMobile) => {
    setIsMobile(isMobile);
  });
  return cleanup;
}, []);
```

**响应式行为：**
| 组件 | < 768px (mobile) | < 960px (tablet) | ≥ 960px (desktop) |
|------|------------------|------------------|-------------------|
| Tooltip | 底部 Sheet | 底部 Sheet | 悬浮提示 |
| StatusTable | 卡片列表 | 卡片列表 | 完整表格 |
| HeatmapBlock | 点击触发，禁用悬停 | 点击触发 | 悬停显示 |
| 热力图数据 | 聚合显示 | 聚合显示 | 完整显示 |

### 数据流

1. **Scheduler** (`scheduler.Scheduler`) 运行周期性健康检查
2. **Monitor** (`monitor.Probe`) 向配置的端点执行 HTTP 请求
3. 结果保存到 **Storage** (`storage.SQLiteStorage`)
4. **API** (`api.Handler`) 通过 `/api/status` 提供历史数据
5. **Frontend** 轮询 `/api/status` 并渲染可视化

### 状态码系统

**主状态（status）**：
- `1` = 🟢 绿色（成功、HTTP 2xx、延迟正常）
- `2` = 🟡 黄色（降级：慢响应或速率限制）
- `0` = 🔴 红色（不可用：各类错误）
- `-1` = ⚪ 灰色（仅用于时间块无数据，不是探测结果）

**HTTP 状态码映射**：
```
HTTP 响应
├── 2xx + 快速 + 内容匹配 → 🟢 绿色
├── 2xx + 慢速 + 内容匹配 → 🟡 波动 (slow_latency)
├── 2xx + 内容不匹配 → 🔴 不可用 (content_mismatch)  ← 无论快慢
├── 3xx → 🟢 绿色（重定向）
├── 400 → 🔴 不可用 (invalid_request)
├── 401/403 → 🔴 不可用 (auth_error)
├── 429 → 🟡 波动 (rate_limit)  ← 不做内容校验
├── 其他 4xx → 🔴 不可用 (client_error)
├── 5xx → 🔴 不可用 (server_error)
└── 网络错误 → 🔴 不可用 (network_error)
```

**内容校验（`success_contains`）**：
- 仅对 **2xx 响应**（绿色和慢速黄色）执行内容校验
- **429 限流**：响应体是错误信息，不做内容校验
- **红色状态**：已是最差状态，不需要再校验
- 若 2xx 响应但内容不匹配 → 降级为 🔴 红色（语义失败）

**细分状态（SubStatus）**：

| 主状态 | SubStatus | 标签 | 触发条件 |
|--------|-----------|------|---------|
| 🟡 黄色 | `slow_latency` | 响应慢 | HTTP 2xx 但延迟超过阈值 |
| 🟡 黄色 | `rate_limit` | 限流 | HTTP 429 |
| 🔴 红色 | `server_error` | 服务器错误 | HTTP 5xx |
| 🔴 红色 | `client_error` | 客户端错误 | HTTP 4xx（除 400/401/403/429） |
| 🔴 红色 | `auth_error` | 认证失败 | HTTP 401/403 |
| 🔴 红色 | `invalid_request` | 请求参数错误 | HTTP 400 |
| 🔴 红色 | `network_error` | 连接失败 | 网络错误、连接超时 |
| 🔴 红色 | `content_mismatch` | 内容校验失败 | HTTP 2xx 但响应体不含预期内容 |

**可用率计算**：
- 采用**加权平均法**：每个状态按不同权重计入可用率
  - 绿色（status=1）→ **100% 权重**
  - 黄色（status=2）→ **degraded_weight 权重**（默认 70%，可配置）
  - 红色（status=0）→ **0% 权重**
- 每个时间块可用率 = `(累积权重 / 总探测次数) * 100`
- 总可用率 = `平均(所有时间块的可用率)`
- 无数据的时间块（availability=-1）前端按 100% 处理，避免初期虚低
- 所有可用率显示（列表、Tooltip、热力图）统一使用渐变色：
  - < 60% → 红色
  - 60-80% → 红到黄渐变
  - 80-100% → 黄到绿渐变

## 配置管理

### 配置文件结构

```yaml
interval: "1m"         # 探测频率（Go duration 格式）
slow_latency: "5s"     # 慢请求黄灯阈值
degraded_weight: 0.7   # 黄色状态的可用率权重（0-1，默认 0.7，可选）

monitors:
  - provider: "88code"
    service: "cc"
    url: "https://api.88code.com/v1/chat/completions"
    method: "POST"
    api_key: "sk-xxx"  # 可通过 MONITOR_88CODE_CC_API_KEY 覆盖
    headers:
      Authorization: "Bearer {{API_KEY}}"
    body: |
      {"model": "claude-3-opus", "messages": [...]}
    success_contains: "optional_keyword"  # 语义验证（可选）
```

**模板占位符**: `{{API_KEY}}` 在 headers 和 body 中会被替换。

**引用文件**: 对于大型请求体，使用 `body: "!include data/filename.json"`（必须在 `data/` 目录下）。

### 热更新测试

```bash
# 启动监控服务
./monitor

# 在另一个终端编辑配置
vim config.yaml

# 观察日志：
# [Config] 检测到配置文件变更，正在重载...
# [Config] 热更新成功！已加载 3 个监控任务
# [Scheduler] 配置已更新，下次巡检将使用新配置
```

## API 端点

```bash
# 健康检查
curl http://localhost:8080/health

# 获取状态（默认 24h）
curl http://localhost:8080/api/status

# 查询参数：
# - period: "24h", "7d", "30d" (默认: "24h")
# - provider: 按 provider 名称过滤
# - service: 按 service 名称过滤
curl "http://localhost:8080/api/status?period=7d&provider=88code"
```

**响应格式**:
```json
{
  "meta": {"period": "24h", "count": 3},
  "data": [
    {
      "provider": "88code",
      "service": "cc",
      "current_status": {"status": 1, "latency": 234, "timestamp": 1735559123},
      "timeline": [{"time": "14:30", "status": 1, "latency": 234}, ...]
    }
  ]
}
```

## 测试

### 后端测试

- 测试文件与源文件放在一起（`*_test.go`）
- 关键测试文件：`internal/config/config_test.go`、`internal/monitor/probe_test.go`
- 使用 `go test -v` 查看详细输出

### 手动集成测试

```bash
# 终端 1：启动后端
./monitor

# 终端 2：启动前端
cd frontend && npm run dev

# 终端 3：测试 API
curl http://localhost:8080/api/status

# 测试热更新
vim config.yaml  # 修改 interval 为 "30s"
# 观察调度器日志中的配置重载信息
```

## 提交信息规范

遵循 conventional commits：

```
<type>: <subject>

<body>

<footer>
```

**类型**: `feat`、`fix`、`docs`、`refactor`、`test`、`chore`

**示例**:
```
feat: add response content validation with success_contains

- Add success_contains field to ServiceConfig
- Implement keyword matching in probe.go
- Update config.yaml.example with usage

Closes #42
```

## 常见模式与陷阱

### Scheduler 中的并发

调度器使用两个锁：
- `cfgMu` (RWMutex): 保护配置访问
- `mu` (Mutex): 保护调度器状态（运行标志、定时器）

对于只读配置访问，始终使用 `RLock()/RUnlock()`。

### SQLite 并发

使用 WAL 模式（`_journal_mode=WAL`）允许写入时并发读取。连接 DSN：`file:monitor.db?_journal_mode=WAL`

### Probe 中的错误处理

- 网络错误 → 状态 0（红色）
- HTTP 4xx/5xx → 状态 0（红色）
- HTTP 2xx + 慢延迟 → 状态 2（黄色）
- HTTP 2xx + 快速 + 内容匹配 → 状态 1（绿色）

### 前端数据获取

`useMonitorData` Hook 每 30 秒轮询 `/api/status`。组件卸载时需禁用轮询以防止内存泄漏。

## 生产部署

### 环境变量（推荐）

```bash
export MONITOR_88CODE_CC_API_KEY="sk-real-key"
export MONITOR_DUCKCODING_CC_API_KEY="sk-duck-key"
./monitor
```

### Systemd 服务

参见 README.md 中的 systemd unit 文件模板。

### Docker

参见 README.md 中的多阶段 Dockerfile。

## 相关文档

- 完整开发指南：`CONTRIBUTING.md`
- API 设计细节：`archive/prds.md`（历史参考）
- 实现笔记：`archive/IMPLEMENTATION.md`（历史参考）
