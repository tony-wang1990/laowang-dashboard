<template>
  <div class="ops">
    <!-- 未登录：登录框 -->
    <div v-if="authChecked && !loggedIn" class="card login-card">
      <div class="card-head">
        <span class="card-dot" style="background: var(--rose)"></span>
        <span class="card-title">运维区需要登录</span>
      </div>
      <p class="login-desc">
        这里能启停容器、清理镜像、看日志，所以要口令才能进。
        <span v-if="!adminEnabled">（当前未设置 ADMIN_PASSWORD，无法登录）</span>
      </p>
      <form class="login-form" @submit.prevent="doLogin" v-if="adminEnabled">
        <input v-model="password" type="password" placeholder="输入运维口令" autocomplete="current-password" />
        <button type="submit" :disabled="loginBusy">{{ loginBusy ? '验证中…' : '登录' }}</button>
      </form>
      <p class="login-error" v-if="loginError">{{ loginError }}</p>
    </div>
    <div v-else-if="!authChecked" class="loading">正在确认登录状态…</div>

    <!-- 已登录：运维内容 -->
    <template v-else>
      <div class="ops-bar">
        <span class="label">运维区 · 仅你本人可操作</span>
        <button class="btn ghost" @click="doLogout">退出登录</button>
      </div>

      <!-- 主机信息 -->
      <section class="card">
        <div class="card-head">
          <span class="card-dot" style="background: var(--emerald)"></span>
          <span class="card-title">主机信息</span>
          <span class="card-sub">{{ host?.hostname || '' }}</span>
        </div>
        <div v-if="hostLoading" class="loading">加载中…</div>
        <div v-else-if="!host" class="empty">暂无数据</div>
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
        <div class="label" style="margin-top: 8px">数据来源：后端每 10 秒采样本机指标，保留 24 小时，每 5 分钟落盘；重启后从落盘文件恢复。</div>
      </section>

      <!-- Docker 管理 -->
      <section class="card">
        <div class="card-head">
          <span class="card-dot" style="background: var(--violet)"></span>
          <span class="card-title">Docker 容器管理</span>
          <span class="card-sub" v-if="docker">共 {{ docker.count }} 个</span>
        </div>
        <div v-if="dockerLoading" class="loading">加载中…</div>
        <div v-else-if="!docker" class="empty">暂无数据（宿主机 Docker 不可用）</div>
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
                  <button class="mini" @click="containerAction(c, 'start')" :disabled="c.running || busy[c.id]">启动</button>
                  <button class="mini" @click="containerAction(c, 'stop')" :disabled="!c.running || busy[c.id]">停止</button>
                  <button class="mini" @click="containerAction(c, 'restart')" :disabled="busy[c.id]">重启</button>
                  <button class="mini" @click="showLogs(c)">日志</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="prune-row">
            <button class="btn" @click="pruneImages" :disabled="pruneBusy">{{ pruneBusy ? '清理中…' : '清理悬空镜像' }}</button>
            <span class="label" v-if="pruneResult">{{ pruneResult }}</span>
          </div>
        </div>
        <div class="images" v-if="images?.images?.length">
          <div class="label" style="margin: 14px 0 6px">镜像（只读）</div>
          <div class="row" v-for="im in images.images" :key="im.id">
            <span class="grow mono">{{ im.tags[0] || '(悬空)' }} <span class="label">{{ im.id }}</span></span>
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
        <div v-else-if="!processes" class="empty">暂无数据</div>
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
          <div class="meter" v-for="d in disk.disks" :key="d.mount">
            <div class="meter-head"><span class="label">挂载点 {{ d.mount }}</span><span class="meter-val">{{ d.usedGB }} / {{ d.totalGB }} GB · {{ d.usedPct }}%</span></div>
            <div class="bar"><i :style="{ width: d.usedPct + '%', background: 'var(--blue)' }"></i></div>
          </div>
          <div class="label" style="margin: 16px 0 6px">大目录 Top 10 <span v-if="disk.scanning">（统计中…）</span></div>
          <div class="row" v-for="t in disk.topDirs" :key="t.path">
            <span class="grow mono">{{ t.path }}</span>
            <span style="font-weight: 650">{{ t.sizeMB >= 1024 ? (t.sizeMB / 1024).toFixed(2) + ' GB' : t.sizeMB + ' MB' }}</span>
          </div>
        </div>
      </section>

      <!-- 站点监测（复用） -->
      <UptimeCard />
    </template>

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

const authChecked = ref(false)
const loggedIn = ref(false)
const adminEnabled = ref(false)
const password = ref('')
const loginBusy = ref(false)
const loginError = ref('')

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
const busy = ref({})
const pruneBusy = ref(false)
const pruneResult = ref('')
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

async function checkAuth() {
  try {
    const j = await getJson('/api/ops/auth/status')
    loggedIn.value = !!j?.data?.loggedIn
    adminEnabled.value = !!j?.data?.adminEnabled
  } catch { loggedIn.value = false }
  authChecked.value = true
  if (loggedIn.value) startPolling()
}

async function doLogin() {
  loginBusy.value = true
  loginError.value = ''
  try {
    const res = await fetch('/api/ops/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value })
    })
    const j = await res.json()
    if (j?.ok) {
      loggedIn.value = true
      password.value = ''
      startPolling()
    } else {
      loginError.value = j?.error || '登录失败'
    }
  } catch {
    loginError.value = '网络异常'
  } finally {
    loginBusy.value = false
  }
}

async function doLogout() {
  try { await fetch('/api/ops/auth/logout', { method: 'POST' }) } catch { /* 忽略 */ }
  loggedIn.value = false
  stopPolling()
}

async function loadMetrics() {
  metricsLoading.value = true
  try {
    const j = await getJson(`/api/ops/metrics?range=${range.value}`)
    if (j?.ok) points.value = j.data.points || []
  } catch { /* 保持旧数据 */ }
  metricsLoading.value = false
}
async function loadHost() {
  hostLoading.value = true
  try {
    const j = await getJson('/api/ops/host')
    if (j?.ok) host.value = j.data
  } catch { /* 忽略 */ }
  hostLoading.value = false
}
async function loadDocker() {
  dockerLoading.value = true
  try {
    const j = await getJson('/api/ops/docker')
    if (j?.ok) docker.value = j.data
    const im = await getJson('/api/ops/images')
    if (im?.ok) images.value = im.data
  } catch { /* 忽略 */ }
  dockerLoading.value = false
}
async function loadProcesses() {
  procLoading.value = true
  try {
    const j = await getJson('/api/ops/processes')
    if (j?.ok) processes.value = j.data
  } catch { /* 忽略 */ }
  procLoading.value = false
}
async function loadDisk() {
  diskLoading.value = true
  try {
    const j = await getJson('/api/ops/disk')
    if (j?.ok) disk.value = j.data
  } catch { /* 忽略 */ }
  diskLoading.value = false
}

function setRange(r) {
  range.value = r
  loadMetrics()
}

async function containerAction(c, action) {
  const verb = { start: '启动', stop: '停止', restart: '重启' }[action]
  if (action !== 'start' && !confirm(`确定要${verb}容器 ${c.name} 吗？`)) return
  busy.value = { ...busy.value, [c.id]: true }
  try {
    const res = await fetch(`/api/ops/docker/${c.id}/${action}`, { method: 'POST' })
    const j = await res.json()
    if (!j?.ok) alert(`${verb}失败：${j?.error || '未知错误'}`)
    else setTimeout(loadDocker, 1500)
  } catch {
    alert('网络异常')
  } finally {
    busy.value = { ...busy.value, [c.id]: false }
  }
}

async function pruneImages() {
  if (!confirm('确定要清理 Docker 悬空镜像吗？会删除所有无标签的镜像。')) return
  pruneBusy.value = true
  pruneResult.value = ''
  try {
    const res = await fetch('/api/ops/docker/prune', { method: 'POST' })
    const j = await res.json()
    pruneResult.value = j?.ok ? `已清理 ${j.data.deleted} 个悬空镜像` : `清理失败：${j?.error || '未知错误'}`
    loadDocker()
  } catch {
    pruneResult.value = '网络异常'
  } finally {
    pruneBusy.value = false
  }
}

async function showLogs(c) {
  logModal.value = c
  logLoading.value = true
  logText.value = ''
  try {
    const j = await getJson(`/api/ops/docker/${c.id}/logs?tail=200`)
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

watch(points, drawCharts)

function startPolling() {
  stopPolling()
  loadMetrics(); loadHost(); loadDocker(); loadProcesses(); loadDisk()
  timers = [
    setInterval(loadMetrics, 10_000),
    setInterval(loadDocker, 15_000),
    setInterval(loadProcesses, 30_000),
    setInterval(loadHost, 60_000),
    setInterval(loadDisk, 5 * 60_000)
  ]
}
function stopPolling() {
  timers.forEach(clearInterval)
  timers = []
}

onMounted(checkAuth)
onUnmounted(() => {
  stopPolling()
  if (chartCpuObj) chartCpuObj.destroy()
  if (chartNetObj) chartNetObj.destroy()
})
</script>

<style scoped>
.ops { display: flex; flex-direction: column; gap: 20px; }
.ops-bar { display: flex; justify-content: space-between; align-items: center; }
.login-card { max-width: 480px; margin: 40px auto; width: 100%; }
.login-desc { font-size: 13.5px; color: var(--text-2); line-height: 1.7; margin-bottom: 16px; }
.login-form { display: flex; gap: 8px; }
.login-form input {
  flex: 1; height: 42px; border: 1px solid var(--border); border-radius: 10px;
  padding: 0 14px; font-size: 14px; outline: none;
}
.login-form input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12); }
.login-form button {
  height: 42px; padding: 0 22px; border: none; border-radius: 10px;
  background: var(--blue); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
}
.login-error { color: var(--rose); font-size: 13px; margin-top: 10px; }
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
.prune-row { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
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
