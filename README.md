# 老王数据看板 · LaoWang Dashboard

一个现代化、模块化的数据集成看板：浅色简约设计，大气圆角卡片，一屏尽览天气、服务器、Docker、站点监测、GitHub、行情、资讯。

![License](https://img.shields.io/badge/license-MIT-green)
![Vue](https://img.shields.io/badge/Vue-3.5-42b883)
![Node](https://img.shields.io/badge/Node-%3E%3D18-339933)

**开箱即用，零 key、零付费、零注册**：所有默认数据源都是免费免 key 的公开接口，部署完直接就能用。

## 布局：自由拖拽

- 点右上角 **「编辑布局」** 进入编辑模式：按住卡片标题栏拖动位置，拖右下角调整大小。
- **＋ 添加卡片**：从 17 种卡片类型里选，拼出自己的看板。
- 每张卡片右上角 **⚙** 可以编辑内容，**×** 删除卡片。
- 布局自动保存：先存浏览器 localStorage，同时同步到服务端 `data/layout.json`（`/api/layout`），换浏览器打开也能恢复。
- **恢复默认布局** 一键回到初始排布。

## 卡片类型

| 类型 | 数据来源 |
| --- | --- |
| 天气 | Open-Meteo（免费免 key；有和风 key 时可切和风，见下） |
| 烟台风力/停航 | Open-Meteo 预报（烟台陆地风 + 崆峒岛附近海面风）+ 海洋浪高 + 中央气象台预警，停航风险灯 |
| 服务器状态 | 后端系统信息 + 公网 IP（ip-api.com） |
| 数字指标 | 负载、内存、磁盘、运行时间、IP、容器数，大数字展示 |
| 趋势图表 | 后端每 30 秒采样本机 CPU / 内存，画折线图（真实采样，非模拟） |
| Docker 容器 | 后端 `docker ps` |
| 站点监测 | 后端主动探测三个站点 |
| 我的 GitHub 仓库 | GitHub 公开 API（免 key，后端缓存防限流） |
| GitHub 本周趋势 | GitHub Search API |
| 科技资讯 | Hacker News RSS + 少数派 RSS（后端代理） |
| RSS 资讯 | 任意 RSS 地址，可配置 |
| 加密货币 | CoinGecko 免费接口（BTC / ETH / SOL） |
| 汇率 | Frankfurter（欧洲央行数据，免费免 key） |
| 自定义 API | 任意 http(s) 接口，后端代理拉取，填字段路径自动解析 JSON |
| 内嵌页面 | iframe 嵌入别的页面 / 监控页，高度可调 |
| 文本 / 链接卡片 | 静态文字 + 多个链接（兼容原来导航站的需求） |
| 快捷入口 | 常用链接一排 |
| 备忘小记 | localStorage |
| 问候 + 时钟 + 搜索 | 顶部通栏，大时钟、日期星期、Bing 搜索、一言 |

- 前端每 60 秒轮询刷新，行情 / 天气每 5 分钟。
- 任何接口挂了都优雅降级：对应卡片显示“暂无数据”，绝不白屏、不报错刷屏。

### 烟台风力/停航卡

给烟台崆峒岛通勤用：陆岛航线海面持续风力大于 7 级停航。卡片显示烟台陆地风、海面风（崆峒岛附近海域，37.56, 121.51）、浪高、停航风险灯（持续风＜6 级绿、6–7 级黄、＞7 级红，阵风只展示、不定级）、未来 7 天每日最大持续风、海面风未来 12 小时、山东/烟台大风预警，底部有山东海事局、中央气象台预警页链接和烟台港客运电话 0535-6506666。天气卡点城市名或“切换城市”可快速换城市（和编辑抽屉里的城市字段同步）。

- 风险灯只看**海面持续风速**（阵风平时也常冲到 7–9 级，不能按阵风定级——否则天天标红、船基本开不了），卡上写明“以崆峒岛附近海面持续风速为准，阵风仅供参考；持续风 6–7 级有停航风险，＞7 级停航（陆岛航线参考，非官方通知）”。
- 海洋接口没有风，海面风用预报接口在崆峒岛坐标再算一次；浪高代表崆峒岛附近一带海况，不是岸边的精确值。
- 官方停航通知原文、海事局通知列表、微信公众号文章没有稳定可抓的公开来源，卡片里用风力阈值风险提示 + 跳转链接代替，出门前以海事局/客运公司通知为准。

天气卡也接了预警：每张天气卡按自己的城市查中央气象台预警（`?city=`），蓝/黄/橙/红按级别着色；国外城市查不到中国预警，显示“当前无生效预警”，不报错。

## 服务器看板（KPanel 风格，v1）

顶部导航点 **「服务器看板」** 进入，和数据看板首页分开：首页是轻量展示，服务器看板是本机监控——只看不改。

### 切换主机（多机查看）

服务器看板顶部有「查看主机」切换器（照天气卡换城市的样式：按钮 + 选择器），列出本机和 KPanel 集群里的轻节点（带在线状态）；选择存在浏览器 localStorage（`laowang-dashboard-ops-host`），下次打开还选这台。切换后主机信息、实时监控、Docker、进程、磁盘全部重新拉该主机的数据。

| 栏目 | 本机 | 集群轻节点 | 备注 |
| --- | --- | --- | --- |
| 主机信息 | ✅ 实时本机数据 | ✅ KPanel 快照（主机名、系统/内核、CPU、内存、磁盘、公网 IP） | 离线节点显示最后快照 |
| 实时监控 | ✅ 后端 10 秒采样，1h/6h/24h | ✅ KPanel 集群历史（约每 1 分钟一个点），轮询 30 秒 | 曲线形状与本机一致 |
| Docker 容器 / 进程 / 日志 | ✅ | ❌ 不支持远程查看 | KPanel 轻节点 API 未提供远程 Docker/进程接口；页面明确提示并提供「回本机」 |
| 磁盘 | ✅ 各挂载点 + 大目录 Top 10 | ⚠️ 只有根盘用量 | 大目录统计仅本机可用 |
| 站点监测 | ✅（与主机无关，始终是本机视角） | ✅ 同左 | — |

配置：在部署环境的 `.env` 里加 `KPANEL_URL`（面板地址，容器内必须用 VPS 公网 IP，如 `http://67.215.229.127:38083`，不能用 `127.0.0.1`）、`KPANEL_USER`、`KPANEL_PASS`。三个变量缺一不可，缺了就只列本机，本机功能一切照常；KPanel 挂了也不影响本机。`docker-compose.yml` 已把这三个变量透传进容器；**改了 `.env` 后要 `docker compose up -d` 重建容器才生效，光 `docker restart` 不够**（restart 不重新读环境变量）。登录拿 Session + CSRF，401 时自动重登一次；失败时接口返回明确错误，不崩。敏感信息不进前端：KPanel 快照里的登录记录等字段在服务端已过滤。

| 功能 | 说明 |
| --- | --- |
| 主机信息 | 主机名、系统/内核、运行时间、公网 IP、CPU 型号核心数、内存总量 |
| 实时监控 | CPU、内存、负载、上下行网速的实时数字 + 折线图；后端每 10 秒采样，保留 24 小时历史，前端可切 1h / 6h / 24h；数据放内存 + 每 5 分钟落盘 `data/metrics.json`，不引数据库 |
| Docker 容器 | 容器列表（名字、镜像、状态、CPU/内存占用、端口、运行时间），可查看最近 200 行日志；镜像列表只读展示 |
| 进程 | 按 CPU 排序的 Top 进程（只读） |
| 磁盘 | 各挂载点用量条 + 大目录占用 Top 10（`du` 采样，20 秒超时 + 10 分钟缓存，慢也不阻塞页面） |
| 站点监测 | 复用看板卡片：转换站、导航站、转换器直连的在线/延迟 |

### 只读，无需登录

服务器看板是公开的纯看板：所有接口只读，启停容器、清理镜像等写操作已从服务端彻底移除（不只是藏按钮），也不需要任何口令。真正的服务器操作（终端、文件管理、Nginx、Docker 启停）请用 KPanel（看板里的 KPanel 横幅，自带登录）。

布局保存在浏览器 localStorage；服务端 `data/layout.json` 只读（新浏览器首次打开时用它做 fallback，此后不再更新）。

### Roadmap（v1 之后再说）

- 网页终端
- 在线文件管理器
- Nginx 站点管理
- 应用市场（一键部署常用应用）
- 多主机集群管理
- AI 助手

## 数据来源（全部免费免 key）

| 数据 | 来源 | 说明 |
| --- | --- | --- |
| 天气 | Open-Meteo | 默认；卡片上会如实显示当前数据源 |
| 加密货币 | CoinGecko 公开接口 | 免 key |
| 汇率 | Frankfurter | 欧洲央行数据，免 key |
| 资讯 | RSS 直连 | Hacker News RSS（hnrss.org）、少数派 RSS，后端代理拉取 |
| GitHub | GitHub 公开 API | 免 key，后端缓存 |
| 一言 | hitokoto | 免 key |
| IP 信息 | ip-api.com | 免 key |
| 服务器 / Docker | 本机系统调用 | 无需外部接口 |

### 可选：和风天气

天气默认用 Open-Meteo，不需要任何 key。如已有和风天气 key，可设置环境变量启用（没有 key 时自动用 Open-Meteo）：

```bash
QWEATHER_KEY=你的key QWEATHER_HOST=devapi.qweather.com QWEATHER_LOCATION=101020100 npm start
```

卡片上会显示当前用的是「和风天气」还是「Open-Meteo」，不假装数据源。

## 本地运行

```bash
npm install
npm run build
npm start
# 打开 http://localhost:3000
```

开发模式（前端热更新，后端接口走代理）：

```bash
npm run dev     # 前端 :5173
npm start       # 后端 :3000（另开一个终端）
```

## Docker 部署

### 方式一：预构建产物（推荐，适合 1GB 内存小 VPS）

仓库里已提交构建好的 `dist/`，VPS 上不需要跑 `npm run build`：

```bash
git clone https://github.com/tony-wang1990/laowang-dashboard.git /opt/laowang-dashboard
cd /opt/laowang-dashboard
docker compose up -d
# 打开 http://服务器IP:38082
```

### 方式二：构建镜像

```bash
docker build -t laowang-dashboard .
docker run -d --name laowang-dashboard -p 38082:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  laowang-dashboard
```

## 接口说明

后端（`server.js`，零依赖，只用 Node 内置模块）既托管前端 `dist/`，又提供以下接口：

| 接口 | 说明 |
| --- | --- |
| `GET /healthz` | 健康检查，返回 `ok` |
| `GET /api/system` | CPU、内存、磁盘、负载、运行时间 |
| `GET /api/docker` | `docker ps` 容器列表 |
| `GET /api/uptime` | 三个站点的在线状态与延迟 |
| `GET /api/github` | 三个仓库的 star / fork / 最新提交 |
| `GET /api/trending` | GitHub 本周趋势仓库 |
| `GET /api/crypto` | BTC / ETH / SOL 价格与 24h 涨跌 |
| `GET /api/rates` | 美元汇率 |
| `GET /api/weather` | 上海天气与未来 12 小时 |
| `GET /api/weather?city=烟台` | 指定城市天气（Nominatim + Open-Meteo 地理编码，查不到回落上海） |
| `GET /api/yantai-wind` | 烟台陆地/海面风、浪高、停航风险、未来 7 天每日最大风 |
| `GET /api/warnings?city=烟台&province=山东&type=大风` | 中央气象台预警（按标题过滤城市/省份/类型；无预警返回空列表） |
| `GET /api/news` | Hacker News 热门 + 少数派文章 |
| `GET /api/history` | 本机每 30 秒采样的 CPU / 内存趋势（图表卡片用） |
| `GET /api/ip` | 公网 IP 与归属地（ip-api.com） |
| `GET /api/rss?url=…` | 任意 RSS 订阅源代理拉取 |
| `GET /api/proxy?url=…` | 任意 http(s) 接口代理（自定义 API 卡片用，5 秒超时） |
| `GET / POST /api/layout` | 看板布局：GET 只读（存 `data/layout.json` 的最后一次保存）；POST 已关闭，布局只保存在浏览器 localStorage |
| `GET /api/ops/hosts` | 主机列表（本机 + KPanel 集群主机，含在线状态；`kpanelConfigured` 指示是否配了 KPanel 凭据） |
| `GET /api/ops/metrics?range=1h\|6h\|24h&host=<id>` | 服务器看板监控历史曲线（本机：后端 10 秒采样；远程：KPanel 集群历史） |
| `GET /api/ops/host?host=<id>` | 服务器看板主机信息（`host` 省略或 `local` = 本机） |
| `GET /api/ops/docker?host=<id>` | 容器列表 + CPU/内存占用（远程主机不支持，返回明确错误） |
| `GET /api/ops/images?host=<id>` | 镜像列表（只读；远程主机不支持） |
| `GET /api/ops/processes?host=<id>` | Top 进程（只读；远程主机不支持） |
| `GET /api/ops/disk?host=<id>` | 挂载点用量 + 大目录 Top 10（远程主机只有根盘用量） |
| `GET /api/ops/docker/:id/logs?host=<id>` | 容器最近 200 行日志（只读；远程主机不支持） |
| `GET /api/quote` | 一言 |

接口返回统一为 `{ ok: true, data, at }`，失败时 `{ ok: false, error }`。

## 自定义

- 改监测站点：编辑 `server.js` 里的 `UPTIME_TARGETS`。
- 改 GitHub 仓库：编辑 `server.js` 里的 `GH_REPOS`。
- 改城市：编辑 `server.js` 里 Open-Meteo 的经纬度（默认上海 31.23, 121.47）。
- 改快捷入口：编辑 `src/components/QuickLinks.vue`。

## License

MIT
