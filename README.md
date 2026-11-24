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

## 服务器看板（KPanel 风格，v1）

顶部导航点 **「服务器看板」** 进入，和数据看板首页分开：首页是轻量展示，服务器看板是本机监控——只看不改。

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
| `GET /api/news` | Hacker News 热门 + 少数派文章 |
| `GET /api/history` | 本机每 30 秒采样的 CPU / 内存趋势（图表卡片用） |
| `GET /api/ip` | 公网 IP 与归属地（ip-api.com） |
| `GET /api/rss?url=…` | 任意 RSS 订阅源代理拉取 |
| `GET /api/proxy?url=…` | 任意 http(s) 接口代理（自定义 API 卡片用，5 秒超时） |
| `GET / POST /api/layout` | 看板布局：GET 只读（存 `data/layout.json` 的最后一次保存）；POST 已关闭，布局只保存在浏览器 localStorage |
| `GET /api/ops/metrics?range=1h\|6h\|24h` | 服务器看板监控历史曲线（后端 10 秒采样） |
| `GET /api/ops/host` | 服务器看板主机信息 |
| `GET /api/ops/docker` | 容器列表 + CPU/内存占用 |
| `GET /api/ops/images` | 镜像列表（只读） |
| `GET /api/ops/processes` | Top 进程（只读） |
| `GET /api/ops/disk` | 挂载点用量 + 大目录 Top 10 |
| `GET /api/ops/docker/:id/logs` | 容器最近 200 行日志（只读） |
| `GET /api/quote` | 一言 |

接口返回统一为 `{ ok: true, data, at }`，失败时 `{ ok: false, error }`。

## 自定义

- 改监测站点：编辑 `server.js` 里的 `UPTIME_TARGETS`。
- 改 GitHub 仓库：编辑 `server.js` 里的 `GH_REPOS`。
- 改城市：编辑 `server.js` 里 Open-Meteo 的经纬度（默认上海 31.23, 121.47）。
- 改快捷入口：编辑 `src/components/QuickLinks.vue`。

## License

MIT
