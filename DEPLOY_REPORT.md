# laowang-dashboard 部署报告（2026-11-24）

## 部署状态：已上线

- **VPS 地址**：http://67.215.229.127:38082/（首页 200，标题“老王数据看板 · LaoWang Dashboard”）
- **容器**：`laowang-dashboard`（node:20-alpine），`restart: unless-stopped`，宿主机端口 38082 → 容器 3000
- **代码位置**：VPS `/opt/laowang-dashboard`；本地 `~/workspace/laowang-dashboard/`

## 验证结果（2026-11-24 10:41 CST，从云电脑 curl）

- 首页 200；`/healthz` ok
- `/api/system`：Intel Xeon E5-2699 v4、1 核、961MB、运行 34 天、磁盘 20GB/37.7%、IP 67.215.229.127
- `/api/docker`：5 个容器（dashboard、converter、nav、NPM、watchtower），带 CPU/内存占用
- `/api/uptime`：sub.199060.xyz、nav:8080、converter:38081 全部在线（~300–470ms）
- `/api/weather`：Open-Meteo，上海 8°C 晴，未来 12 小时
- `/api/crypto`：BTC $59,764、ETH $1,683、SOL $70.50（CoinGecko）
- `/api/rates`：$1 = ¥6.66，EUR/HKD/JPY（Frankfurter）
- `/api/github`：converter 80★、subscription 55★、nav 40★，含最近提交
- `/api/news`：Hacker News + 少数派 RSS；`/api/quote`：一言
- 运维 API：`/api/ops/metrics` 采样累积中；`/api/ops/host` 真实主机信息；`/api/ops/docker` 5 容器；
  `/api/ops/processes` 通过 /proc 双采样计算 CPU%（Alpine BusyBox ps 不支持 --sort，已改读 /proc）；
  `/api/ops/disk`：根挂载 20GB/37.7%，Docker 占用 3939MB，大目录后台 du 统计中（10 分钟缓存）；
  `/api/ops/images` 列出镜像；未登录调日志接口返回 401；真实 ADMIN_PASSWORD 登录返回 200 + httpOnly cookie
- 截图已验证：首页卡片单层（无嵌套），运维登录页正常

## GitHub：待处理（已阻塞）

- 仓库 `tony-wang1990/laowang-dashboard` **尚未创建**：连接器 `create_repository` 返回
  **403 "Resource not accessible by integration"**（GitHub App token 无建仓权限）。
  需通过 GitHub 网页端创建空公开仓库后，再用连接器 snapshot push 推送全部文件（约 37 个文件，
  含 server.js、dist/、README、LICENSE、Dockerfile、docker-compose.yml）。
- 本地 git 仓库已初始化，尚未提交（无 remote）。

## 安全

- 运维 ADMIN_PASSWORD：随机 24 字节 hex，**只存在 VPS `/opt/laowang-dashboard/.env`（chmod 600）**，
  未写入任何仓库文件、未写入记忆。请主 agent 转交给 yatao。
- 写操作（启停容器、清理镜像、看日志）均需登录；只读查询公开。

## 已知小事

- metrics 历史刚随容器重启重置，需随时间累积到 24h；大目录 du 首次统计需几十秒，
  期间接口返回 `scanning: true`，缓存 10 分钟。
- 截图里的“已保存”时间是 headless 浏览器本地保存的布局时间戳，无碍。
