<template>
  <div class="ops">
    <!-- KPanel 全功能运维面板（新窗口打开，不用 iframe：KPanel 安全头会挡 iframe） -->
    <a class="kpanel-banner" href="https://kp.199060.xyz/" target="_blank" rel="noopener">
      <span class="kpanel-icon">K</span>
      <span class="kpanel-text">
        <span class="kpanel-title">KPanel 全功能运维面板</span>
        <span class="kpanel-desc">终端、文件管理、Nginx 站点、Docker、应用市场 —— 在新窗口打开 KPanel（自带登录）</span>
      </span>
      <span class="kpanel-open">打开 KPanel ↗</span>
    </a>

    <!-- 切换主机：照天气卡换城市的样式；选择存 localStorage，下次打开还选这台 -->
    <div class="host-switcher">
      <span class="label">查看主机</span>
      <button class="host-btn" @click="showHostPicker = !showHostPicker" :title="'点这里切换主机'">
        <span class="status-dot" :class="selectedHost.online ? 'on' : 'off'"></span>
        {{ selectedHost.name }}<span class="city-caret">⌄</span>
      </button>
      <button class="city-btn" @click="showHostPicker = !showHostPicker">切换主机</button>
      <span v-if="isRemote && !selectedHost.online" class="label warn">主机离线，显示最后快照</span>
      <span v-if="hostsError" class="label warn">{{ hostsError }}</span>
    </div>
    <div v-if="showHostPicker" class="host-picker">
      <button
        v-for="h in hosts" :key="h.id" class="host-option"
        :class="{ active: h.id === hostId }" @click="switchHost(h.id)"
      >
        <span class="status-dot" :class="h.online ? 'on' : 'off'"></span>
        <span class="grow">{{ h.name }}</span>
        <span class="label">{{ h.isLocal ? '本机' : '轻节点' }} · {{ h.online ? '在线' : '离线' }}</span>
      </button>
      <div v-if="!kpanelConfigured" class="label" style="padding: 4px 2px 0">未配置 KPanel 凭据，只能看本机（部署时在 .env 里配 KPANEL_URL / KPANEL_USER / KPANEL_PASS）</div>
    </div>

    <!-- 主机信息 -->
      <section class="card">
        <div class="card-head">
          <span class="card-dot" style="background: var(--emerald)"></span>
          <span class="card-title">主机信息</span>
          <span class="card-sub">{{ host?.hostname || '' }}</span>
        </div>
        <div v-if="hostLoading" class="loading">加载中…</div>
        <div v-else-if="!host" class="empty">{{ hostError || '暂无数据' }}<button v-if="isRemote" class="mini" style="margin-left: 8px" @click="switchHost('local')">回本机</button></div>
        <div v-else class="host-grid">
          <div><div class="label">系统 / 内核</div><div class="host-val">{{ host.osType }} · {{ host.kernel }}</div></div>
          <div><div class="label">CPU</div><div class="host-val">{{ host.cpuModel }}</div></div>
          <div><div class="label">核心数</div><div class="host-val">{{ host.cpuCount }} 核</div></div>
          <div><div class="label">内存总量</div><div class="host-val">{{ fmtNum(host.memTotalMB) }} MB</div></div>
          <div><div class="label">运行时间</div><div class="host-val">{{ fmtUptime(host.uptimeSec) }}</div></div>
          <div><div class="label">公网 IP</div><div class="host-val">{{ host.ip?.ip || '—' }} · {{ host.ip?.city || '' }} {{ host.ip?.country || '' }}</div></div>
        </div>
      </section>

      <!-- 实时监控 -->
      <section class="card">
        <div class="card-head">
          <span class="card-dot" style="background: var(--blue)"></span>
          <span class="card-title">实时监控</span>
          <span class="card-sub">
            <button class="tab" :class="{ active: range === '1h' }" @click="setRange('1h')">1 小时</button>
            <button class="tab" :class="{ active: range === '6h' }" @click="setRange('6h')">6 小时</button>
            <button class="tab" :class="{ active: range === '24h' }" @click="setRange('24h')">24 小时</button>
          </span>
        </div>
        <div class="metric-row" v-if="latest">
          <div class="metric"><div class="label">CPU</div><div class="big-num">{{ latest.cpu }}<small>%</small></div></div>
          <div class="metric"><div class="label">内存</div><div class="big-num">{{ latest.mem }}<small>%</small></div></div>
          <div class="metric"><div class="label">负载 1 分钟</div><div class="big-num">{{ latest.load1 }}</div></div>
          <div class="metric"><div class="label">下行</div><div class="big-num">{{ fmtRate(latest.down) }}</div></div>
          <div class="metric"><div class="label">上行</div><div class="big-num">{{ fmtRate(latest.up) }}</div></div>
          <div class="metric"><div class="label">磁盘</div><div class="big-num">{{ latest.diskPct ?? '—' }}<small v-if="latest.diskPct != null">%</small></div></div>
        </div>
        <div v-if="metricsLoading" class="loading">加载中…</div>
        <div v-else-if="!points.length" class="empty">数据采集中…（后端每 10 秒采样一次，稍等片刻即有曲线）</div>
        <div v-else class="charts">
          <div class="chart-box"><canvas ref="chartCpu"></canvas><div class="label chart-cap">CPU / 内存占用 %</div></div>
          <div class="chart-box"><canvas ref="chartNet"></canvas><div class="label chart-cap">网络上下行（KB/s）</div></div>
        </div>
        <div class="label" style="margin-top: 8px">{{ metricsNote }}</div>
      </section>

      <!-- Docker 管理 -->
      <section class="card">
        <div class="card-head">
          <span class="card-dot" style="background: var(--violet)"></span>
          <span class="card-title">Docker 容器</span>
          <span class="card-sub" v-if="docker">共 {{ docker.count }} 个</span>
        </div>
        <div v-if="dockerLoading" class="loading">加载中…</div>
        <div v-else-if="!docker" class="empty">{{ dockerError || '暂无数据（宿主机 Docker 不可用）' }}<button v-if="isRemote" class="mini" style="margin-left: 8px" @click="switchHost('local')">回本机</button></div>
        <div v-else>
          <table class="tbl">
            <thead><tr><th>容器</th><th>镜像</th><th>状态</th><th>CPU</th><th>内存</th><th>端口</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="c in docker.containers" :key="c.id">
                <td><strong>{{ c.name }}</strong><div class="label">{{ c.status }}</div></td>
                <td class="mono">{{ shortImage(c.image) }}</td>
                <td><span class="status-dot" :class="c.running ? 'on' : 'off'"></span> {{ c.state }}</td>
                <td>{{ c.cpu }}%</td>
                <td>{{ c.memUsedMB }} / {{ c.memLimitMB }} MB</td>
                <td class="mono">{{ c.ports || '—' }}</td>
                <td class="ops-actions">
                  <button class="mini" @click="showLogs(c)">日志</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="images" v-if="images?.images?.length">
          <div class="label" style="margin: 14px 0 6px">镜像（只读）</div>
          <div class="row" v-for="im in images.images" :key="im.id">
            <span class="grow mono" :title="im.tags[0] || '(悬空)'">{{ im.tags[0] || '(悬空)' }} <span class="label">{{ im.id }}</span></span>
            <span class="label">{{ im.sizeMB }} MB · {{ im.created }}</span>
          </div>
        </div>
      </section>

      <!-- 进程 -->
      <section class="card">
        <div class="card-head">
          <span class="card-dot" style="background: var(--amber)"></span>
          <span class="card-title">进程 Top（按 CPU 排序，只读）</span>
        </div>
        <div v-if="procLoading" class="loading">加载中…</div>
        <div v-else-if="!processes" class="empty">{{ procError || '暂无数据' }}<button v-if="isRemote" class="mini" style="margin-left: 8px" @click="switchHost('local')">回本机</button></div>
        <table class="tbl" v-else>
          <thead><tr><th>PID</th><th>用户</th><th>CPU %</th><th>内存 %</th><th>运行时间</th><th>进程</th></tr></thead>
          <tbody>
            <tr v-for="p in processes.processes" :key="p.pid">
              <td>{{ p.pid }}</td><td>{{ p.user }}</td><td>{{ p.cpu }}</td><td>{{ p.mem }}</td>
              <td>{{ p.etime }}</td><td class="mono">{{ p.command }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 磁盘 -->
      <section class="card">
        <div class="card-head">
          <span class="card-dot" style="background: var(--cyan)"></span>
          <span class="card-title">磁盘</span>
        </div>
        <div v-if="diskLoading" class="loading">加载中…（首次统计大目录可能需要几秒）</div>
        <div v-else-if="!disk" class="empty">暂无数据</div>
        <div v-else>
          <div v-if="disk.remote" class="label" style="margin-bottom: 10px">远程主机只有根盘用量（KPanel 快照）；大目录 Top 10 统计仅本机可用。</div>
          <div class="meter" v-for="d in disk.disks" :key="d.mount">
            <div class="meter-head"><span class="label">挂载点 {{ d.mount }}</span><span class="meter-val">{{ d.usedGB }} / {{ d.totalGB }} GB · {{ d.usedPct }}%</span></div>
            <div class="bar"><i :style="{ width: d.usedPct + '%', background: 'var(--blue)' }"></i></div>
          </div>
          <div class="label" style="margin: 16px 0 6px">大目录 Top 10 <span v-if="disk.scanning">（统计中…）</span></div>
          <div class="row" v-for="t in disk.topDirs" :key="t.path">
            <span class="grow mono" :title="t.path">{{ t.path }}</span>
            <span style="font-weight: 650">{{ t.sizeMB >= 1024 ? (t.sizeMB / 1024).toFixed(2) + ' GB' : t.sizeMB + ' MB' }}</span>
          </div>
        </div>
      </section>

      <!-- 站点监测（复用） -->
      <UptimeCard />

    <!-- 日志弹窗 -->
    <div v-if="logModal" class="drawer-mask" @click.self="logModal = null">
      <aside class="drawer card">
        <div class="drawer-head">
          <h3>容器日志 · {{ logModal.name }}</h3>
          <button class="icon-btn" @click="logModal = null">×</button>
        </div>
        <div v-if="logLoading" class="loading">拉取中…</div>
        <pre v-else class="logs">{{ logText || '（无日志）' }}</pre>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler } from 'chart.js'
import UptimeCard from './UptimeCard.vue'
import { fmtNum, fmtUptime } from '../useApi.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler)

const range = ref('1h')
const points = ref([])
const metricsLoading = ref(false)
const host = ref(null)
const hostLoading = ref(false)
const docker = ref(null)
const dockerLoading = ref(false)
const images = ref(null)
const processes = ref(null)
const procLoading = ref(false)
const disk = ref(null)
const diskLoading = ref(false)

// --- 切换主机（照天气卡换城市的样式） ---
const HOST_KEY = 'laowang-dashboard-ops-host'
const hosts = ref([{ id: 'local', name: '本机', kind: 'panel', isLocal: true, online: true, state: 'online', hostname: '' }])
const hostId = ref('local')
try { hostId.value = localStorage.getItem(HOST_KEY) || 'local' } catch { hostId.value = 'local' }
const showHostPicker = ref(false)
const hostsError = ref('')
const kpanelConfigured = ref(false)
const hostError = ref('')
const dockerError = ref('')
const procError = ref('')
const selectedHost = computed(() => hosts.value.find((h) => h.id === hostId.value) || hosts.value[0])
const isRemote = computed(() => hostId.value !== 'local')
const metricsNote = computed(() => isRemote.value
  ? '数据来源：KPanel 集群历史监控（约每 1 分钟一个点）；切换主机后重新拉取。'
  : '数据来源：后端每 10 秒采样本机指标，保留 24 小时，每 5 分钟落盘；重启后从落盘文件恢复。')
function opsPath(path, params = {}) {
  const q = new URLSearchParams(params)
  if (isRemote.value) q.set('host', hostId.value)
  const s = q.toString()
  return s ? `${path}?${s}` : path
}
async function loadHosts() {
  try {
    const j = await getJson('/api/ops/hosts')
    if (j?.ok && Array.isArray(j.data?.hosts) && j.data.hosts.length) {
      hosts.value = j.data.hosts
      kpanelConfigured.value = !!j.data.kpanelConfigured
      hostsError.value = j.data.kpanelError || ''
      if (!hosts.value.some((h) => h.id === hostId.value)) hostId.value = 'local'
    }
  } catch { /* 保持只有本机 */ }
}
function switchHost(id) {
  if (id === hostId.value) { showHostPicker.value = false; return }
  hostId.value = id
  try { localStorage.setItem(HOST_KEY, id) } catch { /* 忽略 */ }
  showHostPicker.value = false
  host.value = null; points.value = []; docker.value = null; images.value = null; processes.value = null; disk.value = null
  hostError.value = ''; dockerError.value = ''; procError.value = ''
  startPolling()
}
const logModal = ref(null)
const logText = ref('')
const logLoading = ref(false)
const chartCpu = ref(null)
const chartNet = ref(null)
let chartCpuObj = null
let chartNetObj = null
let timers = []

const latest = computed(() => points.value[points.value.length - 1] || null)

async function getJson(path) {
  const res = await fetch(path)
  return res.json()
}

async function loadMetrics() {
  metricsLoading.value = true
  try {
    const j = await getJson(opsPath('/api/ops/metrics', { range: range.value }))
    if (j?.ok) points.value = j.data.points || []
  } catch { /* 保持旧数据 */ }
  metricsLoading.value = false
}
async function loadHost() {
  hostLoading.value = true
  try {
    const j = await getJson(opsPath('/api/ops/host'))
    if (j?.ok) { host.value = j.data; hostError.value = '' }
    else { host.value = null; hostError.value = j?.error || '暂无数据' }
  } catch { /* 忽略 */ }
  hostLoading.value = false
}
async function loadDocker() {
  dockerLoading.value = true
  try {
    const j = await getJson(opsPath('/api/ops/docker'))
    if (j?.ok) { docker.value = j.data; dockerError.value = '' }
    else { docker.value = null; dockerError.value = j?.error || '暂无数据' }
    const im = await getJson(opsPath('/api/ops/images'))
    images.value = im?.ok ? im.data : null
  } catch { /* 忽略 */ }
  dockerLoading.value = false
}
async function loadProcesses() {
  procLoading.value = true
  try {
    const j = await getJson(opsPath('/api/ops/processes'))
    if (j?.ok) { processes.value = j.data; procError.value = '' }
    else { processes.value = null; procError.value = j?.error || '暂无数据' }
  } catch { /* 忽略 */ }
  procLoading.value = false
}
async function loadDisk() {
  diskLoading.value = true
  try {
    const j = await getJson(opsPath('/api/ops/disk'))
    if (j?.ok) disk.value = j.data
  } catch { /* 忽略 */ }
  diskLoading.value = false
}

function setRange(r) {
  range.value = r
  loadMetrics()
}

async function showLogs(c) {
  logModal.value = c
  logLoading.value = true
  logText.value = ''
  try {
    const j = await getJson(opsPath(`/api/ops/docker/${c.id}/logs`, { tail: 200 }))
    logText.value = j?.ok ? j.data.logs : `拉取失败：${j?.error || '未知错误'}`
  } catch {
    logText.value = '网络异常'
  } finally {
    logLoading.value = false
  }
}

function fmtRate(bps) {
  if (bps == null) return '—'
  if (bps < 1024) return bps + ' B/s'
  return (bps / 1024).toFixed(1) + ' KB/s'
}
function shortImage(img) {
  if (!img) return ''
  return img.length > 44 ? img.slice(0, 44) + '…' : img
}

function drawCharts() {
  if (!chartCpu.value || !chartNet.value || !points.value.length) return
  const labels = points.value.map((p) => new Date(p.t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
  const base = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: true, labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { mode: 'index', intersect: false } },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 8, color: '#94a3b8', font: { size: 11 } } },
      y: { grid: { color: '#eef2f7' }, ticks: { color: '#94a3b8', font: { size: 11 } }, beginAtZero: true }
    }
  }
  if (chartCpuObj) chartCpuObj.destroy()
  if (chartNetObj) chartNetObj.destroy()
  chartCpuObj = new Chart(chartCpu.value, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'CPU %', data: points.value.map((p) => p.cpu), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.07)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 },
        { label: '内存 %', data: points.value.map((p) => p.mem), borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.07)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: base
  })
  chartNetObj = new Chart(chartNet.value, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: '下行 KB/s', data: points.value.map((p) => +(p.down / 1024).toFixed(1)), borderColor: '#0891b2', backgroundColor: 'rgba(8,145,178,0.07)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 },
        { label: '上行 KB/s', data: points.value.map((p) => +(p.up / 1024).toFixed(1)), borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,0.07)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: base
  })
}

// 注意：必须用 flush:'post'——loadMetrics 每轮都会先把 metricsLoading 置 true
// （图表区短暂换成“加载中”，画布被销毁），再写 points；默认 flush:'pre' 的
// watcher 会在画布重建前触发，chartCpu.value 还是 null，曲线永远画不出来
// （旧版登录后也一样空白，只是没人注意）。post 让回调在 DOM 更新后跑。
watch(points, drawCharts, { flush: 'post' })

function startPolling() {
  stopPolling()
  loadHosts(); loadMetrics(); loadHost(); loadDocker(); loadProcesses(); loadDisk()
  // 远程主机的历史曲线约每 1 分钟一个点，30 秒轮询足够；本机 10 秒采样保持 10 秒。
  // Docker/进程远程没有接口，只拉一次展示“不支持”，不轮询。
  timers = [
    setInterval(loadMetrics, isRemote.value ? 30_000 : 10_000),
    setInterval(loadHost, 60_000),
    setInterval(loadDisk, 5 * 60_000)
  ]
  if (!isRemote.value) {
    timers.push(setInterval(loadDocker, 15_000), setInterval(loadProcesses, 30_000))
  }
}
function stopPolling() {
  timers.forEach(clearInterval)
  timers = []
}

onMounted(startPolling)
onUnmounted(() => {
  stopPolling()
  if (chartCpuObj) chartCpuObj.destroy()
  if (chartNetObj) chartNetObj.destroy()
})
</script>

<style scoped>
.ops { display: flex; flex-direction: column; gap: 20px; }
.host-switcher { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.host-btn {
  display: inline-flex; align-items: center; gap: 8px;
  background: none; border: none; padding: 0; cursor: pointer;
  font-size: 16px; font-weight: 700; color: var(--text-1);
}
.host-btn:hover { color: var(--blue); }
.city-btn { flex: none; font-size: 12px; color: var(--blue); background: #eff6ff; border: 1px solid #dbeafe; border-radius: 999px; padding: 3px 10px; cursor: pointer; line-height: 1.4; }
.city-btn:hover { background: #dbeafe; }
.city-caret { font-size: 13px; color: var(--text-3); margin-left: 2px; }
.label.warn { color: var(--amber); }
.host-picker { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; background: #f8fafc; }
.host-option {
  display: flex; align-items: center; gap: 10px; width: 100%;
  background: none; border: none; border-radius: 8px; padding: 8px 10px;
  font-size: 14px; cursor: pointer; text-align: left; color: var(--text-1);
}
.host-option:hover { background: #eff6ff; }
.host-option.active { background: #dbeafe; font-weight: 700; }
.host-option .grow { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kpanel-banner {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px; border-radius: 14px;
  background: #eff6ff; border: 1px solid #bfdbfe;
  color: var(--text);
}
.kpanel-banner:hover { text-decoration: none; border-color: #93c5fd; box-shadow: var(--shadow); }
.kpanel-icon {
  width: 40px; height: 40px; border-radius: 12px; flex: none;
  display: flex; align-items: center; justify-content: center;
  background: var(--blue); color: #fff; font-size: 18px; font-weight: 700;
}
.kpanel-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.kpanel-title { font-size: 15px; font-weight: 700; }
.kpanel-desc { font-size: 12.5px; color: var(--text-2); line-height: 1.5; }
.kpanel-open {
  flex: none; padding: 8px 16px; border-radius: 99px;
  background: var(--blue); color: #fff; font-size: 13px; font-weight: 600; white-space: nowrap;
}
@media (max-width: 720px) {
  .kpanel-banner { flex-wrap: wrap; }
  .kpanel-open { margin-left: 54px; }
}
.host-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px 20px; }
.host-val { font-size: 14px; font-weight: 600; margin-top: 3px; word-break: break-all; }
.metric-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 16px; margin-bottom: 16px; }
.metric .big-num { margin-top: 4px; font-size: 26px; }
.charts { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.chart-box { position: relative; height: 220px; }
.chart-box canvas { width: 100% !important; height: 190px !important; }
.chart-cap { text-align: center; margin-top: 4px; }
.tab {
  border: none; background: none; font-size: 12px; color: var(--text-3);
  cursor: pointer; padding: 4px 8px; border-radius: 99px;
}
.tab.active { background: #eff6ff; color: var(--blue); font-weight: 600; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th { text-align: left; color: var(--text-3); font-weight: 550; font-size: 12px; padding: 8px 8px 8px 0; border-bottom: 1px solid var(--border); white-space: nowrap; }
.tbl td { padding: 10px 8px 10px 0; border-bottom: 1px solid #f1f4f8; vertical-align: top; }
.tbl tr:last-child td { border-bottom: none; }
.mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 12px; }
.mini {
  border: 1px solid var(--border); background: #fff; border-radius: 8px;
  padding: 4px 10px; font-size: 12px; cursor: pointer; margin-right: 4px; white-space: nowrap;
}
.mini:hover:not(:disabled) { border-color: var(--blue); color: var(--blue); }
.mini:disabled { opacity: 0.45; cursor: not-allowed; }
.ops-actions { white-space: nowrap; }
.meter { margin-bottom: 12px; }
.meter-head { display: flex; justify-content: space-between; margin-bottom: 6px; }
.meter-val { font-size: 12px; color: var(--text-2); font-variant-numeric: tabular-nums; }
.logs {
  background: #0f172a; color: #e2e8f0; border-radius: 10px; padding: 14px;
  font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all;
  max-height: 60vh; overflow: auto; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
.drawer-mask {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35);
  z-index: 100; display: flex; justify-content: flex-end;
}
.drawer { width: min(720px, 94vw); height: 100%; border-radius: 0; padding: 24px; overflow-y: auto; }
.drawer-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.drawer-head h3 { font-size: 17px; }
.icon-btn { border: none; background: none; font-size: 16px; color: var(--text-3); cursor: pointer; padding: 2px 6px; border-radius: 8px; line-height: 1; }
.icon-btn:hover { background: #f1f5f9; color: var(--text); }
.btn {
  height: 36px; padding: 0 16px; border-radius: 10px; border: 1px solid var(--border);
  background: #fff; font-size: 13.5px; font-weight: 600; cursor: pointer; color: var(--text);
}
.btn:hover { border-color: #cbd5e1; }
.btn.ghost { color: var(--text-2); }
@media (max-width: 900px) {
  .charts { grid-template-columns: 1fr; }
  .tbl { display: block; overflow-x: auto; }
}
</style>
