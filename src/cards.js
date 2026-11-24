/**
 * 卡片类型注册表：每种卡片独立数据源，统一由 App.vue 的网格渲染。
 * fields：编辑抽屉里的表单字段（kind: text | textarea | select）。
 */
export const CARD_TYPES = [
  { type: 'weather', name: '天气', desc: '上海实时天气 + 未来 12 小时', color: 'var(--cyan)', w: 4, h: 3, fields: [] },
  { type: 'system', name: '服务器状态', desc: 'CPU、内存、磁盘、运行时间、公网 IP', color: 'var(--emerald)', w: 4, h: 3, fields: [] },
  { type: 'docker', name: 'Docker 容器', desc: 'VPS 上的容器列表与状态', color: 'var(--violet)', w: 4, h: 3, fields: [] },
  { type: 'uptime', name: '站点监测', desc: '三个站点的在线状态与延迟', color: 'var(--emerald)', w: 4, h: 2, fields: [] },
  { type: 'crypto', name: '加密货币', desc: 'BTC / ETH / SOL 价格与 24h 涨跌', color: 'var(--amber)', w: 4, h: 2, fields: [] },
  { type: 'rates', name: '汇率', desc: '美元兑人民币、欧元、港币、日元', color: 'var(--blue)', w: 4, h: 2, fields: [] },
  { type: 'github', name: '我的 GitHub 仓库', desc: '三个仓库的 star / fork / 最新提交', color: '#111827', w: 6, h: 3, fields: [] },
  { type: 'trending', name: 'GitHub 本周趋势', desc: '近 7 天新建、star 最多的仓库', color: 'var(--rose)', w: 6, h: 3, fields: [] },
  { type: 'news', name: '科技资讯', desc: 'Hacker News + 少数派 RSS', color: 'var(--violet)', w: 6, h: 3, fields: [] },
  { type: 'chart', name: '趋势图表', desc: '本机每 30 秒采样的 CPU / 内存曲线', color: 'var(--blue)', w: 6, h: 3,
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
  { type: 'rss', name: 'RSS 资讯', desc: '任意 RSS 订阅源，后端代理拉取', color: 'var(--violet)', w: 6, h: 3,
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
  if (type === 'chart') config.metric = 'load'
  if (type === 'iframe') config.height = 320
  return {
    i: `${type}-${Date.now()}-${seq}`,
    x: 0, y: 0, w: def.w, h: def.h,
    type, title: def.name, config
  }
}

export const DEFAULT_LAYOUT = [
  { i: 'weather-1', x: 0, y: 0, w: 4, h: 3, type: 'weather', title: '上海天气', config: {} },
  { i: 'system-1', x: 4, y: 0, w: 4, h: 3, type: 'system', title: '服务器状态', config: {} },
  { i: 'docker-1', x: 8, y: 0, w: 4, h: 3, type: 'docker', title: 'Docker 容器', config: {} },
  { i: 'uptime-1', x: 0, y: 3, w: 4, h: 2, type: 'uptime', title: '站点监测', config: {} },
  { i: 'crypto-1', x: 4, y: 3, w: 4, h: 2, type: 'crypto', title: '加密货币', config: {} },
  { i: 'rates-1', x: 8, y: 3, w: 4, h: 2, type: 'rates', title: '汇率 · 美元', config: {} },
  { i: 'github-1', x: 0, y: 5, w: 6, h: 3, type: 'github', title: '我的 GitHub 仓库', config: {} },
  { i: 'trending-1', x: 6, y: 5, w: 6, h: 3, type: 'trending', title: 'GitHub 本周趋势', config: {} },
  { i: 'news-1', x: 0, y: 8, w: 6, h: 3, type: 'news', title: '科技资讯', config: {} },
  { i: 'chart-1', x: 6, y: 8, w: 6, h: 3, type: 'chart', title: '服务器趋势', config: { metric: 'load' } },
  { i: 'text-1', x: 0, y: 11, w: 6, h: 2, type: 'text', title: '关于这个看板', config: { text: '老王数据看板：天气、服务器、Docker、站点、GitHub、行情、资讯，一屏尽览。右上角「编辑布局」可以拖动、放大缩小、添加和删除卡片。', links: '订阅转换|https://sub.199060.xyz/\n老王导航|http://67.215.229.127:8080/\nGitHub|https://github.com/tony-wang1990' } },
  { i: 'metric-1', x: 6, y: 11, w: 6, h: 2, type: 'metric', title: '关键指标', config: { metrics: 'load,mem,uptime,ip' } },
  { i: 'rss-1', x: 0, y: 13, w: 6, h: 3, type: 'rss', title: '少数派 RSS', config: { url: 'https://sspai.com/feed' } },
  { i: 'quicklinks-1', x: 6, y: 13, w: 6, h: 2, type: 'quicklinks', title: '快捷入口', config: {} },
  { i: 'notes-1', x: 6, y: 15, w: 6, h: 2, type: 'notes', title: '备忘小记', config: {} }
]
