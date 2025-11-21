# 更新日志

## [未发布] - 2025-11-21

### 新增功能
- **服务商和赞助者链接跳转** (#1)
  - 配置文件支持 `provider_url` 和 `sponsor_url` 字段
  - 前端点击服务商/赞助者名称可跳转到对应链接
  - 外链显示图标，HTTP 链接显示警告提示
  - 后端严格验证 URL 格式，防止 XSS 等安全问题

### 改进
- **可用率计算优化**
  - 从块计数法改为平均值法，更精确反映服务可用率
  - 灰色状态（无数据/认证失败）算作 100% 可用，避免初期可用率虚低

- **状态码系统优化**
  - 400/401/403 认证失败显示为灰色（未配置状态），不再算作红色故障
  - 与真正的服务故障（红色）区分开

- **UI 优化**
  - 移除时间选择器的"近15天"选项（后端不支持）
  - Tooltip 移除状态文字，可用率颜色与热力图块颜色一致

### 修复
- **构建工具**
  - 修复 Makefile 中 air 工具的安装路径问题
  - 更新 air 仓库地址为新的 `github.com/air-verse/air`

### 技术改进
- **安全增强**
  - URL 验证：只允许 http/https 协议
  - 前端二次校验：无效 URL 自动降级为纯文本
  - 外链安全：自动添加 `rel="noopener noreferrer"`

- **配置示例**
  - `config.yaml.example` 新增 URL 字段示例

### 数据库维护
- 清理 2025-11-20 18:43:12 之前的调试数据
- 统一 service 名称：`codex` → `cx`

---

## 文件变更清单

### 后端
- `internal/config/config.go` - 新增 URL 字段、验证、规范化
- `internal/monitor/probe.go` - 优化状态判定逻辑（400/401/403 → 灰色）
- `internal/api/handler.go` - API 透传 URL 字段
- `config.yaml.example` - 新增配置示例

### 前端
- `frontend/src/types/index.ts` - 类型定义新增 URL 字段
- `frontend/src/hooks/useMonitorData.ts` - URL 校验、可用率计算优化
- `frontend/src/components/ExternalLink.tsx` - 新建通用外链组件
- `frontend/src/components/StatusTable.tsx` - 集成外链组件
- `frontend/src/components/StatusCard.tsx` - 集成外链组件
- `frontend/src/components/Tooltip.tsx` - UI 优化
- `frontend/src/constants/index.ts` - 移除15天选项、更新 MISSING 权重

### 构建
- `Makefile` - 修复 air 工具路径和仓库地址
