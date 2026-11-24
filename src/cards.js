/**
 * 卡片类型注册表：每种卡片独立数据源，统一由 App.vue 的网格渲染。
 * fields：编辑抽屉里的表单字段（kind: text | textarea | select）。
 */
export const CARD_TYPES = [
  { type: 'weather', name: '天气', desc: '上海实时天气 + 未来 12 小时', color: 'var(--cyan)', w: 4, h: 3, fields: [] },
  { type: 'system', name: '服务器状态', desc: 'CPU、内存、磁盘、运行时间、公网 IP', color: 'var(--emerald)', w: 4, h: 3, fields: [] },
  { type: 'docker', name: 'Docker 容器', desc: 'VPS 上的容器列表与状态', color: 'var(--violet)', w: 4, h: 3, fields: [] },
  { type: 'uptime', name: '站点监测', desc: '三个站点的在线状态与延迟', color: 'var(--emerald)', w: 4, h: 2, fields: [] },
  { type: 'crypto', name: '加密货币', desc: 'BTC / ETH / SOL 价格与 24h 涨跌', color: 'var(--amber)', w: 4, h: 3, fields: [] },
  { type: 'rates', name: '汇率', desc: '美元兑人民币、欧元、港币、日元', color: 'var(--blue)', w: 4, h: 3, fields: [] },
  { type: 'github', name: '我的 GitHub 仓库', desc: '三个仓库的 star / fork / 最新提交', color: '#111827', w: 6, h: 4, fields: [] },
  { type: 'trending', name: 'GitHub 本周趋势', desc: '近 7 天新建、star 最多的仓库', color: 'var(--rose)', w: 6, h: 4, fields: [] },
  { type: 'news', name: '科技资讯', desc: 'Hacker News + 少数派 RSS', color: 'var(--violet)', w: 6, h: 4, fields: [] },
  { type: 'chart', name: '趋势图表', desc: '本机每 30 秒采样的 CPU / 内存曲线', color: 'var(--blue)', w: 6, h: 4,
    fields: [
      { key: 'metric', label: '指标', kind: 'select', options: [{ v: 'load', n: 'CPU 负载' }, { v: 'mem', n: '内存占用 %' }] }
    ] },
  { type: 'text', name: '文本 / 链接卡片', desc: '写段文字，放几个链接（兼容导航需求）', color: 'var(--cyan)', w: 6, h: 2,
    fields: [
      { key: 'text', label: '文字内容', kind: 'textarea', placeholder: '写点介绍、说明…' },
      { key: 'links', label: '链接（每行一个，格式：名称|https://…）', kind: 'textarea', placeholder: '订阅转换|https://sub.199060.xyz/\n老王导航|http://67.215.229.127:8080/' }
    ] },
  { type: 'metric', name: '数字指标', desc: '负载、内存、磁盘、IP 等大数字展示', color: 'var(--emerald)', w: 6, h: 2,
    fields: [
      { key: 'metrics', label: '指标（逗号分隔，可选 load / mem / disk / uptime / ip / docker）', kind: 'text', placeholder: 'load,mem,uptime,ip' }
    ] },
  { type: 'stat', name: '单项指标', desc: 'KPanel 式：一个指标一张卡，带进度条', color: 'var(--blue)', w: 2, h: 2,
    fields: [
      { key: 'metric', label: '指标', kind: 'select', options: [
        { v: 'cpu', n: 'CPU 使用率' }, { v: 'mem', n: '内存占用' }, { v: 'disk', n: '系统盘占用' },
        { v: 'load', n: '1 分钟负载' }, { v: 'net', n: '实时网络' }
      ] }
    ] },
  { type: 'statstrip', name: '实时指标条', desc: 'CPU / 内存 / 磁盘 / 负载 / 网络，一整条大数字', color: 'var(--blue)', w: 12, h: 2, fields: [] },
  { type: 'rss', name: 'RSS 资讯', desc: '任意 RSS 订阅源，后端代理拉取', color: 'var(--violet)', w: 6, h: 4,
    fields: [
      { key: 'url', label: 'RSS 地址', kind: 'text', placeholder: 'https://sspai.com/feed' }
    ] },
  { type: 'custom', name: '自定义 API', desc: '填任意接口地址，自动解析 JSON 展示', color: 'var(--amber)', w: 6, h: 3,
    fields: [
      { key: 'url', label: '接口地址（http/https）', kind: 'text', placeholder: 'https://api.example.com/data' },
      { key: 'field', label: '字段路径（点号，如 data.price；留空展示整个 JSON）', kind: 'text', placeholder: 'data.price' }
    ] },
  { type: 'iframe', name: '内嵌页面', desc: '把别的页面 / 监控页嵌进来', color: 'var(--blue)', w: 6, h: 3,
    fields: [
      { key: 'url', label: '页面地址', kind: 'text', placeholder: 'https://example.com/' },
      { key: 'height', label: '高度（像素）', kind: 'text', placeholder: '320' }
    ] },
  { type: 'quicklinks', name: '快捷入口', desc: '常用链接一排', color: 'var(--cyan)', w: 6, h: 2, fields: [] },
  { type: 'notes', name: '备忘小记', desc: '写了就保存在本机浏览器', color: 'var(--amber)', w: 6, h: 2, fields: [] }
]

export function cardTypeOf(type) {
  return CARD_TYPES.find((c) => c.type === type) || CARD_TYPES[0]
}

let seq = 0
export function newCard(type) {
  const def = cardTypeOf(type)
  seq += 1
  const config = {}
  if (type === 'text') config.text = '这是一个文本卡片，点右上角编辑可以改文字、加链接。'
  if (type === 'rss') config.url = 'https://sspai.com/feed'
  if (type === 'metric') config.metrics = 'load,mem,uptime,ip'
  if (type === 'stat') config.metric = 'cpu'
  if (type === 'chart') config.metric = 'load'
  if (type === 'iframe') config.height = 320
  return {
    i: `${type}-${Date.now()}-${seq}`,
    x: 0, y: 0, w: def.w, h: def.h,
    type, title: def.name, config
  }
}

// 实时指标条：一整条通栏大数字（5 个指标一排），替代原来 5 张分开的
// 单指标卡——分开摆会在 12 列里左右各留 1 列空隙、窄屏还会排错行。
// App.vue 的布局迁移会把旧的 stat-* 换成它；单张 stat 卡仍可单独添加。
export const STAT_STRIP = { i: 'statstrip-1', x: 0, y: 14, w: 12, h: 2, type: 'statstrip', title: '实时指标', config: {} }

// KPanel 式单指标卡：5 张一排（12 列网格里左右各留 1 列，看着居中）。
// App.vue 的布局迁移用同一份定义，老布局里的 metric-1 会被它替换。
export const STAT_CARDS = [
  { i: 'stat-cpu', x: 1, y: 13, w: 2, h: 2, type: 'stat', title: 'CPU', config: { metric: 'cpu' } },
  { i: 'stat-mem', x: 3, y: 13, w: 2, h: 2, type: 'stat', title: '内存', config: { metric: 'mem' } },
  { i: 'stat-disk', x: 5, y: 13, w: 2, h: 2, type: 'stat', title: '系统盘', config: { metric: 'disk' } },
  { i: 'stat-load', x: 7, y: 13, w: 2, h: 2, type: 'stat', title: '1 分钟负载', config: { metric: 'load' } },
  { i: 'stat-net', x: 9, y: 13, w: 2, h: 2, type: 'stat', title: '实时网络', config: { metric: 'net' } }
]

export const DEFAULT_LAYOUT = [
  { i: 'weather-1', x: 0, y: 0, w: 4, h: 3, type: 'weather', title: '上海天气', config: {} },
  { i: 'system-1', x: 4, y: 0, w: 4, h: 3, type: 'system', title: '服务器状态', config: {} },
  { i: 'docker-1', x: 8, y: 0, w: 4, h: 3, type: 'docker', title: 'Docker 容器', config: {} },
  // 站点监测 / 加密货币 / 汇率同一行都 h=3，底部平齐（以前 uptime 只有 h=2）
  { i: 'uptime-1', x: 0, y: 3, w: 4, h: 3, type: 'uptime', title: '站点监测', config: {} },
  { i: 'crypto-1', x: 4, y: 3, w: 4, h: 3, type: 'crypto', title: '加密货币', config: {} },
  { i: 'rates-1', x: 8, y: 3, w: 4, h: 3, type: 'rates', title: '汇率 · 美元', config: {} },
  // 列表类卡片实测内容约 440px，需要 h=4（每行约 45px，8 条约 360px + 标题 + 内边距）
  { i: 'github-1', x: 0, y: 6, w: 6, h: 4, type: 'github', title: '我的 GitHub 仓库', config: {} },
  { i: 'trending-1', x: 6, y: 6, w: 6, h: 4, type: 'trending', title: 'GitHub 本周趋势', config: {} },
  { i: 'news-1', x: 0, y: 10, w: 6, h: 4, type: 'news', title: '科技资讯', config: {} },
  { i: 'chart-1', x: 6, y: 10, w: 6, h: 4, type: 'chart', title: '服务器趋势', config: { metric: 'load' } },
  { ...STAT_STRIP, config: { ...STAT_STRIP.config } },
  { i: 'text-1', x: 0, y: 16, w: 6, h: 2, type: 'text', title: '关于这个看板', config: { text: '老王数据看板：天气、服务器、Docker、站点、GitHub、行情、资讯，一屏尽览。右上角「编辑布局」可以拖动、放大缩小、添加和删除卡片。', links: '订阅转换|https://sub.199060.xyz/\n老王导航|http://67.215.229.127:8080/\nGitHub|https://github.com/tony-wang1990' } },
  { i: 'rss-1', x: 0, y: 18, w: 6, h: 4, type: 'rss', title: '少数派 RSS', config: { url: 'https://sspai.com/feed' } },
  { i: 'quicklinks-1', x: 6, y: 16, w: 6, h: 3, type: 'quicklinks', title: '快捷入口', config: {} },
  { i: 'notes-1', x: 6, y: 18, w: 6, h: 2, type: 'notes', title: '备忘小记', config: {} }
]
