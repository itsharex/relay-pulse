# 更新日志

## [v0.1.1] - 2025-11-23

### 新增功能
- **移动端响应式设计** (#2)
  - 支持 45% 移动端用户，实现完整的移动适配
  - 统一的媒体查询管理系统（`utils/mediaQuery.ts`）
  - 兼容 Safari ≤13 和 iOS 13（自动回退到旧版 API）
  - Vite HMR 安全（自动清理监听器，防止内存泄漏）

### 改进
- **响应式断点系统**
  - Mobile (< 768px): Tooltip 底部 Sheet、热力图点击触发
  - Tablet (< 960px): StatusTable 卡片视图、热力图数据聚合
  - Desktop (≥ 960px): 完整表格视图、悬浮 Tooltip
  - 使用 matchMedia API 替代 resize 监听，避免闪烁和高频触发

- **移动端组件优化**
  - Controls: 筛选器抽屉、横向滚动、44px 触摸目标
  - StatusTable: 卡片列表视图、可展开详情、移动端排序菜单
  - Tooltip: 底部 Sheet 带拖动指示条、遮罩层
  - HeatmapBlock: 移动端禁用鼠标悬停，仅响应触摸/点击
  - Header: 响应式 Logo、统计卡片
  - Footer: 可折叠免责声明
  - ExternalLink: 44px 最小触摸区域、ARIA 标签

- **表单可访问性**
  - Controls 中的 select 元素添加 id/name 属性
  - 消除控制台 "form field element should have an id or name" 警告

### 修复
- **Tooltip 闪烁问题**
  - 统一断点检测逻辑（StatusTable 和 heatmapAggregator 都使用 960px）
  - 640-959px 平板区间不再出现卡片视图 + 未聚合热力图的不一致
  - 移动端禁用鼠标悬停事件，避免与触摸事件冲突

### 技术改进
- **浏览器兼容性**
  - Safari ≤13: `addListener/removeListener` API 自动回退
  - 特性检测：`addEventListener` → `addListener` → 降级警告

- **性能优化**
  - 热力图数据聚合：模块级缓存，避免重复 matchMedia 初始化
  - HMR 监听器清理：`import.meta.hot.dispose()` 钩子
  - matchMedia 事件：仅在真正跨越断点时触发，而非每次像素变化

- **代码组织**
  - 集中断点定义：`BREAKPOINTS` 常量
  - 统一工具函数：`createMediaQueryEffect()`, `addMediaQueryListener()`
  - 类型安全：TypeScript 完整类型定义

---

## [2025-11-21]

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
