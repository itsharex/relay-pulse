# relaypulse.top 生产部署指南

## 目标环境

- **域名**: `relaypulse.top`
- **仓库**: https://github.com/prehisle/relay-pulse.git
- **服务**: Go 服务监听 8080（`cmd/server/main.go`），通过 embed 提供前端静态资源 + API（`/api/status`、`/health`）
- **前端**: React + Vite 构建后嵌入到 Go 二进制文件中
- **数据层**: 默认 SQLite，可切换 PostgreSQL
- **CDN**: Cloudflare 提供 HTTPS、缓存、DDoS 防护

## 部署架构

```
[客户端]
    ↓ HTTPS
[Cloudflare CDN/WAF]
    ↓ HTTP :80
[Go 服务 :8080]
    ├─ 静态资源 (embed FS)
    ├─ API 接口 (/api/*)
    ├─ 健康检查 (/health)
    ├─ Gzip 压缩
    └─ 安全头 (HSTS, X-Frame-Options 等)
    ↓
[SQLite/PostgreSQL]
```

**说明**：
- Cloudflare 终止 HTTPS，转发 HTTP 请求到 Go 服务
- Go 服务直接提供所有静态资源和 API，无需额外的反向代理
- 防火墙限制只允许 Cloudflare IP 访问 80 端口

## 前置准备

### 1. 必备文件清单

| 文件 | 作用 | 备注 |
|------|------|------|
| `config.production.yaml` | 非敏感配置 | 从 `config.yaml.example` 复制 |
| `deploy/relaypulse.env` | 环境变量（密钥） | **必须加入 .gitignore** |
| `frontend/.env.production` | 前端 API 地址 | 设置为 `https://relaypulse.top` |
| `monitor/` 目录 | SQLite/WAL、日志 | 需持久化挂载 |

### 2. 创建配置文件

```bash
# 复制配置模板
cp config.yaml.example config.production.yaml
cp deploy/relaypulse.env.example deploy/relaypulse.env

# 编辑生产环境变量（添加真实 API Key）
vim deploy/relaypulse.env
```

### 3. 准备数据目录

```bash
mkdir -p monitor
touch monitor/monitor.db monitor/monitor.log
chmod 700 monitor
```

## 部署方式

### 方式一：Docker Compose（推荐）

#### 1. 拉取镜像

```bash
docker pull ghcr.io/prehisle/relay-pulse:latest
```

#### 2. 启动服务

**SQLite 模式**:
```bash
docker compose --env-file deploy/relaypulse.env up -d monitor
```

**PostgreSQL 模式**:
```bash
# 先在 deploy/relaypulse.env 中设置:
# MONITOR_STORAGE_TYPE=postgres
# MONITOR_POSTGRES_HOST=postgres
# MONITOR_POSTGRES_PORT=5432
# MONITOR_POSTGRES_USER=monitor
# MONITOR_POSTGRES_PASSWORD=your_password
# MONITOR_POSTGRES_DATABASE=monitor

docker compose --env-file deploy/relaypulse.env up -d postgres monitor-pg
```

#### 3. 查看日志

```bash
docker compose logs -f monitor        # SQLite 模式
docker compose logs -f monitor-pg     # PostgreSQL 模式
```

#### 4. 验证运行

```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/status
```

### 方式二：Systemd + 二进制

#### 1. 编译后端

```bash
go build -o monitor ./cmd/server
```

#### 2. 部署到服务器

```bash
# 创建部署目录
sudo mkdir -p /opt/relay-pulse/{config,monitor}
sudo useradd -r -s /bin/false monitor

# 复制文件
sudo cp monitor /opt/relay-pulse/
sudo cp config.production.yaml /opt/relay-pulse/config/
sudo chown -R monitor:monitor /opt/relay-pulse
```

#### 3. 创建环境变量文件

```bash
sudo vim /etc/relay-pulse.env
```

内容参考 `deploy/relaypulse.env.example`。

#### 4. 创建 Systemd 单元

创建 `/etc/systemd/system/relay-pulse.service`:

```ini
[Unit]
Description=Relay Pulse Monitor
After=network.target

[Service]
Type=simple
User=monitor
WorkingDirectory=/opt/relay-pulse
EnvironmentFile=/etc/relay-pulse.env
ExecStart=/opt/relay-pulse/monitor /opt/relay-pulse/config/config.production.yaml
Restart=always
RestartSec=10
LimitNOFILE=4096

# 安全加固
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/relay-pulse/monitor

[Install]
WantedBy=multi-user.target
```

#### 5. 启动服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable relay-pulse.service
sudo systemctl start relay-pulse.service
sudo systemctl status relay-pulse.service
```

#### 6. 查看日志

```bash
sudo journalctl -u relay-pulse.service -f
```

## Cloudflare 配置

### 1. DNS 设置

登录 Cloudflare 控制台，为域名 `relaypulse.top` 添加 A 记录：

```
类型: A
名称: @ (或 relaypulse)
IPv4地址: <服务器公网IP>
代理状态: 已代理 (橙色云朵)
TTL: 自动
```

**重要**：必须开启代理（橙色云朵），这样流量才会经过 Cloudflare 的 CDN 和 WAF。

### 2. SSL/TLS 设置

在 Cloudflare 控制台 → SSL/TLS → 概述：

- **加密模式**：选择 **"灵活"（Flexible）**
  - Cloudflare ↔ 客户端：HTTPS（由 Cloudflare 提供证书）
  - Cloudflare ↔ 源服务器：HTTP
  - 适用于当前架构（Go 服务提供 HTTP）

- **（可选）未来升级到"完全"或"完全（严格）"**：
  - 需要为 Go 服务配置 TLS 证书（Let's Encrypt）
  - 更安全，但需要额外配置

### 3. 缓存配置

在 Cloudflare 控制台 → 缓存配置 → 配置：

**页面规则（Page Rules）**：

1. **缓存静态资源**：
   ```
   URL: relaypulse.top/assets/*
   设置: 缓存级别 = 缓存所有内容, 浏览器缓存TTL = 1年
   ```

2. **绕过API缓存**：
   ```
   URL: relaypulse.top/api/*
   设置: 缓存级别 = 绕过
   ```

3. **绕过健康检查缓存**：
   ```
   URL: relaypulse.top/health
   设置: 缓存级别 = 绕过
   ```

### 4. 防火墙设置（服务器端）

**关键**：限制服务器只接受来自 Cloudflare 的流量，阻止直接访问：

```bash
# Ubuntu/Debian (UFW)
sudo ufw default deny incoming
sudo ufw allow ssh

# 允许 Cloudflare IPv4 地址段
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do
    sudo ufw allow from $ip to any port 80 proto tcp
done

# 允许 Cloudflare IPv6 地址段（可选）
for ip in $(curl -s https://www.cloudflare.com/ips-v6); do
    sudo ufw allow from $ip to any port 80 proto tcp
done

sudo ufw enable
sudo ufw status
```

**CentOS/RHEL (firewalld)**：
```bash
# 创建 Cloudflare IP 集合
sudo firewall-cmd --permanent --new-ipset=cloudflare --type=hash:net
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do
    sudo firewall-cmd --permanent --ipset=cloudflare --add-entry=$ip
done

sudo firewall-cmd --permanent --zone=public --add-rich-rule='rule family="ipv4" source ipset="cloudflare" port port="80" protocol="tcp" accept'
sudo firewall-cmd --reload
```

### 5. 安全与性能优化（可选）

在 Cloudflare 控制台配置：

- **安全** → **WAF（Web应用防火墙）**：启用托管规则
- **安全** → **速率限制**：限制 API 请求频率（如 `/api/*` 每分钟100次）
- **速度** → **自动压缩**：已由 Go 服务提供 Gzip，可禁用避免重复压缩
- **速度** → **Rocket Loader**：禁用（避免与 React SPA 冲突）
- **速度** → **自动缩小**：启用 JS/CSS/HTML 缩小

### 6. 验证配置

```bash
# 1. 测试 Cloudflare DNS 解析
dig relaypulse.top

# 2. 测试 HTTPS 访问（应返回200）
curl -I https://relaypulse.top

# 3. 验证流量经过 Cloudflare（检查响应头）
curl -I https://relaypulse.top | grep -i "cf-ray"

# 4. 测试直接访问源服务器（应被防火墙拒绝）
curl -I http://<服务器IP>:80
```

## 环境变量说明

### 后端环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `MONITOR_<PROVIDER>_<SERVICE>_API_KEY` | 各服务商 API 密钥 | `MONITOR_88CODE_CC_API_KEY=sk-xxx` |
| `MONITOR_STORAGE_TYPE` | 存储类型 | `sqlite` 或 `postgres` |
| `MONITOR_SQLITE_PATH` | SQLite 数据库路径 | `monitor/monitor.db` |
| `MONITOR_POSTGRES_HOST` | PostgreSQL 主机 | `localhost` 或 `postgres` |
| `MONITOR_POSTGRES_PORT` | PostgreSQL 端口 | `5432` |
| `MONITOR_POSTGRES_USER` | PostgreSQL 用户 | `monitor` |
| `MONITOR_POSTGRES_PASSWORD` | PostgreSQL 密码 | `your_password` |
| `MONITOR_POSTGRES_DATABASE` | PostgreSQL 数据库名 | `monitor` |
| `MONITOR_POSTGRES_SSLMODE` | PostgreSQL SSL 模式 | `require` 或 `disable` |
| `TZ` | 时区 | `Asia/Shanghai` |
| `MONITOR_CORS_ORIGINS` | 额外允许的 CORS 来源 | 逗号分隔，仅开发环境使用 |

### 前端环境变量

| 变量 | 说明 | 值 |
|------|------|-----|
| `VITE_API_BASE_URL` | API 基础地址 | `https://relaypulse.top` |
| `VITE_USE_MOCK_DATA` | 是否使用模拟数据 | `false` |

## 安全加固

### 1. 密钥管理

- ✅ 所有 API Key 存储在环境变量中
- ✅ `deploy/relaypulse.env` 和 `/etc/relay-pulse.env` 必须加入 `.gitignore`
- ✅ 文件权限设置为 600: `chmod 600 /etc/relay-pulse.env`

### 2. CORS 配置

修改 `internal/api/server.go`，限制跨域来源：

```go
// 替换 cors.Default() 为:
config := cors.Config{
    AllowOrigins:     []string{"https://relaypulse.top"},
    AllowMethods:     []string{"GET", "OPTIONS"},
    AllowHeaders:     []string{"Origin", "Content-Type"},
    ExposeHeaders:    []string{"Content-Length"},
    AllowCredentials: false,
    MaxAge:           12 * time.Hour,
}
r.Use(cors.New(config))
```

### 3. HTTPS/TLS

- ✅ TLS 由 Cloudflare 终止，自动提供和续期证书
- ✅ Go 服务已启用 HSTS 头（由安全头中间件提供）
- ✅ 防火墙限制只允许 Cloudflare IP 访问源服务器
- ⚠️ 当前使用 Cloudflare "灵活"模式（Cloudflare↔源服务器为 HTTP）
- 🔒 （可选）升级到"完全"模式：需要为 Go 服务配置 TLS 证书

### 4. PostgreSQL 安全

- ✅ 使用 `sslmode=require` 或 `verify-full`
- ✅ 创建最小权限用户，仅授予必要权限
- ✅ 定期备份数据库

### 5. 日志轮转

创建 `/etc/logrotate.d/relay-pulse`:

```
/opt/relay-pulse/monitor/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 monitor monitor
}
```

## 部署验证清单

- [ ] `curl -I https://relaypulse.top/` 返回 200
- [ ] `curl https://relaypulse.top/api/status` 返回 JSON 数据
- [ ] `curl http://relaypulse.top/` 自动重定向到 HTTPS
- [ ] 浏览器访问 `https://relaypulse.top` 显示仪表板
- [ ] 检查 CORS 头：`Access-Control-Allow-Origin: https://relaypulse.top`
- [ ] 后端服务状态正常：`systemctl status relay-pulse` 或 `docker compose ps`
- [ ] 数据库有数据：`sqlite3 monitor/monitor.db 'SELECT COUNT(*) FROM probe_history;'`
- [ ] 配置热更新生效：修改 `config.production.yaml`，观察日志 `[Config] 热更新成功`

## 监控与维护

### 查看运行状态

```bash
# Systemd
sudo systemctl status relay-pulse
sudo journalctl -u relay-pulse -f --since "1 hour ago"

# Docker Compose
docker compose ps
docker compose logs -f monitor --tail=100
```

### 数据备份

**SQLite**:
```bash
# 备份数据库
sqlite3 monitor/monitor.db ".backup monitor.db.backup"

# 定时备份 (crontab)
0 2 * * * cd /opt/relay-pulse && sqlite3 monitor/monitor.db ".backup monitor/backup-$(date +\%Y\%m\%d).db"
```

**PostgreSQL**:
```bash
# 备份
pg_dump -h localhost -U monitor monitor > monitor_backup.sql

# 恢复
psql -h localhost -U monitor monitor < monitor_backup.sql
```

### 配置热更新

```bash
# 修改配置文件
vim config.production.yaml

# 无需重启，配置自动生效（观察日志确认）
# Systemd: journalctl -u relay-pulse -f
# Docker: docker compose logs -f monitor
```

### 更新部署

**Docker 方式**:
```bash
docker pull ghcr.io/prehisle/relay-pulse:latest
docker compose --env-file deploy/relaypulse.env up -d --force-recreate monitor
```

**Systemd 方式**:
```bash
# 编译新版本
go build -o monitor ./cmd/server

# 停止服务
sudo systemctl stop relay-pulse

# 替换二进制
sudo cp monitor /opt/relay-pulse/monitor

# 启动服务
sudo systemctl start relay-pulse
```

## 故障排查

### 后端无法启动

```bash
# 检查配置文件语法（程序启动时会自动验证）
./monitor config.production.yaml &
sleep 2
kill %1

# 检查端口占用
sudo netstat -tulpn | grep 8080

# 检查环境变量加载
sudo systemctl show relay-pulse --property=Environment
```

### API 返回 404

```bash
# 检查后端路由
curl http://localhost:8080/health

# 检查 Nginx 配置
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### CORS 错误

```bash
# 检查响应头
curl -I https://relaypulse.top/api/status

# 确认 CORS 配置已更新
grep -A 5 "cors.Config" internal/api/server.go
```

### 数据库连接失败

```bash
# SQLite: 检查文件权限
ls -la monitor/monitor.db

# PostgreSQL: 测试连接
psql -h localhost -U monitor -d monitor
```

## 性能优化

### 1. HTTP/2 和 HTTP/3

- ✅ Cloudflare 自动启用 HTTP/2 和 HTTP/3（QUIC）
- ✅ 无需额外配置

### 2. Gzip 压缩

- ✅ Go 服务已通过中间件启用 Gzip 压缩（`internal/api/server.go`）
- ⚠️ Cloudflare 的"自动压缩"可能与 Go 的 Gzip 冲突，建议在 Cloudflare 控制台关闭"自动压缩"

### 3. CDN 和缓存

- ✅ Cloudflare 本身就是全球 CDN
- ✅ 通过页面规则配置静态资源缓存（参见"Cloudflare 配置"章节）
- ✅ API 请求不缓存（已配置绕过）

### 4. 数据库优化

**SQLite**:
- 已启用 WAL 模式（并发读优化）
- 定期执行 `VACUUM` 清理

**PostgreSQL**:
- 调整连接池大小（`config.postgres.example.yaml`）
- 创建索引：`CREATE INDEX idx_timestamp ON probe_history(timestamp);`

## 相关文档

- [项目 README](../README.md)
- [配置文件说明](../config.yaml.example)
- [PostgreSQL 配置](../config.postgres.example.yaml)
- [贡献指南](../CONTRIBUTING.md)
