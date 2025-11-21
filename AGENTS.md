# Repository Guidelines

## 项目结构与模块划分
Go 后端位于 `cmd/server/main.go`，核心包集中在 `internal/`（`config`、`scheduler`、`monitor`、`storage`、`api`）。运行期资产（`monitor.db`、构建产物）放在 `monitor/`。根目录 `config.yaml` 控制监控任务，模板版本为 `config.yaml.example`，部署时只复制示例并加密 secrets。React 前端位于 `frontend/`（`src/components`、`hooks`、`constants`、`types`），脚本在 `scripts/`，长文档在 `docs/`；静态资源统一放 `frontend/public`，以便 Vite 构建拾取。

## 构建、测试与开发命令
- 后端：使用 `go mod tidy` 同步依赖，`go build -o monitor ./cmd/server` 或 `go run cmd/server/main.go` 做快速验证，`./monitor config.yaml` 指定自定义路径。
- 配置：执行 `cp config.yaml.example config.yaml`，再导出 `MONITOR_<PROVIDER>_<SERVICE>_API_KEY` 以避免泄露，同时在 `.env` 中记录本地假数据。
- 质量闸门：`go fmt ./... && go vet ./... && go test ./...`；动到调度或存储时加跑 `go test -cover ./internal/...`，必要时用 `pre-commit run --all-files` 触发整套钩子。
- 前端：`npm install --prefix frontend`，然后 `npm run dev|build|lint --prefix frontend`，`npm run preview --prefix frontend` 可在 Vite 预览模式下验证打包产物。

## 代码风格与命名
遵守惯用 Go：制表符缩进，小写包名，导出 API 用 PascalCase，私有方法用 camelCase，并通过 `fmt.Errorf("context: %w", err)` 包装错误。保持 `[Config]`、`[Scheduler]` 等日志前缀，使用 `sync.RWMutex` 保护共享状态，并在关键分支添加少量注释说明并发约束。前端维持函数式组件、`src/hooks` 中的复用逻辑以及现有 ESLint/Tailwind 约定，TypeScript 类型集中在 `src/types` 并复用已有接口声明。

## 测试指南
在实现旁放置 `*_test.go`，用表驱动用例覆盖配置解析、调度时序、SQLite 读写（建议内存 DSN）。通过 `go test -coverprofile=coverage.out ./...` 生成覆盖率，再用 `go tool cover -html=coverage.out` 查看，并在 PR 中附上关键覆盖率数字。手动排查时运行 `./monitor`，调用 `curl http://localhost:8080/api/status`，并编辑 `config.yaml` 确认热更新日志；需要模拟多 provider 时，可临时扩展示例配置。前端目前依赖 lint，如新增运行时代码，再引入 `frontend/src/__tests__` 与 `npm test`，并用 `npm run build --prefix frontend` 捕获类型问题。

## 提交与 PR 规范
提交信息遵循 `<type>: <subject>`，type 在 `feat|fix|docs|refactor|test|chore` 之间选择，主题用 72 字符以内的祈使句，必要时在正文列出要点并添加 `Closes #id`。开 PR 前确保 `pre-commit run --all-files`、`go test ./...`、`npm run lint --prefix frontend` 均通过，PR 描述需总结协议/配置变更、列出新增环境变量，并附上 UI 截图或 GIF，同时说明回滚策略与影响范围。

## 配置与安全说明
不要提交真实 API Key 或 SQLite dump，仅保留示例配置。统一使用 `MONITOR_<PROVIDER>_<SERVICE>_API_KEY`（全大写，破折号改下划线）作为环境变量，并在 CI/CD 或 Secret Manager 中管理密钥。配置监听器会热加载当前文件，因此保存前请验证 YAML，有误会退回旧版本；生产修改建议通过审查后的 PR 合入。SQLite 建议保持 WAL 模式（`file:monitor.db?_journal_mode=WAL`）以减少并发锁冲突，必要时使用外部数据库时保持接口兼容。
