/**
 * 老王数据看板 · 后端
 * 零依赖（只用 Node 内置模块），既托管前端 dist，又提供 /api/* 聚合接口。
 * 所有外部接口都有超时 + 优雅降级：挂了就返回 { ok:false }，前端显示“暂无数据”，绝不炸掉整页。
 *
 * 数据源全部是免费、免 key 的公开接口（开箱即用，零注册）：
 *   天气 Open-Meteo / 加密货币 CoinGecko / 汇率 Frankfurter /
 *   资讯 RSS 直连 / GitHub 公开 API / 一言 hitokoto / IP 信息 ip-api.com
 * 和风天气仅为可选配置：设置环境变量 QWEATHER_KEY 后才启用，否则用 Open-Meteo。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import dns from 'node:dns'
import net from 'node:net'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, 'dist')
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.HOST || '0.0.0.0'

// ---------- 小工具 ----------
const cache = new Map() // key -> { at, ttl, value }
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.value
  const value = await fn()
  cache.set(key, { at: Date.now(), ttl: ttlMs, value })
  return value
}

async function fetchJson(url, { timeoutMs = 8000, headers = {} } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchText(url, { timeoutMs = 8000, headers = {} } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

// ---------- SSRF 防护：用户可控 URL（/api/proxy、/api/rss）必须走 safeFetchText ----------
// 只拦内网/回环/保留地址 + 服务器自身出口 IP；公开接口不受影响。
// 注意：容器内 127.0.0.1 就是容器自身，所以只拦字面 127 段不够，必须 DNS 解析后按 IP 段拦截。
const MAX_BODY_BYTES = 1024 * 1024 // 响应体上限 1MB
const MAX_REDIRECTS = 3
let egressIp = process.env.PUBLIC_IP || null // 服务器出口 IP（动态学习，见 learnEgressIp）
let egressIpPromise = null
function learnEgressIp() {
  if (egressIp) return Promise.resolve(egressIp)
  if (!egressIpPromise) {
    // 与 /api/system 共用 'public-ip' 缓存；学不到也不阻塞请求
    egressIpPromise = cached('public-ip', 600_000, publicIp)
      .then((r) => { if (r?.ip) egressIp = r.ip; return egressIp })
      .catch(() => null)
  }
  return egressIpPromise
}

function ipIsBlocked(ip) {
  const v = net.isIP(ip)
  if (v === 4) {
    const [a, b, c] = ip.split('.').map(Number)
    if (a === 0) return true // 0.0.0.0/8
    if (a === 10) return true // 10/8
    if (a === 100 && b >= 64 && b <= 127) return true // 100.64/10 CGNAT
    if (a === 127) return true // 127/8 回环
    if (a === 169 && b === 254) return true // 169.254/16 链路本地
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12（含 docker 172.17/16、172.18/16）
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true // 192.0.0/24、192.0.2/24
    if (a === 192 && b === 168) return true // 192.168/16
    if (a === 198 && b === 51 && c === 100) return true // 198.51.100/24
    if (a === 203 && b === 0 && c === 113) return true // 203.0.113/24
    if (a >= 224) return true // 224/4 组播 + 240/4 保留
    return false
  }
  if (v === 6) {
    const low = ip.toLowerCase()
    const mapped = low.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/) // IPv4 映射地址按 v4 判断
    if (mapped) return ipIsBlocked(mapped[1])
    if (low === '::1' || low === '::') return true
    if (/^fe[89ab][0-9a-f]:/.test(low)) return true // fe80::/10 链路本地
    if (/^f[c-d][0-9a-f]/.test(low)) return true // fc00::/7 唯一本地
    if (low.startsWith('ff')) return true // ff00::/8 组播
    if (low.startsWith('2001:db8')) return true // 文档地址
    return false
  }
  return true // 不是合法 IP，保守拒绝
}

function ipIsSelf(ip) {
  if (egressIp && ip === egressIp) return true // 服务器出口公网 IP
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) if (a.address === ip) return true // 本机网卡地址
  }
  return false
}

// 校验一个 URL 是否允许对外请求：协议、凭据、DNS 解析出的每个 IP 都要过关
async function assertPublicUrl(rawUrl) {
  let u
  try { u = new URL(rawUrl) } catch { throw new Error('URL 无效') }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('只支持 http/https 地址')
  if (u.username || u.password) throw new Error('URL 不能带认证信息')
  // 出口 IP 学习最多等 800ms，学不到也不阻塞（私有段拦截仍在）
  await Promise.race([learnEgressIp(), new Promise((r) => setTimeout(r, 800))])
  const host = u.hostname
  if (net.isIP(host)) {
    if (ipIsBlocked(host) || ipIsSelf(host)) throw new Error('目标地址不允许访问（内网/本机地址）')
    return u
  }
  let addrs
  try {
    addrs = await dns.promises.lookup(host, { all: true })
  } catch {
    throw new Error('域名解析失败')
  }
  if (!addrs.length) throw new Error('域名解析失败')
  for (const a of addrs) {
    if (ipIsBlocked(a.address) || ipIsSelf(a.address)) {
      throw new Error('目标地址解析到内网/本机 IP，已拒绝')
    }
  }
  return u
}

// 带 SSRF 校验的安全 fetch：redirect 手动跟进（每跳重新校验，最多 3 次），响应体上限 1MB
async function safeFetchText(rawUrl, { timeoutMs = 8000, headers = {} } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    let current = await assertPublicUrl(rawUrl)
    let res = null
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      res = await fetch(current, { signal: ctrl.signal, headers, redirect: 'manual' })
      const loc = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && loc) {
        if (hop === MAX_REDIRECTS) throw new Error('重定向次数过多')
        try { await res.body?.cancel() } catch { /* 忽略 */ }
        current = await assertPublicUrl(new URL(loc, current).toString())
        continue
      }
      break
    }
    if (!res) throw new Error('请求失败')
    const contentType = res.headers.get('content-type') || ''
    const chunks = []
    let size = 0
    if (res.body) {
      for await (const chunk of res.body) {
        size += chunk.length
        if (size > MAX_BODY_BYTES) {
          try { await res.body.cancel() } catch { /* 忽略 */ }
          throw new Error('响应体超过 1MB 上限')
        }
        chunks.push(chunk)
      }
    }
    return { status: res.status, contentType, text: Buffer.concat(chunks).toString('utf-8') }
  } finally {
    clearTimeout(timer)
  }
}

function execTimeout(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve({ ok: false, error: String(err.message || err).slice(0, 200) })
      resolve({ ok: true, stdout })
    })
  })
}

function ok(data) { return { ok: true, data, at: new Date().toISOString() } }
function fail(error) { return { ok: false, error: String(error).slice(0, 200), at: new Date().toISOString() } }

function parseRss(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
  return items.map((m) => {
    const grab = (tag) => {
      const mm = m[1].match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`))
      return mm ? mm[1].trim() : ''
    }
    return { title: grab('title'), url: grab('link'), date: grab('pubDate') }
  }).filter((i) => i.title)
}

// ---------- /api/system ----------
// 容器里 os.hostname() 是容器 ID（如 262ec8bfcee3），不是宿主机名；
// docker-compose 把宿主机 / 只读挂在 /host，优先读宿主机的 /etc/hostname，
// 读不到（本地开发）再回落到 os.hostname()。只在启动时读一次。
let _hostName = null
function hostName() {
  if (_hostName) return _hostName
  try {
    const h = fs.readFileSync('/host/etc/hostname', 'utf8').trim()
    if (h) { _hostName = h; return h }
  } catch { /* 没有 /host 挂载时忽略 */ }
  _hostName = os.hostname()
  return _hostName
}
function systemInfo() {
  const cpus = os.cpus()
  const load = os.loadavg()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  return {
    hostname: hostName(),
    platform: os.platform(),
    arch: os.arch(),
    cpuModel: cpus[0]?.model?.trim() || 'unknown',
    cpuCount: cpus.length,
    load1: +load[0].toFixed(2),
    load5: +load[1].toFixed(2),
    load15: +load[2].toFixed(2),
    memTotalMB: Math.round(totalMem / 1024 / 1024),
    memUsedMB: Math.round((totalMem - freeMem) / 1024 / 1024),
    memUsedPct: +(((totalMem - freeMem) / totalMem) * 100).toFixed(1),
    uptimeSec: Math.floor(os.uptime()),
    node: process.version
  }
}

async function diskInfo() {
  // docker-compose 把宿主机 / 以只读挂在 /host，优先看宿主机磁盘；本地开发没有 /host 时看自身 /
  const target = fs.existsSync('/host') ? '/host' : '/'
  const r = await execTimeout('df', ['-k', target], 3000)
  if (!r.ok) return null
  const lines = r.stdout.trim().split('\n')
  const parts = (lines[1] || '').trim().split(/\s+/)
  if (parts.length < 5) return null
  const total = Number(parts[1]) * 1024
  const used = Number(parts[2]) * 1024
  return {
    totalGB: +(total / 1e9).toFixed(1),
    usedGB: +(used / 1e9).toFixed(1),
    usedPct: total ? +((used / total) * 100).toFixed(1) : 0
  }
}

async function publicIp() {
  try {
    const d = await fetchJson('http://ip-api.com/json/?fields=status,query,country,city,isp', { timeoutMs: 5000 })
    if (d.status !== 'success') return null
    return { ip: d.query, country: d.country, city: d.city, isp: d.isp }
  } catch { return null }
}

// 启动时后台学习出口 IP（供 SSRF 拦截用），学不到也不影响启动
learnEgressIp()

// ---------- 历史采样（图表卡片用）：每 30 秒采一次系统指标，保留最近 120 个点 ----------
// 数据来源：本机实时采样，不是模拟数据。服务刚启动时点数较少，随时间积累。
const history = []
function sampleHistory() {
  const s = systemInfo()
  history.push({ t: Date.now(), load1: s.load1, memPct: s.memUsedPct })
  if (history.length > 120) history.shift()
}
sampleHistory()
setInterval(sampleHistory, 30_000)

// ============================================================================
// 服务器看板块（/api/ops/*）：10 秒采样监控 + Docker 列表 + 进程/磁盘
// 监控数据放内存环形缓冲（24h，10s 一点）+ 每 5 分钟落盘 data/metrics.json，不引数据库。
// 全部接口只读、公开可看；启停容器、清理镜像等写操作已移除，登录也一并拿掉。
// ============================================================================
const METRICS_FILE = path.join(DATA_DIR, 'metrics.json')
let opsMetrics = [] // { t, cpu, mem, load1, diskPct, up, down } up/down 单位 B/s
let prevCpu = null
let prevNet = null

function cpuTimes() {
  const cpus = os.cpus()
  let idle = 0, total = 0
  for (const c of cpus) {
    idle += c.times.idle
    total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq
  }
  return { idle, total }
}
function cpuUsagePct() {
  const now = cpuTimes()
  if (!prevCpu) { prevCpu = now; return 0 }
  const idleDiff = now.idle - prevCpu.idle
  const totalDiff = now.total - prevCpu.total
  prevCpu = now
  if (totalDiff <= 0) return 0
  return +((1 - idleDiff / totalDiff) * 100).toFixed(1)
}
function netBytes() {
  // 容器内默认只能看到容器自己的网络命名空间；
  // docker-compose 把宿主机 /proc 以只读挂在 /host/proc，优先读宿主机的。
  const candidates = ['/host/proc/net/dev', '/proc/net/dev']
  for (const file of candidates) {
    try {
      const txt = fs.readFileSync(file, 'utf-8')
      let rx = 0, tx = 0, found = false
      for (const line of txt.split('\n')) {
        const m = line.trim().match(/^([^:]+):\s*(.*)$/)
        if (!m || m[1] === 'lo') continue
        const f = m[2].trim().split(/\s+/)
        rx += Number(f[0]) || 0
        tx += Number(f[8]) || 0
        found = true
      }
      if (found) return { rx, tx }
    } catch { /* 试下一个 */ }
  }
  return null
}
function netRates() {
  const now = netBytes()
  if (!now || !prevNet) { prevNet = now; return { up: 0, down: 0 } }
  const down = Math.max(0, (now.rx - prevNet.rx) / 10)
  const up = Math.max(0, (now.tx - prevNet.tx) / 10)
  prevNet = now
  return { up: Math.round(up), down: Math.round(down) }
}
function loadOpsMetrics() {
  try {
    const arr = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf-8'))
    if (Array.isArray(arr)) opsMetrics = arr.filter((p) => Date.now() - p.t < 24 * 3600 * 1000)
  } catch { /* 无文件或损坏 -> 从空开始 */ }
}
function saveOpsMetrics() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(METRICS_FILE + '.tmp', JSON.stringify(opsMetrics))
    fs.renameSync(METRICS_FILE + '.tmp', METRICS_FILE)
  } catch { /* 落盘失败不影响内存数据 */ }
}
async function sampleOpsMetrics() {
  try {
    const s = systemInfo()
    const disk = await diskInfo()
    const net = netRates()
    opsMetrics.push({
      t: Date.now(),
      cpu: cpuUsagePct(),
      mem: s.memUsedPct,
      load1: s.load1,
      diskPct: disk?.usedPct ?? null,
      up: net.up,
      down: net.down
    })
    if (opsMetrics.length > 8640) opsMetrics.shift() // 24h × 10s
  } catch { /* 采样失败跳过一次 */ }
}
function metricsForRange(range) {
  const span = range === '1h' ? 3600e3 : range === '6h' ? 6 * 3600e3 : 24 * 3600e3
  const cutoff = Date.now() - span
  let pts = opsMetrics.filter((p) => p.t >= cutoff)
  if (pts.length > 300) {
    const step = Math.ceil(pts.length / 300)
    pts = pts.filter((_, i) => i % step === 0)
  }
  return pts
}
loadOpsMetrics()
sampleOpsMetrics()
setInterval(sampleOpsMetrics, 10_000)
setInterval(saveOpsMetrics, 5 * 60 * 1000)

// ---------- Docker Socket API（容器里没有 docker 命令行也能用） ----------
function dockerApi(method, apiPath, body) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        socketPath: '/var/run/docker.sock', path: apiPath, method, timeout: 8000,
        headers: body ? { 'Content-Type': 'application/json' } : {}
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }))
      }
    )
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: Buffer.alloc(0) }) })
    req.on('error', () => resolve({ status: 0, body: Buffer.alloc(0) }))
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}
function dockerAvailable() { return fs.existsSync('/var/run/docker.sock') }

function calcCpuPct(stats) {
  try {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
    const sysDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
    const cpus = stats.cpu_stats.online_cpus || os.cpus().length
    if (sysDelta > 0 && cpuDelta >= 0) return +((cpuDelta / sysDelta) * cpus * 100).toFixed(1)
  } catch { /* 忽略 */ }
  return 0
}
function fmtBytes(n) {
  if (n == null || isNaN(n)) return '—'
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB'
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}
function demuxDockerLogs(buf) {
  // Docker 日志是 multiplexed 流：每帧 8 字节头（1 字节流类型 + 3 字节保留 + 4 字节长度）+ 数据
  let out = ''
  let off = 0
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off + 4)
    if (off + 8 + len > buf.length) break
    out += buf.slice(off + 8, off + 8 + len).toString('utf-8')
    off += 8 + len
  }
  if (!out) out = buf.toString('utf-8') // 非 multiplexed（极少数情况）直接当文本
  return out
}

// ---------- /api/docker ----------
// 优先走 Docker Socket API（容器里没有 docker 命令行也能用）；
// socket 不可用时回落到 docker ps 命令行。
async function dockerViaSocket() {
  return new Promise((resolve) => {
    const req = http.request(
      { socketPath: '/var/run/docker.sock', path: '/containers/json', method: 'GET', timeout: 5000 },
      (res) => {
        let body = ''
        res.on('data', (c) => { body += c })
        res.on('end', () => {
          try {
            const arr = JSON.parse(body)
            const containers = arr.map((c) => ({
              name: (c.Names?.[0] || '').replace(/^\//, ''),
              image: c.Image || '',
              status: c.Status || '',
              ports: (c.Ports || []).map((p) => `${p.PublicPort ? p.IP + ':' + p.PublicPort + '->' : ''}${p.PrivatePort}/${p.Type}`).join(', '),
              running: c.State === 'running'
            }))
            resolve(ok({ count: containers.length, containers }))
          } catch { resolve(fail('docker API 解析失败')) }
        })
      }
    )
    req.on('timeout', () => { req.destroy(); resolve(fail('docker API 超时')) })
    req.on('error', (e) => resolve(fail('docker 不可用：' + String(e.message || e).slice(0, 100))))
    req.end()
  })
}

async function dockerPs() {
  if (fs.existsSync('/var/run/docker.sock')) return dockerViaSocket()
  const r = await execTimeout('docker', ['ps', '--format', '{{json .}}'], 5000)
  if (!r.ok) return fail('docker 不可用：' + r.error)
  const containers = r.stdout.trim().split('\n').filter(Boolean).map((line) => {
    try {
      const c = JSON.parse(line)
      return {
        name: c.Names || c.Name || '',
        image: c.Image || '',
        status: c.Status || '',
        ports: c.Ports || '',
        running: /Up/.test(c.Status || '')
      }
    } catch { return null }
  }).filter(Boolean)
  return ok({ count: containers.length, containers })
}

// ---------- /api/uptime ----------
const UPTIME_TARGETS = [
  { name: '订阅转换 · sub.199060.xyz', url: 'https://sub.199060.xyz/' },
  { name: '老王导航 · :8080', url: 'http://67.215.229.127:8080/' },
  { name: '订阅转换 · :38081', url: 'http://67.215.229.127:38081/' }
]

async function checkOne(t) {
  const start = Date.now()
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(t.url, { signal: ctrl.signal, method: 'GET', redirect: 'manual' })
    clearTimeout(timer)
    return { name: t.name, url: t.url, up: res.status < 500, status: res.status, ms: Date.now() - start }
  } catch (e) {
    return { name: t.name, url: t.url, up: false, status: 0, ms: Date.now() - start, error: String(e.message || e).slice(0, 80) }
  }
}

// ---------- /api/github ----------
const GH_REPOS = [
  { owner: 'tony-wang1990', repo: 'laowang-sub-converter' },
  { owner: 'tony-wang1990', repo: 'laowang-subscription' },
  { owner: 'tony-wang1990', repo: 'laowang-nav' }
]
const GH_HEADERS = { 'User-Agent': 'laowang-dashboard', Accept: 'application/vnd.github+json' }

async function githubRepos() {
  const items = []
  for (const { owner, repo } of GH_REPOS) {
    try {
      const [info, commits] = await Promise.all([
        fetchJson(`https://api.github.com/repos/${owner}/${repo}`, { headers: GH_HEADERS, timeoutMs: 8000 }),
        fetchJson(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, { headers: GH_HEADERS, timeoutMs: 8000 })
      ])
      items.push({
        name: repo,
        fullName: info.full_name,
        stars: info.stargazers_count,
        forks: info.forks_count,
        watchers: info.watchers_count,
        language: info.language,
        description: info.description,
        url: info.html_url,
        pushedAt: info.pushed_at,
        lastCommit: commits?.[0] ? { message: commits[0].commit.message.split('\n')[0], sha: commits[0].sha.slice(0, 7), date: commits[0].commit.author?.date } : null
      })
    } catch (e) {
      items.push({ name: repo, error: String(e.message || e).slice(0, 100) })
    }
  }
  return ok({ repos: items })
}

async function githubTrending() {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const data = await fetchJson(
    `https://api.github.com/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=8`,
    { headers: GH_HEADERS, timeoutMs: 8000 }
  )
  return ok({
    items: (data.items || []).map((r) => ({
      name: r.full_name, stars: r.stargazers_count, language: r.language,
      description: r.description, url: r.html_url
    }))
  })
}

// ---------- 天气：Open-Meteo 默认；有 QWEATHER_KEY 且未指定城市时用和风（可选配置） ----------
const SHANGHAI = { name: '上海', country: '中国', latitude: 31.23, longitude: 121.47, timezone: 'Asia/Shanghai' }

// 城市名 -> 经纬度。优先 Nominatim（中文名支持好，免 key；1 秒限速由 10 分钟天气缓存兜底）；
// 失败时用 Open-Meteo 地理编码兜底；都失败则抛错由上层回落上海。
const CITY_TYPES = new Set(['country', 'state', 'city', 'town', 'village', 'municipality', 'county', 'district', 'borough', 'suburb'])
async function geocodeCity(city) {
  // 1) Nominatim（OpenStreetMap）
  try {
    const { text } = await safeFetchText(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=3&accept-language=zh`,
      { timeoutMs: 8000, headers: { 'User-Agent': 'laowang-dashboard' } }
    )
    const list = JSON.parse(text)
    // 只接受城市级地点：行政边界，或 addresstype 是城市/城镇/区县；不要把模糊匹配到的景点、栈道等地物当成城市
    const cityLike = (Array.isArray(list) ? list : []).filter((r) =>
      r.class === 'boundary' || CITY_TYPES.has(r.addresstype)
    )
    if (cityLike.length) {
      const best = [...cityLike].sort((a, b) => (b.importance || 0) - (a.importance || 0))[0]
      const segs = String(best.display_name || '').split(/[,，]/)
      const raw = (segs[0] || '').split(';')[0].split('/')[0].trim()
      const name = raw.replace(/市$/, '') || city
      const country = (segs[segs.length - 1] || '').split(';')[0].trim()
      return { name, country, latitude: Number(best.lat), longitude: Number(best.lon), timezone: 'auto' }
    }
  } catch { /* 掉到 Open-Meteo 兜底 */ }
  // 2) Open-Meteo 地理编码（英文名准；中文名取人口最多的结果）
  const { text } = await safeFetchText(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=zh&format=json`,
    { timeoutMs: 8000 }
  )
  const d = JSON.parse(text)
  // 只接受居民点 / 行政区（feature_code 以 PPL/ADM 开头），不要地物
  const results = (d.results || []).filter((r) => r.latitude != null && r.longitude != null && /^(PPL|ADM)/.test(r.feature_code || ''))
  if (!results.length) throw new Error('未找到城市 ' + city)
  const best = [...results].sort((a, b) => (b.population || 0) - (a.population || 0))[0]
  return { name: best.name, country: best.country || '', latitude: best.latitude, longitude: best.longitude, timezone: best.timezone || 'auto' }
}

// 目标时区的当前小时（预报时间按目标时区返回，不能用服务器本地时间对）
function hourKeyInTimezone(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
    const get = (t) => parts.find((p) => p.type === t)?.value
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:00`
  } catch {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:00`
  }
}

async function forecastForPlace(place) {
  const d = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&forecast_days=2&timezone=${encodeURIComponent(place.timezone)}`,
    { timeoutMs: 8000 }
  )
  const hourKey = (d.current && d.current.time ? d.current.time.slice(0, 13) + ':00' : hourKeyInTimezone(place.timezone))
  const idx = Math.max(0, d.hourly.time.findIndex((t) => t >= hourKey))
  const hours = (d.hourly.time.slice(idx, idx + 12) || []).map((t, i) => ({
    time: t.slice(11, 16), temp: d.hourly.temperature_2m[idx + i], code: d.hourly.weather_code[idx + i]
  }))
  return ok({
    source: 'open-meteo', sourceName: 'Open-Meteo（免费免 key）',
    city: place.name, country: place.country, latitude: place.latitude, longitude: place.longitude,
    temp: d.current.temperature_2m, humidity: d.current.relative_humidity_2m,
    wind: d.current.wind_speed_10m, code: d.current.weather_code, hours
  })
}

async function weatherFromOpenMeteo(city) {
  if (city) {
    try {
      const place = await geocodeCity(city)
      return await forecastForPlace(place)
    } catch { /* 城市解析不到 / 接口异常 -> 回落上海 */ }
  }
  return forecastForPlace(SHANGHAI)
}

async function weatherFromQWeather() {
  const key = process.env.QWEATHER_KEY
  const host = process.env.QWEATHER_HOST || 'devapi.qweather.com'
  const loc = process.env.QWEATHER_LOCATION || '101020100' // 上海
  const now = await fetchJson(`https://${host}/v7/weather/now?location=${loc}&key=${key}`, { timeoutMs: 8000 })
  if (now.code !== '200') throw new Error('QWeather now code ' + now.code)
  const hourly = await fetchJson(`https://${host}/v7/weather/24h?location=${loc}&key=${key}`, { timeoutMs: 8000 })
  if (hourly.code !== '200') throw new Error('QWeather hourly code ' + hourly.code)
  return ok({
    source: 'qweather', sourceName: '和风天气',
    city: '上海',
    temp: Number(now.now.temp),
    humidity: Number(now.now.humidity),
    wind: Number(now.now.windSpeed),
    code: null,
    text: now.now.text,
    hours: (hourly.hourly || []).slice(0, 12).map((h) => ({
      time: h.fxTime.slice(11, 16), temp: Number(h.temp), code: null, text: h.text
    }))
  })
}

async function weather(req, url) {
  const city = (url?.searchParams?.get('city') || '').trim()
  // 指定城市时一律走 Open-Meteo（和风只认 locationId，不认城市名）
  if (city) return weatherFromOpenMeteo(city)
  if (process.env.QWEATHER_KEY) {
    try { return await weatherFromQWeather() } catch (e) { /* 和风失败则回落到 Open-Meteo */ }
  }
  return weatherFromOpenMeteo('')
}

// ---------- 烟台风力/停航：Open-Meteo 预报 + 海洋 + 中央气象台预警 ----------
// yatao 在烟台崆峒岛上班，坐船往返；陆岛航线风力大于 7 级停航。
// 陆地风（烟台市区 37.46, 121.44）和海面风（崆峒岛附近海域，岛屿坐标经
// Nominatim 核实 37.5615, 121.5146，取 37.56, 121.51）都用 forecast 接口
// （marine 接口没有风，传 wind_speed_10m 会返回 undefined）；浪高用 marine 接口。
// 实测：forecast 接口在旧点（37.5, 121.4）和新点返回值完全一致（同一模型格点）；
// marine 接口新点波高 0.68 m / 周期 4.3 s，旧点 0.48 m / 3.65 s（不同格点）。
// 海洋模式网格较粗，浪高代表崆峒岛附近一带海况，不是岸边的精确值。
// 蒲氏风级（m/s）：5 级 8.0–10.7，6 级 10.8–13.8，7 级 13.9–17.1，8 级 17.2–20.7。
// 停航只看海面持续风速（yatao 纠正：阵风平时也常冲到 7–9 级，不能按阵风定级）：
// 持续风 ＜6 级正常，6–7 级有停航风险，＞7 级（≥8 级）停航；阵风只展示、不定级。
const BEAUFORT_MIN = [0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7]
function beaufort(ms) {
  if (ms == null || isNaN(ms)) return null
  let b = 0
  for (let i = 0; i < BEAUFORT_MIN.length; i++) if (ms >= BEAUFORT_MIN[i]) b = i + 1
  return b
}
const DIR16 = ['北', '北东北', '东北', '东东北', '东', '东东南', '东南', '南东南', '南', '南西南', '西南', '西西南', '西', '西西北', '西北', '北西北']
function dirText(deg) {
  if (deg == null || isNaN(deg)) return ''
  return DIR16[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16]
}
const round1 = (v) => (v == null || isNaN(v) ? null : +Number(v).toFixed(1))

// 固定上游接口也走 safeFetchText（SSRF 统一出口）+ JSON 解析 + 状态码检查
async function fetchJsonSafe(url, { timeoutMs = 8000, headers = {} } = {}) {
  const { status, text } = await safeFetchText(url, { timeoutMs, headers })
  if (status >= 400) throw new Error('HTTP ' + status)
  return JSON.parse(text)
}

async function windForecast(lat, lon) {
  return fetchJsonSafe(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
    `&hourly=wind_speed_10m,wind_gusts_10m&forecast_days=7&wind_speed_unit=ms&timezone=Asia%2FShanghai`,
    { timeoutMs: 8000 }
  )
}

function windSummary(d) {
  const c = d.current || {}
  const windMs = round1(c.wind_speed_10m)
  const gustMs = round1(c.wind_gusts_10m)
  return {
    windMs, windKmh: windMs == null ? null : round1(windMs * 3.6),
    gustMs, gustKmh: gustMs == null ? null : round1(gustMs * 3.6),
    dirDeg: c.wind_direction_10m ?? null, dirText: dirText(c.wind_direction_10m),
    beaufort: beaufort(windMs), gustBeaufort: beaufort(gustMs)
  }
}

// 逐小时 -> 逐日最大风（7 天，预报时区本地日期）
function dailyMaxWind(hourly) {
  const days = {}
  const times = hourly?.time || []
  for (let i = 0; i < times.length; i++) {
    const date = times[i].slice(0, 10)
    const d = days[date] || (days[date] = { date, maxWind: 0, maxGust: 0 })
    const w = hourly.wind_speed_10m?.[i], g = hourly.wind_gusts_10m?.[i]
    if (w != null) d.maxWind = Math.max(d.maxWind, w)
    if (g != null) d.maxGust = Math.max(d.maxGust, g)
  }
  const week = '日一二三四五六'
  return Object.values(days).slice(0, 7).map((d, idx) => {
    const wd = week[new Date(d.date + 'T12:00:00+08:00').getDay()]
    const maxWind = round1(d.maxWind), maxGust = round1(d.maxGust)
    return {
      date: d.date.slice(5), label: idx === 0 ? '今天' : idx === 1 ? '明天' : idx === 2 ? '后天' : '周' + wd,
      maxWindMs: maxWind, maxWindKmh: maxWind == null ? null : round1(maxWind * 3.6),
      maxGustMs: maxGust, maxGustKmh: maxGust == null ? null : round1(maxGust * 3.6),
      beaufort: beaufort(maxWind), gustBeaufort: beaufort(maxGust)
    }
  })
}

// 从当前小时起的未来 N 小时（预报时间按目标时区返回）
function nextHours(hourly, currentTime, n) {
  const times = hourly?.time || []
  const key = currentTime ? currentTime.slice(0, 13) + ':00' : null
  let idx = key ? times.findIndex((t) => t >= key) : 0
  if (idx < 0) idx = 0
  return times.slice(idx, idx + n).map((t, i) => ({
    time: t.slice(11, 16),
    windMs: round1(hourly.wind_speed_10m?.[idx + i]),
    gustMs: round1(hourly.wind_gusts_10m?.[idx + i]),
    beaufort: beaufort(hourly.wind_speed_10m?.[idx + i])
  }))
}

async function yantaiWind() {
  const [land, sea] = await Promise.all([
    windForecast(37.46, 121.44),
    windForecast(37.56, 121.51)
  ])
  // 浪高：marine 接口失败不影响风力数据，降级为 null
  let waves = null
  try {
    const m = await fetchJsonSafe(
      'https://marine-api.open-meteo.com/v1/marine?latitude=37.56&longitude=121.51' +
      '&current=wave_height,wind_wave_height,swell_wave_height,wave_period&timezone=Asia%2FShanghai&forecast_days=3',
      { timeoutMs: 8000 }
    )
    const c = m.current || {}
    waves = {
      height: round1(c.wave_height), windWave: round1(c.wind_wave_height),
      swell: round1(c.swell_wave_height), period: round1(c.wave_period)
    }
  } catch { /* 浪高暂无数据 */ }
  const landSum = windSummary(land)
  const seaSum = windSummary(sea)
  // 风险只按海面持续风速定级（阵风只展示、不参与定级）：
  // 持续风 ＜6 级绿“正常通行”；6–7 级黄“停航风险”；＞7 级（≥8 级）红“停航”
  const riskB = seaSum.beaufort ?? 0
  const risk = riskB >= 8
    ? { level: 'red', beaufort: riskB, text: '停航' }
    : riskB >= 6
      ? { level: 'yellow', beaufort: riskB, text: '停航风险' }
      : { level: 'green', beaufort: riskB, text: '正常通行' }
  return ok({
    updatedAt: new Date().toISOString(),
    land: landSum, sea: seaSum, waves, risk: { ...risk, note: '以崆峒岛附近海面持续风速为准，阵风仅供参考；持续风 6–7 级有停航风险，＞7 级停航（陆岛航线参考，非官方通知）' },
    days: dailyMaxWind(sea.hourly),
    seaHours: nextHours(sea.hourly, sea.current?.time, 12)
  })
}

// ---------- 天气预警：中央气象台 findAlarm（免费免 key） ----------
// 实测结构：data.page.list（+ data.provinceAlarms）每条只有
// { alertid, issuetime: "2026/11/24 21:36", title: "云南省昭通市镇雄县气象台发布暴雪蓝色预警信号",
//   url: "/publish/alarm/xxx.html", pic }，没有 signaltype/signallevel 字段，
// 级别和类型从标题解析：/发布(.+?)(蓝色|黄色|橙色|红色)预警/。
// province 参数不要用（实测返回非 JSON）；拉全国列表（pageSize 200），
// 服务端按标题过滤：含城市名的；或 province 参数时，省级站发布的预警
// （标题以“XX省…发布”开头、发布前无“市”字）也算——市级标题如“山东省青岛市…”会被排除。
function parseWarningTitle(title) {
  const m = String(title || '').match(/发布(.+?)(蓝色|黄色|橙色|红色)预警/)
  if (!m) return null
  return { type: m[1], level: m[2] }
}
async function warningsFor(city, province, type) {
  const d = await fetchJsonSafe('http://www.nmc.cn/rest/findAlarm?pageNo=1&pageSize=200', { timeoutMs: 8000 })
  const raw = [...(d.data?.page?.list || []), ...(d.data?.provinceAlarms || [])]
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const provRe = province ? new RegExp('^' + esc(province) + '[^市]*发布') : null
  const seen = new Set()
  const items = []
  for (const r of raw) {
    if (!r || !r.alertid || seen.has(r.alertid)) continue
    seen.add(r.alertid)
    const parsed = parseWarningTitle(r.title)
    if (!parsed) continue
    if (type && parsed.type !== type) continue
    const title = r.title || ''
    const cityHit = city ? title.includes(city) : false
    const provHit = provRe ? provRe.test(title) : false
    if (!cityHit && !provHit) continue
    items.push({
      alertid: r.alertid, title, type: parsed.type, level: parsed.level,
      issuetime: r.issuetime || '',
      url: r.url ? 'https://www.nmc.cn' + r.url : 'https://www.nmc.cn/f/alarm.html'
    })
  }
  items.sort((a, b) => String(b.issuetime).localeCompare(String(a.issuetime)))
  return ok({ city: city || '', province: province || '', type: type || '', count: items.length, items: items.slice(0, 20) })
}

// ---------- 布局存储 ----------
function layoutPath() { return path.join(DATA_DIR, 'layout.json') }
function loadLayout() {
  try {
    const raw = fs.readFileSync(layoutPath(), 'utf-8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed.layout)) return parsed.layout
  } catch { /* 无文件或损坏 -> 返回 null，用默认布局 */ }
  return null
}
// ---------- 路由 ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json'
}

function sendJson(res, obj, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(obj))
}

const routes = {
  '/api/system': async () => {
    const [disk, ip] = await Promise.all([
      diskInfo(),
      cached('public-ip', 600_000, publicIp)
    ])
    return ok({ ...systemInfo(), disk, ip })
  },
  '/api/ip': async () => {
    const ip = await cached('public-ip', 600_000, publicIp)
    return ip ? ok(ip) : fail('IP 查询失败')
  },
  '/api/history': async () => ok({
    source: '本机实时采样（每 30 秒一次，最近 1 小时）',
    points: history
  }),
  '/api/docker': () => cached('docker', 30_000, dockerPs),
  '/api/uptime': async () => ok({ targets: await Promise.all(UPTIME_TARGETS.map(checkOne)) }),
  '/api/github': () => cached('github', 120_000, githubRepos),
  '/api/trending': () => cached('trending', 600_000, githubTrending),
  '/api/crypto': () => cached('crypto', 120_000, async () => {
    const d = await fetchJson(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd,cny&include_24hr_change=true',
      { timeoutMs: 8000 }
    )
    return ok({
      coins: [
        { id: 'bitcoin', name: '比特币 BTC', usd: d.bitcoin?.usd, cny: d.bitcoin?.cny, chg24: d.bitcoin?.usd_24h_change },
        { id: 'ethereum', name: '以太坊 ETH', usd: d.ethereum?.usd, cny: d.ethereum?.cny, chg24: d.ethereum?.usd_24h_change },
        { id: 'solana', name: 'Solana SOL', usd: d.solana?.usd, cny: d.solana?.cny, chg24: d.solana?.usd_24h_change }
      ]
    })
  }),
  '/api/rates': () => cached('rates', 600_000, async () => {
    const d = await fetchJson('https://api.frankfurter.app/latest?from=USD&to=CNY,EUR,HKD,JPY', { timeoutMs: 8000 })
    return ok({ base: 'USD', date: d.date, rates: d.rates })
  }),
  '/api/weather': (req, url) => cached('weather:' + ((url?.searchParams?.get('city') || '').trim() || 'default'), 600_000, () => weather(req, url)),
  // 烟台风力/停航（风浪 30 分钟缓存）；天气预警（按城市查，10 分钟缓存）
  '/api/yantai-wind': () => cached('yantai-wind', 1800_000, yantaiWind),
  '/api/warnings': (req, url) => cached(
    'warnings:' + ['city', 'province', 'type'].map((k) => (url?.searchParams?.get(k) || '').trim()).join('|'),
    600_000,
    () => warningsFor(
      (url?.searchParams?.get('city') || '').trim(),
      (url?.searchParams?.get('province') || '').trim(),
      (url?.searchParams?.get('type') || '').trim()
    )
  ),
  '/api/news': () => cached('news', 300_000, async () => {
    const out = { hn: [], sspai: [] }
    try {
      const xml = await fetchText('https://hnrss.org/frontpage', { timeoutMs: 8000 })
      out.hn = parseRss(xml).slice(0, 8)
    } catch { /* 降级：空列表 */ }
    try {
      const xml = await fetchText('https://sspai.com/feed', { timeoutMs: 8000 })
      out.sspai = parseRss(xml).slice(0, 8)
    } catch { /* 降级：空列表 */ }
    return ok(out)
  }),
  '/api/rss': async (req, url) => {
    const feedUrl = url.searchParams.get('url') || ''
    if (!/^https?:\/\//i.test(feedUrl)) return fail('只支持 http/https 的 RSS 地址')
    const { text } = await safeFetchText(feedUrl, { timeoutMs: 8000 })
    return ok({ url: feedUrl, items: parseRss(text).slice(0, 20) })
  },
  '/api/proxy': async (req, url) => {
    const target = url.searchParams.get('url') || ''
    if (!/^https?:\/\//i.test(target)) return fail('只支持 http/https 地址')
    const { status, contentType, text } = await safeFetchText(target, { timeoutMs: 5000, headers: { 'User-Agent': 'laowang-dashboard' } })
    let json = null
    try { json = JSON.parse(text) } catch { /* 非 JSON，返回原始文本 */ }
    return ok({
      status,
      contentType,
      json,
      text: json ? undefined : text.slice(0, 500)
    })
  },
  '/api/quote': () => cached('quote', 300_000, async () => {
    const d = await fetchJson('https://v1.hitokoto.cn/?c=d&c=i&c=k', { timeoutMs: 8000 })
    return ok({ text: d.hitokoto, from: d.from_who || d.from || '' })
  }),
  // 布局只读：GET 返回服务端最后一次保存的布局（新浏览器用它做 fallback）；
  // POST 已关闭（见主路由里的 404），布局只保存在各浏览器 localStorage。
  '/api/layout': async (req) => {
    if (req.method === 'GET') {
      const layout = loadLayout()
      return layout ? ok({ layout }) : fail('no saved layout')
    }
    return fail('method not allowed')
  }
}

// ---------- 服务器看板接口 /api/ops/*（全部只读） ----------
// 只读查询（监控、主机、容器列表、镜像、进程、磁盘）公开可看；
// 写操作（启停容器、清理镜像、看日志）必须登录。
async function opsDockerList() {
  if (!dockerAvailable()) return fail('宿主机 Docker 不可用')
  const r = await dockerApi('GET', '/containers/json?all=1')
  if (r.status !== 200) return fail('Docker API 调用失败')
  let list
  try { list = JSON.parse(r.body.toString('utf-8')) } catch { return fail('Docker API 解析失败') }
  const containers = await Promise.all(list.map(async (c) => {
    let cpu = 0, memUsed = 0, memLimit = 0
    try {
      const s = await dockerApi('GET', `/containers/${c.Id}/stats?stream=false&one-shot=true`)
      if (s.status === 200) {
        const stats = JSON.parse(s.body.toString('utf-8'))
        cpu = calcCpuPct(stats)
        memUsed = stats.memory_stats?.usage || 0
        memLimit = stats.memory_stats?.limit || 0
      }
    } catch { /* 单个容器 stats 失败不影响列表 */ }
    return {
      id: c.Id.slice(0, 12),
      name: (c.Names?.[0] || '').replace(/^\//, ''),
      image: c.Image || '',
      state: c.State || '',
      status: c.Status || '',
      cpu,
      memUsedMB: Math.round(memUsed / 1024 / 1024),
      memLimitMB: Math.round(memLimit / 1024 / 1024),
      memPct: memLimit ? +((memUsed / memLimit) * 100).toFixed(1) : 0,
      ports: (c.Ports || []).map((pp) => `${pp.PublicPort ? pp.PublicPort + '->' : ''}${pp.PrivatePort}/${pp.Type}`).join(', ')
    }
  }))
  return ok({ count: containers.length, containers })
}

async function opsImages() {
  if (!dockerAvailable()) return fail('宿主机 Docker 不可用')
  const r = await dockerApi('GET', '/images/json')
  if (r.status !== 200) return fail('Docker API 调用失败')
  let list
  try { list = JSON.parse(r.body.toString('utf-8')) } catch { return fail('Docker API 解析失败') }
  return ok({
    images: list.map((im) => ({
      id: (im.Id || '').replace('sha256:', '').slice(0, 12),
      tags: (im.RepoTags || []).filter((t) => t !== '<none>:<none>'),
      dangling: (im.RepoTags || []).every((t) => t === '<none>:<none>'),
      sizeMB: Math.round((im.Size || 0) / 1024 / 1024),
      created: im.Created ? new Date(im.Created * 1000).toISOString().slice(0, 10) : ''
    }))
  })
}

async function opsProcesses() {
  // 容器是 Alpine（BusyBox ps 不支持 -eo/--sort），直接读 /proc 采样：
  // 隔 1 秒读两次 utime/stime 算 CPU%，VmRSS 算内存。宿主机 /proc 以只读挂在 /host/proc。
  const procRoot = fs.existsSync('/host/proc') ? '/host/proc' : '/proc'
  const CLK = 100
  const uptimeSec = os.uptime()
  const cpuCount = os.cpus().length

  function readProcs() {
    const out = new Map()
    let entries
    try { entries = fs.readdirSync(procRoot) } catch { return out }
    for (const name of entries) {
      if (!/^\d+$/.test(name)) continue
      try {
        const stat = fs.readFileSync(`${procRoot}/${name}/stat`, 'utf-8')
        const rparen = stat.lastIndexOf(')')
        const after = stat.slice(rparen + 2).split(/\s+/)
        // after[0]=state after[1]=ppid after[11]=utime after[12]=stime after[19]=starttime after[21]=rss(pages)
        const utime = Number(after[11]) || 0
        const stime = Number(after[12]) || 0
        const startTicks = Number(after[19]) || 0
        const rssPages = Number(after[21]) || 0
        const comm = stat.slice(stat.indexOf('(') + 1, rparen)
        let cmdline = ''
        try { cmdline = fs.readFileSync(`${procRoot}/${name}/cmdline`, 'utf-8').replace(/\0/g, ' ').trim() } catch { /* 忽略 */ }
        let uid = ''
        try {
          const status = fs.readFileSync(`${procRoot}/${name}/status`, 'utf-8')
          const m = status.match(/^Uid:\s*(\d+)/m)
          uid = m ? m[1] : ''
        } catch { /* 忽略 */ }
        out.set(name, {
          pid: Number(name), ppid: Number(after[1]) || 0, uid,
          cpuTicks: utime + stime,
          memMB: Math.round((rssPages * 4096) / 1024 / 1024),
          memPct: 0,
          etimeSec: Math.max(0, Math.floor(uptimeSec - startTicks / CLK)),
          command: cmdline || comm
        })
      } catch { /* 进程可能已退出，跳过 */ }
    }
    return out
  }
  function fmtEtime(sec) {
    const d = Math.floor(sec / 86400)
    const h = Math.floor((sec % 86400) / 3600)
    const m = Math.floor((sec % 3600) / 60)
    if (d > 0) return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
  }
  const memTotalMB = os.totalmem() / 1024 / 1024
  const first = readProcs()
  if (!first.size) return fail('进程列表获取失败')
  await new Promise((r) => setTimeout(r, 1000))
  const second = readProcs()
  const processes = []
  for (const [pid, p2] of second) {
    const p1 = first.get(pid)
    if (!p1) continue
    const cpu = +(((p2.cpuTicks - p1.cpuTicks) / CLK / 1 / cpuCount) * 100).toFixed(1)
    processes.push({
      pid: p2.pid, ppid: p2.ppid, user: p2.uid || '—',
      cpu: cpu < 0 ? 0 : cpu,
      mem: +(p2.memMB / memTotalMB * 100).toFixed(1),
      etime: fmtEtime(p2.etimeSec),
      command: p2.command.slice(0, 120) || '—'
    })
  }
  processes.sort((a, b) => b.cpu - a.cpu || b.mem - a.mem)
  return ok({ processes: processes.slice(0, 25) })
}

async function opsDisk() {
  // 挂载点：读 /host/proc/mounts（容器内读到的是容器视角的挂载表）。
  // 其中 /host 是宿主机根目录的 bind 挂载，把它当作宿主机 /；/host/ 下的其他条目是
  // 透传进来的容器 overlay 挂载，要跳过；其余真实挂载点（/data 这类）按原样保留。
  const mountsFile = fs.existsSync('/host/proc/mounts') ? '/host/proc/mounts' : '/proc/mounts'
  const prefix = fs.existsSync('/host') ? '/host' : ''
  let mounts = ['/']
  try {
    const txt = fs.readFileSync(mountsFile, 'utf-8')
    const seen = new Set(['/'])
    for (const line of txt.split('\n')) {
      const f = line.split(/\s+/)
      if (f.length < 3) continue
      const [dev, mp, fstype] = f
      if (mp === '/host' || mp === '/') continue // /host 就是宿主机 /，已在 mounts 里
      if (mp.startsWith('/host/')) continue
      if (!['ext4', 'xfs', 'btrfs', 'vfat'].includes(fstype)) continue
      if (mp.startsWith('/sys') || mp.startsWith('/proc') || mp.startsWith('/dev') || mp.startsWith('/run')) continue
      if (seen.has(mp)) continue
      seen.add(mp)
      mounts.push(mp)
    }
  } catch { /* 读不到就只看 / */ }
  const targets = mounts.slice(0, 8).map((m) => (m === '/' ? prefix || '/' : prefix + m))
  const disks = []
  const r = await execTimeout('df', ['-k', ...targets], 5000)
  if (r.ok) {
    for (const line of r.stdout.trim().split('\n').slice(1)) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 6) continue
      const total = Number(parts[1]) * 1024
      const used = Number(parts[2]) * 1024
      const rawMount = parts[5]
      const mount = rawMount === (prefix || '/') ? '/' : rawMount.replace(prefix, '') || '/'
      disks.push({
        mount,
        totalGB: +(total / 1e9).toFixed(1),
        usedGB: +(used / 1e9).toFixed(1),
        usedPct: total ? +((used / total) * 100).toFixed(1) : 0
      })
    }
  }
  if (!disks.length) {
    // df 失败时兜底：至少返回根分区（diskInfo 已验证可用）
    const d = await diskInfo()
    if (d) disks.push({ mount: '/', totalGB: d.totalGB, usedGB: d.usedGB, usedPct: d.usedPct })
  }
  // 大目录 Top：后台异步算（du 扫大盘可能几十秒），先返回上次结果 + scanning 标记，绝不阻塞页面；
  // 结果 10 分钟缓存。-x 不跨文件系统，避免扫进别的挂载点。
  const topDirs = getTopDirs()
  // Docker 磁盘占用（镜像/容器/卷），走 Docker API，快且准
  let dockerDisk = null
  if (dockerAvailable()) {
    try {
      const r3 = await dockerApi('GET', '/system/df')
      if (r3.status === 200) {
        const df = JSON.parse(r3.body.toString('utf-8'))
        const sum = (arr) => (arr || []).reduce((s, x) => s + (x.Size || 0), 0)
        dockerDisk = {
          path: '/var/lib/docker（镜像+容器+卷）',
          sizeMB: Math.round((sum(df.Images) + sum(df.Containers) + sum(df.Volumes)) / 1024 / 1024)
        }
      }
    } catch { /* 忽略 */ }
  }
  const allTop = [...topDirs.data]
  if (dockerDisk) allTop.push(dockerDisk)
  allTop.sort((a, b) => b.sizeMB - a.sizeMB)
  return ok({ disks, topDirs: allTop.slice(0, 10), scanning: topDirs.scanning })
}

// 大目录统计：后台算 + 缓存，请求只读缓存
const topDirsCache = { data: [], at: 0, scanning: false }
function getTopDirs() {
  const prefix = fs.existsSync('/host') ? '/host' : ''
  const fresh = Date.now() - topDirsCache.at < 600_000 && topDirsCache.data.length
  if (!fresh && !topDirsCache.scanning) {
    topDirsCache.scanning = true
    const dirs = ['/opt', '/var/log', '/root', '/home', '/tmp', '/usr/local', '/srv', '/var/cache']
    execTimeout('du', ['-sm', '-x', ...dirs.map((d) => prefix + d)], 90000).then((r2) => {
      if (r2.ok) {
        topDirsCache.data = r2.stdout.trim().split('\n').map((line) => {
          const [size, p] = line.split(/\t/)
          return { path: (p || '').replace(prefix, '') || '/', sizeMB: Number(size) || 0 }
        }).sort((a, b) => b.sizeMB - a.sizeMB).slice(0, 10)
        topDirsCache.at = Date.now()
      }
      topDirsCache.scanning = false
    })
  }
  return { data: topDirsCache.data, scanning: topDirsCache.scanning }
}

// ============================================================================
// KPanel 集群（服务器看板主机切换）——只读
// 凭据全部来自环境变量 KPANEL_URL / KPANEL_USER / KPANEL_PASS，代码里不写
// 任何默认值和真值；没配凭据时切换器只提供本机，本机功能一切照常。
// 注意：不用 safeFetchText——KPANEL_URL 是运维人员在服务端配的可信地址，
// 不是用户输入；且它就是本机公网 IP，safeFetchText 会把它当“自身地址”拦掉。
// 直连 fetch + 8 秒超时；401 时自动重登一次。
// 实测依据（2026-11-24，KPanel 1.30.0 前端 JS + 真实接口探测）：
//   POST /api/v1/auth/login {username, password} -> 200，下发 Session cookie，
//     body 含 csrfToken；请求须带 Origin: <KPANEL_URL>，之后带 X-CSRF-Token + Cookie。
//   GET /api/v1/cluster/hosts -> 200，{items, total, remoteTotal}（无 data 包裹），
//     每台含 lastSnapshot.telemetry（hostname/os/kernel/load/cpu/memory/disk/
//     network/publicNetwork），state 字段为 online/offline。
//   GET /api/v1/monitoring/cluster-history?range=1h|6h|24h&hostId=<id> -> 200，
//     {range, bucketSeconds, host: [{collectedAt, cpuPercent, loadOne, cpuCores,
//     memoryUsedBytes, memoryTotalBytes, diskPercent, networkRxBytesPerSecond,
//     networkTxBytesPerSecond, ...}]}，1h 桶 60 秒，24h 桶 120 秒。
//   Docker/进程/磁盘/日志没有远程接口（实测）：/docker/containers 与
//     /system/summary 加 hostId 会静默返回本机数据，/system/processes 加
//     hostId 报 400 invalid_query，/system/disk-partitions 加 hostId 报 404
//     route_not_found；面板前端（DockerView/ProcessManagerView）也完全没有
//     hostId 逻辑。所以远程主机只提供主机信息、监控曲线、根盘用量三栏，
//     其余栏目明确返回“不支持远程查看”，绝不拿本机数据冒充远程数据。
// ============================================================================
const KPANEL_URL = (process.env.KPANEL_URL || '').replace(/\/+$/, '')
const KPANEL_USER = process.env.KPANEL_USER || ''
const KPANEL_PASS = process.env.KPANEL_PASS || ''
const kpanelConfigured = Boolean(KPANEL_URL && KPANEL_USER && KPANEL_PASS)
let kpanelAuth = null // { cookies, csrf }
let kpanelLoginPromise = null

async function kpanelLogin() {
  if (kpanelLoginPromise) return kpanelLoginPromise
  kpanelLoginPromise = (async () => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    let res
    try {
      res = await fetch(KPANEL_URL + '/api/v1/auth/login', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { Accept: 'application/json', Origin: KPANEL_URL, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: KPANEL_USER, password: KPANEL_PASS })
      })
    } catch { throw new Error('KPanel 登录连接失败') } finally { clearTimeout(timer) }
    let data = null
    try { data = await res.json() } catch { /* 非 JSON */ }
    if (!res.ok) {
      const code = data?.error?.code || data?.code
      if (code === 'totp_required') throw new Error('KPanel 账号开启了两步验证，密码登录需要验证码')
      throw new Error('KPanel 登录失败：' + (data?.error?.message || data?.message || `HTTP ${res.status}`))
    }
    const cookies = (typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [])
      .map((c) => c.split(';')[0]).join('; ')
    const csrf = res.headers.get('x-csrf-token') || data?.csrfToken || data?.data?.csrfToken || ''
    if (!cookies) throw new Error('KPanel 登录未下发会话')
    kpanelAuth = { cookies, csrf }
  })()
  try { await kpanelLoginPromise } finally { kpanelLoginPromise = null }
}

async function kpanelFetch(apiPath, { method = 'GET', body, _retried = false } = {}) {
  if (!kpanelConfigured) throw new Error('未配置 KPanel 凭据')
  if (!kpanelAuth) await kpanelLogin()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  let res
  try {
    res = await fetch(KPANEL_URL + '/api/v1' + apiPath, {
      method,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        Origin: KPANEL_URL,
        Cookie: kpanelAuth.cookies,
        ...(kpanelAuth.csrf ? { 'X-CSRF-Token': kpanelAuth.csrf } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  } catch { throw new Error('KPanel 连接失败') } finally { clearTimeout(timer) }
  let data = null
  try { data = await res.json() } catch { /* 非 JSON */ }
  if (res.status === 401 && !_retried) {
    kpanelAuth = null
    await kpanelLogin()
    return kpanelFetch(apiPath, { method, body, _retried: true })
  }
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || data?.detail || data?.title || `KPanel 接口返回 HTTP ${res.status}`
    throw new Error(String(msg).slice(0, 200))
  }
  // KPanel 有的接口包 data，有的直接返回对象本体，两者都兼容
  return (data && typeof data === 'object' && 'data' in data) ? data.data : data
}

// 只留前端展示需要的字段：sshLogin 这类登录记录绝不往外传
function pickTelemetry(tel) {
  const t = tel || {}
  return {
    hostname: t.hostname || '', os: t.os || '', osId: t.osId || '', kernel: t.kernel || '',
    architecture: t.architecture || '', uptimeSeconds: t.uptimeSeconds ?? null,
    collectedAt: t.collectedAt || null,
    load: { one: t.load?.one ?? null, five: t.load?.five ?? null, fifteen: t.load?.fifteen ?? null },
    cpu: { model: t.cpu?.model || '', cores: t.cpu?.cores || 0, usagePercent: t.cpu?.usagePercent ?? null },
    memory: {
      totalBytes: t.memory?.totalBytes || 0, usedBytes: t.memory?.usedBytes || 0,
      usagePercent: t.memory?.usagePercent ?? null,
      swapTotalBytes: t.memory?.swapTotalBytes || 0, swapUsedBytes: t.memory?.swapUsedBytes || 0
    },
    disk: { totalBytes: t.disk?.totalBytes || 0, usedBytes: t.disk?.usedBytes || 0, usagePercent: t.disk?.usagePercent ?? null },
    network: {
      receivedBytes: t.network?.receivedBytes || 0, sentBytes: t.network?.sentBytes || 0,
      tcpConnections: t.network?.tcpConnections ?? null, udpConnections: t.network?.udpConnections ?? null
    },
    publicNetwork: {
      ipv4: t.publicNetwork?.ipv4 || '', isp: t.publicNetwork?.isp || '',
      country: t.publicNetwork?.country || '', region: t.publicNetwork?.region || '',
      city: t.publicNetwork?.city || '', timezone: t.publicNetwork?.timezone || ''
    }
  }
}

async function kpanelHosts() {
  const items = await cached('kpanel-hosts', 30_000, async () => {
    const d = await kpanelFetch('/cluster/hosts')
    return Array.isArray(d?.items) ? d.items : []
  })
  return items.map((it) => ({
    id: it.id, name: it.name || it.id, kind: it.kind || '',
    isLocal: !!it.isLocal, online: it.state === 'online', state: it.state || '',
    hostname: it.lastSnapshot?.telemetry?.hostname || it.name || it.id,
    lastSeenAt: it.lastSuccessAt || it.lastSnapshot?.receivedAt || null,
    telemetry: pickTelemetry(it.lastSnapshot?.telemetry)
  }))
}

async function kpanelRemoteHost(id) {
  const hosts = await kpanelHosts()
  return hosts.find((h) => h.id === id) || null
}

// 远程主机信息：拼成本机 /api/ops/host 同样的返回结构，前端不用改字段
function remoteHostInfo(h) {
  const t = h.telemetry
  const memTotalMB = Math.round((t.memory.totalBytes || 0) / 1024 / 1024)
  const memUsedMB = Math.round((t.memory.usedBytes || 0) / 1024 / 1024)
  return {
    hostname: t.hostname || h.name,
    platform: 'linux',
    arch: t.architecture || '',
    cpuModel: t.cpu.model || '',
    cpuCount: t.cpu.cores || 0,
    load1: t.load.one, load5: t.load.five, load15: t.load.fifteen,
    load: [t.load.one ?? 0, t.load.five ?? 0, t.load.fifteen ?? 0].map((v) => +Number(v).toFixed(2)),
    memTotalMB, memUsedMB,
    memUsedPct: t.memory.usagePercent,
    uptimeSec: t.uptimeSeconds,
    osType: t.os || '',
    kernel: t.kernel || '',
    disk: {
      totalGB: +(t.disk.totalBytes / 1e9).toFixed(1),
      usedGB: +(t.disk.usedBytes / 1e9).toFixed(1),
      usedPct: t.disk.usagePercent ?? 0
    },
    ip: { ip: t.publicNetwork.ipv4 || '', country: t.publicNetwork.country || '', city: t.publicNetwork.city || '', isp: t.publicNetwork.isp || '' },
    collectedAt: t.collectedAt || null,
    remote: true
  }
}

// 远程监控曲线：拼成本机 /api/ops/metrics 同样的点结构
async function kpanelRemoteMetrics(id, range) {
  const d = await cached(`kpanel-history:${id}:${range}`, 30_000, () =>
    kpanelFetch(`/monitoring/cluster-history?range=${encodeURIComponent(range)}&hostId=${encodeURIComponent(id)}`))
  const raw = Array.isArray(d?.host) ? d.host : []
  let points = raw.map((p) => ({
    t: Date.parse(p.collectedAt) || 0,
    cpu: p.cpuPercent ?? null,
    mem: (p.memoryTotalBytes && p.memoryUsedBytes != null) ? +((p.memoryUsedBytes / p.memoryTotalBytes) * 100).toFixed(1) : null,
    load1: p.loadOne ?? null,
    diskPct: p.diskPercent ?? null,
    up: Math.round(p.networkTxBytesPerSecond || 0),
    down: Math.round(p.networkRxBytesPerSecond || 0)
  })).filter((p) => p.t > 0)
  if (points.length > 300) {
    const step = Math.ceil(points.length / 300)
    points = points.filter((_, i) => i % step === 0)
  }
  return { range, points, latest: points[points.length - 1] || null, count: points.length }
}

async function handleOps(req, res, url) {
  const p = url.pathname
  const send = (obj, status = 200) => sendJson(res, obj, status)
  const hostId = (url.searchParams.get('host') || 'local').trim() || 'local'
  const isRemote = hostId !== 'local'
  try {
    // --- 主机列表（本机 + KPanel 集群主机） ---
    if (p === '/api/ops/hosts') {
      const list = [{
        id: 'local', name: hostName(), kind: 'panel', isLocal: true,
        online: true, state: 'online', hostname: hostName()
      }]
      let kpanelError = null
      if (kpanelConfigured) {
        try {
          for (const h of await kpanelHosts()) {
            if (!h.isLocal) {
              list.push({ id: h.id, name: h.name, kind: h.kind, isLocal: false, online: h.online, state: h.state, hostname: h.hostname })
            }
          }
        } catch (e) { kpanelError = e.message || String(e) }
      }
      return send(ok({ hosts: list, localId: 'local', kpanelConfigured, kpanelError }))
    }

    // --- 远程主机：只接 KPanel 有的接口，其余明确报“不支持” ---
    if (isRemote) {
      if (!kpanelConfigured) return send(fail('未配置 KPanel 凭据，无法查看远程主机'))
      let rh
      try { rh = await kpanelRemoteHost(hostId) } catch (e) { return send(fail('KPanel 数据获取失败：' + (e.message || e))) }
      if (!rh) return send(fail('未知主机：' + hostId))
      if (p === '/api/ops/metrics') {
        const range = url.searchParams.get('range') || '1h'
        try {
          return send(ok(await kpanelRemoteMetrics(hostId, ['1h', '6h', '24h'].includes(range) ? range : '1h')))
        } catch (e) { return send(fail('KPanel 监控数据获取失败：' + (e.message || e))) }
      }
      if (p === '/api/ops/host') return send(ok(remoteHostInfo(rh)))
      if (p === '/api/ops/disk') {
        // 远程只有根盘用量（来自 lastSnapshot.telemetry.disk），大目录统计仅本机可用
        const d = rh.telemetry.disk
        return send(ok({
          disks: [{ mount: '/', totalGB: +(d.totalBytes / 1e9).toFixed(1), usedGB: +(d.usedBytes / 1e9).toFixed(1), usedPct: d.usagePercent ?? 0 }],
          topDirs: [], scanning: false, remote: true
        }))
      }
      if (p === '/api/ops/docker' || p === '/api/ops/images' || p === '/api/ops/processes') {
        return send(fail('该主机不支持远程查看（KPanel 未提供远程接口）'))
      }
      const logMatch = p.match(/^\/api\/ops\/docker\/([0-9a-f]{12})\/logs$/)
      if (logMatch && req.method === 'GET') return send(fail('该主机不支持远程查看日志（KPanel 未提供远程接口）'))
      return send(fail('unknown ops api'), 404)
    }

    // --- 只读查询（公开，本机） ---
    if (p === '/api/ops/metrics') {
      const range = url.searchParams.get('range') || '1h'
      const points = metricsForRange(['1h', '6h', '24h'].includes(range) ? range : '1h')
      return send(ok({ range, points, latest: points[points.length - 1] || null, count: points.length }))
    }
    if (p === '/api/ops/host') {
      const [disk, ip] = await Promise.all([diskInfo(), cached('public-ip', 600_000, publicIp)])
      return send(ok({
        ...systemInfo(), disk, ip,
        kernel: os.release(), osType: os.type(),
        load: os.loadavg().map((v) => +v.toFixed(2))
      }))
    }
    if (p === '/api/ops/docker') return send(await cached('ops-docker', 10_000, opsDockerList))
    if (p === '/api/ops/images') return send(await cached('ops-images', 60_000, opsImages))
    if (p === '/api/ops/processes') return send(await cached('ops-processes', 10_000, opsProcesses))
    if (p === '/api/ops/disk') return send(await opsDisk())

    // --- 日志查看（只读，公开） ---
    // 启停容器、清理镜像的写接口已移除：再调就落到下面的 unknown ops api（404）。
    const logMatch = p.match(/^\/api\/ops\/docker\/([0-9a-f]{12})\/logs$/)
    if (logMatch && req.method === 'GET') {
      if (!dockerAvailable()) return send(fail('宿主机 Docker 不可用'))
      const tail = Math.min(Number(url.searchParams.get('tail') || 200), 500)
      const r = await dockerApi('GET', `/containers/${logMatch[1]}/logs?stdout=1&stderr=1&tail=${tail}`)
      if (r.status !== 200) return send(fail('日志获取失败'))
      return send(ok({ logs: demuxDockerLogs(r.body).slice(-20000) }))
    }

    return send(fail('unknown ops api'), 404)
  } catch (e) {
    return send(fail(e.message || e), 200)
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const p = url.pathname

    if (p === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      return res.end('ok')
    }
    if (p.startsWith('/api/ops/')) return handleOps(req, res, url)
    // 布局只保存在浏览器 localStorage，不再向服务端保存：
    // POST /api/layout 已关闭（公开写接口会被任何人用来覆盖全站布局）；GET 保持公开只读。
    if (p === '/api/layout' && req.method === 'POST') {
      return sendJson(res, fail('服务端布局保存已关闭，布局只保存在浏览器本地'), 404)
    }
    if (routes[p]) {
      try {
        const result = await routes[p](req, url)
        return sendJson(res, result)
      } catch (e) {
        return sendJson(res, fail(e.message || e), 200)
      }
    }
    if (p.startsWith('/api/')) return sendJson(res, fail('unknown api'), 404)

    // 静态文件
    let file = p === '/' ? '/index.html' : p
    const filePath = path.join(DIST, decodeURIComponent(file))
    if (!filePath.startsWith(DIST)) { res.writeHead(403); return res.end('forbidden') }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        // SPA fallback：未知路径回 index.html
        fs.readFile(path.join(DIST, 'index.html'), (err2, data2) => {
          if (err2) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found — 请先构建前端 (npm run build)') }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(data2)
        })
        return
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' })
      res.end(data)
    })
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(fail(e.message || e)))
  }
})

server.listen(PORT, HOST, () => {
  console.log(`laowang-dashboard listening on http://${HOST}:${PORT}`)
})
