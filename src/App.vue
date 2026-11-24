<template>
  <div class="page">
    <nav class="topnav">
      <div class="brand"><span class="brand-dot"></span>老王数据看板</div>
      <div class="nav-tabs">
        <button class="nav-tab" :class="{ active: view === 'dashboard' }" @click="view = 'dashboard'">数据看板</button>
        <button class="nav-tab" :class="{ active: view === 'ops' }" @click="view = 'ops'">运维</button>
      </div>
    </nav>

    <template v-if="view === 'dashboard'">
    <HeaderBar />

    <!-- 工具栏：查看态 / 编辑态 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="toolbar-title">我的看板</span>
        <span class="label" v-if="savedAt">已保存 {{ savedAt }}</span>
        <span class="label warn" v-if="layoutNeedLogin">服务端布局保存需要先登录运维区</span>
        <span class="label" v-else>拖动卡片可自由拼看板</span>
      </div>
      <div class="toolbar-right">
        <button v-if="editMode" class="btn" @click="showAdd = !showAdd">＋ 添加卡片</button>
        <button v-if="editMode" class="btn ghost" @click="resetLayout">恢复默认布局</button>
        <button class="btn primary" @click="editMode = !editMode">
          {{ editMode ? '✓ 完成编辑' : '编辑布局' }}
        </button>
      </div>
    </div>
    <div v-if="editMode" class="edit-hint">
      编辑模式：按住卡片标题栏拖动位置，拖右下角调整大小；点 ⚙ 编辑卡片内容，点 × 删除卡片。
    </div>

    <!-- 添加卡片面板 -->
    <div v-if="showAdd && editMode" class="add-panel card">
      <div class="add-grid">
        <button v-for="t in CARD_TYPES" :key="t.type" class="add-item" @click="addCard(t.type)">
          <span class="card-dot" :style="{ background: t.color }"></span>
          <span class="add-name">{{ t.name }}</span>
          <span class="add-desc">{{ t.desc }}</span>
        </button>
      </div>
    </div>

    <!-- 可拖拽网格 -->
    <grid-layout
      v-if="displayLayout.length"
      :layout="displayLayout"
      :col-num="12"
      :row-height="100"
      :is-draggable="editMode && !isNarrow"
      :is-resizable="editMode && !isNarrow"
      :vertical-compact="true"
      :margin="[20, 20]"
      :use-css-transforms="true"
      @layout-updated="onLayoutUpdated"
    >
      <grid-item
        v-for="item in displayLayout"
        :key="item.i"
        :x="item.x" :y="item.y" :w="item.w" :h="item.h" :i="item.i"
      >
        <div class="grid-wrap" :data-i="item.i" :class="{ 'vue-draggable-handle': editMode }">
          <div class="grid-tools" v-if="editMode">
            <button class="icon-btn" @click.stop="openEditor(item)" title="编辑卡片">⚙</button>
            <button class="icon-btn danger" @click.stop="removeCard(item.i)" title="删除卡片">×</button>
          </div>
          <component :is="componentOf(item.type)" :config="item.config || {}" :title="item.title || cardTypeOf(item.type).name" />
        </div>
      </grid-item>
    </grid-layout>

    <footer class="foot">
      <span>老王数据看板 · LaoWang Dashboard v1.0.0</span>
      <span>数据每 60 秒自动刷新 · 行情 / 天气每 5 分钟 · 接口异常时显示“暂无数据”</span>
      <a href="https://github.com/tony-wang1990/laowang-dashboard" target="_blank" rel="noopener">GitHub 开源</a>
    </footer>
    </template>

    <template v-else>
      <OpsView />
      <footer class="foot">
        <span>老王数据看板 · 运维区</span>
        <span>监控每 10 秒采样 · 容器操作与日志需要登录 · 全功能运维（终端、文件、Nginx）在 KPanel · 多主机集群见 Roadmap</span>
        <a href="https://github.com/tony-wang1990/laowang-dashboard" target="_blank" rel="noopener">GitHub 开源</a>
      </footer>
    </template>

    <!-- 编辑抽屉 -->
    <div v-if="editing" class="drawer-mask" @click.self="closeEditor">
      <aside class="drawer card">
        <div class="drawer-head">
          <h3>编辑卡片</h3>
          <button class="icon-btn" @click="closeEditor">×</button>
        </div>
        <label class="field">
          <span class="field-label">卡片标题</span>
          <input v-model="editing.title" type="text" />
        </label>
        <label class="field" v-for="f in cardTypeOf(editing.type).fields" :key="f.key">
          <span class="field-label">{{ f.label }}</span>
          <textarea v-if="f.kind === 'textarea'" v-model="editing.config[f.key]" :placeholder="f.placeholder" rows="4"></textarea>
          <select v-else-if="f.kind === 'select'" v-model="editing.config[f.key]">
            <option v-for="o in f.options" :key="o.v" :value="o.v">{{ o.n }}</option>
          </select>
          <input v-else v-model="editing.config[f.key]" type="text" :placeholder="f.placeholder" />
        </label>
        <p class="label" v-if="cardTypeOf(editing.type).fields.length === 0">此卡片无需配置。</p>
        <button class="btn primary block" @click="saveEditor">保存</button>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import HeaderBar from './components/HeaderBar.vue'
import WeatherCard from './components/WeatherCard.vue'
import SystemCard from './components/SystemCard.vue'
import DockerCard from './components/DockerCard.vue'
import UptimeCard from './components/UptimeCard.vue'
import CryptoCard from './components/CryptoCard.vue'
import RatesCard from './components/RatesCard.vue'
import GithubCard from './components/GithubCard.vue'
import TrendingCard from './components/TrendingCard.vue'
import NewsCard from './components/NewsCard.vue'
import QuickLinks from './components/QuickLinks.vue'
import NotesCard from './components/NotesCard.vue'
import TextCard from './components/TextCard.vue'
import MetricCard from './components/MetricCard.vue'
import StatCard from './components/StatCard.vue'
import StatStrip from './components/StatStrip.vue'
import ChartCard from './components/ChartCard.vue'
import RssCard from './components/RssCard.vue'
import CustomApiCard from './components/CustomApiCard.vue'
import IframeCard from './components/IframeCard.vue'
import OpsView from './components/OpsView.vue'
import { CARD_TYPES, cardTypeOf, newCard, DEFAULT_LAYOUT } from './cards.js'

const COMPONENTS = {
  weather: WeatherCard, system: SystemCard, docker: DockerCard, uptime: UptimeCard,
  crypto: CryptoCard, rates: RatesCard, github: GithubCard, trending: TrendingCard,
  news: NewsCard, quicklinks: QuickLinks, notes: NotesCard,
  text: TextCard, metric: MetricCard, stat: StatCard, statstrip: StatStrip, chart: ChartCard, rss: RssCard,
  custom: CustomApiCard, iframe: IframeCard
}
function componentOf(type) { return COMPONENTS[type] || TextCard }

const LAYOUT_KEY = 'laowang-dashboard-layout-v2'
const layout = ref([])
const view = ref('dashboard')
const editMode = ref(false)
const showAdd = ref(false)
const editing = ref(null)
const savedAt = ref('')
const layoutNeedLogin = ref(false) // 服务端保存布局被 401 拒绝时提示登录运维区

// ---------- 窄屏堆叠 ----------
// 视口 < 640px 时 12 列网格会把 w=4 的卡压到约 120px 宽，值被省略成一两个字。
// 窄屏下网格改按单列全宽堆叠（宁可页面长一点，也不要把卡压扁）；
// 源布局（12 列坐标）原样保留，只做显示层派生：displayLayout 在桌面就是
// layout 本身，窄屏则是按源布局顺序重排的单列克隆。窄屏的高度调整也
// 只记在 narrowH 里，绝不回写源布局和服务端。
// 注意：不用 vue-grid-layout 自带的 responsive——这个 beta 版的
// responsiveGridLayout 只在用户拖拽缩放卡片时触发，窗口 resize 时
// 根本不切换断点。
const NARROW_W = 640
const vw = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const isNarrow = computed(() => vw.value < NARROW_W)
const narrowTick = ref(0)
const narrowH = new Map()
const displayLayout = computed(() => {
  if (!isNarrow.value) return layout.value
  void narrowTick.value
  const items = [...layout.value].sort((a, b) => (a.y - b.y) || (a.x - b.x))
  let y = 0
  return items.map((it) => {
    const h = Math.max(it.h, narrowH.get(it.i) ?? 0)
    const placed = { ...it, x: 0, y, w: 12, h }
    y += h
    return placed
  })
})
let vwTimer = null
function onWinResize() {
  clearTimeout(vwTimer)
  vwTimer = setTimeout(() => { vw.value = window.innerWidth }, 120)
}

function clone(v) { return JSON.parse(JSON.stringify(v)) }

// 布局迁移（幂等）：
// 1) 旧默认布局里的 metric-1（关键指标）换成「实时指标条」——通栏一整条大数字，
//    原来那一行及以下的行整体下移 2 行腾地方；用户自己删掉 metric-1 的不触发，
//    已有 stat 卡或指标条的不重复加；其它卡片的配置和位置原样保留。
// 1b) 上一版的 5 张分开的单指标卡（stat-*）也收成一条指标条：5 张卡占 12 列时
//    左右各留 1 列空隙、窄屏还会排错行；指标条占满一整行，窄屏自动换行。
// 2) quicklinks-1 旧 h=2 装不下 7 个入口，改成 h=3，下面的卡下移 1 行。
// 3) 资讯 / 趋势图 / 仓库 / 趋势 / RSS 列表类卡片实测内容约 440px，本来就需要
//    h=4（以前误以为 h=3 够，自动调整会把它长回 4）；默认布局已改成 h=4，
//    这里不再动它，只保证老布局里被误缩到 h=3 的也补回 h=4。
// 4) 站点监测 uptime-1 补到 h=3，和同行的加密货币 / 汇率底部平齐。
function migrateLayout(items) {
  let changed = false
  const hasStat = items.some((it) => it.type === 'stat')
  const hasStrip = items.some((it) => it.type === 'statstrip')
  const mi = items.findIndex((it) => it.i === 'metric-1')
  if (!hasStat && !hasStrip && mi >= 0) {
    const old = items[mi]
    const rowY = old.y
    items.forEach((it) => { if (it !== old && it.y >= rowY) it.y += 2 })
    items.splice(mi, 1)
    items.push({ i: 'statstrip-1', x: 0, y: rowY, w: 12, h: 2, type: 'statstrip', title: '实时指标', config: {} })
    changed = true
  }
  if (!hasStrip && hasStat) {
    const stats = items.filter((it) => it.type === 'stat')
    const rowY = Math.min(...stats.map((it) => it.y))
    // 指标条占整行（x=0,w=12）：行里若有别的卡片（极少见，用户自己拖的），把它下移 2 行避让
    items.forEach((it) => { if (it.type !== 'stat' && it.y >= rowY && it.y < rowY + 2) it.y += 2 })
    for (let i = items.length - 1; i >= 0; i--) if (items[i].type === 'stat') items.splice(i, 1)
    items.push({ i: 'statstrip-1', x: 0, y: rowY, w: 12, h: 2, type: 'statstrip', title: '实时指标', config: {} })
    changed = true
  }
  const qi = items.findIndex((it) => it.i === 'quicklinks-1')
  if (qi >= 0 && items[qi].h === 2) {
    const q = items[qi]
    const bottom = q.y + q.h
    items.forEach((it) => { if (it !== q && it.y >= bottom) it.y += 1 })
    q.h = 3
    changed = true
  }
  for (const id of ['news-1', 'chart-1', 'github-1', 'trending-1', 'rss-1']) {
    const it = items.find((x) => x.i === id)
    if (it && it.h === 3) { it.h = 4; changed = true }
  }
  const up = items.find((x) => x.i === 'uptime-1')
  if (up && up.h === 2) { up.h = 3; changed = true }
  return changed
}

async function loadLayout() {
  let items = null
  // 1) 本机 localStorage 优先
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length) items = parsed
    }
  } catch { /* 忽略 */ }
  // 2) 服务端 /api/layout
  if (!items) {
    try {
      const res = await fetch('/api/layout')
      const json = await res.json()
      if (json?.ok && Array.isArray(json.data.layout) && json.data.layout.length) {
        items = json.data.layout
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(items))
      }
    } catch { /* 忽略 */ }
  }
  // 3) 默认布局
  if (!items) items = clone(DEFAULT_LAYOUT)
  // 旧布局迁移（新卡默认出现、快捷入口加高），改完落盘
  const changed = migrateLayout(items)
  layout.value = items
  if (changed) persist()
}

let saveTimer = null
function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout.value)) } catch { /* 忽略 */ }
    try {
      const r = await fetch('/api/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: layout.value })
      })
      // 未登录时服务端返回 401：提示去登录运维区，本机 localStorage 布局不受影响
      layoutNeedLogin.value = r.status === 401
    } catch { /* 服务端保存失败不影响本机 */ }
    const now = new Date()
    savedAt.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  }, 500)
}

function onLayoutUpdated(newLayout) {
  // 窄屏下网格显示的是派生布局（单列全宽），它的坐标不能回写源布局
  if (isNarrow.value) return
  // 同步拖拽/缩放后的位置尺寸
  const map = new Map(newLayout.map((l) => [l.i, l]))
  layout.value.forEach((item) => {
    const n = map.get(item.i)
    if (n) { item.x = n.x; item.y = n.y; item.w = n.w; item.h = n.h }
  })
  persist()
}

// ---------- 卡片自适应高度 ----------
// 原则：任何卡片的内容（长标题、长文本、多行列表）都不能超出卡片区域。
// 卡片本身 height:auto + min-height:100%（见下方样式），内容变高卡片就跟着
// 长高；ResizeObserver 监听到后，把对应网格项的 h 按行高换算调大，
// 下面的卡自动下移。只自动长高、不自动缩短，用户手动调大的尺寸不会
// 被收回去；每次调整都走 persist() 落盘。
// 另外：同一行的卡片按「该行内容最高的那张」取齐（底部平齐）——
// 用户明确要求站点监测 / 加密货币 / 汇率那一行底部对齐。代价是同一行里
// 手动把某一张单独调矮会被自动补回行高（行内高度以内容最满的那张为准）；
// 想让一张卡比同行矮，请把它拖到单独一行。
const ROW_H = 100, MARGIN_Y = 20, MAX_GRID_H = 12
let cardObserver = null, gridMutObserver = null, autoResizeTimer = null
const observedCards = new WeakSet()

function rowsForHeight(px) {
  // 网格项 h 行的高度 = h*100 + (h-1)*20；反推行数
  return Math.max(1, Math.ceil((px + MARGIN_Y) / (ROW_H + MARGIN_Y)))
}
function autoResizePass() {
  // 1) 每张卡按内容高度算出需要的行数（量的是实际渲染出来的卡片：
  //    桌面是源布局里的卡，窄屏是单列派生布局里的卡）
  const items = displayLayout.value
  const needById = new Map()
  document.querySelectorAll('.vue-grid-item .grid-wrap > .card').forEach((card) => {
    const id = card.closest('.grid-wrap')?.dataset.i
    if (!id) return
    const item = items.find((it) => it.i === id)
    if (!item) return
    // scrollHeight 兜底：万一有内容溢出卡片（旧版图表画布那种），也按它算，
    // 但单次最多只长 1 行，防止异常测量值把布局顶爆
    const need = Math.min(rowsForHeight(Math.max(card.offsetHeight, card.scrollHeight)), item.h + 1, MAX_GRID_H)
    needById.set(id, need)
  })
  if (isNarrow.value) {
    // 窄屏：高度只记到 narrowH（派生布局重算时用），不碰源布局；
    // 单列堆叠不需要行取齐
    let changed = false
    needById.forEach((need, id) => {
      if (need > (narrowH.get(id) ?? 0)) { narrowH.set(id, need); changed = true }
    })
    if (changed) narrowTick.value++
    return
  }
  // 2) 同一行取齐：行高 = 该行所有卡片内容需要的最大值
  const rowMax = new Map()
  items.forEach((it) => {
    const need = needById.get(it.i)
    if (need == null) return
    rowMax.set(it.y, Math.max(rowMax.get(it.y) ?? 0, need))
  })
  let changed = false
  items.forEach((it) => {
    const rowNeed = rowMax.get(it.y)
    if (rowNeed == null) return
    const target = Math.max(it.h, Math.min(rowNeed, MAX_GRID_H))
    if (target > it.h) { it.h = target; changed = true }
  })
  if (changed) {
    // 关键：vue-grid-layout 的 layout watcher 是浅监听，直接改 item.h 不会
    // 触发它的 compact()，下面的卡不会下移；换一个数组引用才会触发
    // watcher → compact → 下面的卡自动下移 → 触发 layout-updated 回写。
    layout.value = [...layout.value]
    persist()
  }
}
// 一次性高度归一：旧版图表画布无限伸高 + 窄屏换行曾把不少卡片的 h 顶大
// （且自动调整只长不短，所以一直留着）。首次加载（数据回来后 3 秒）
// 把 h 比「默认值 / 内容需要」高出 2 行以上的卡片缩回合理高度；
// 每个浏览器只跑一次，之后用户手动调的尺寸不再动。
const NORM_KEY = 'laowang-dashboard-layout-v3-normalized'
function normalizeHeights() {
  // 窄屏下先不归一（量的是单列派生布局），等回到桌面宽度再做
  if (isNarrow.value) { setTimeout(normalizeHeights, 3000); return }
  try { if (localStorage.getItem(NORM_KEY)) return } catch { return }
  const cards = [...document.querySelectorAll('.vue-grid-item .grid-wrap > .card')]
  if (!cards.length) return
  // 同步测完再恢复 min-height，不产生可见闪烁
  cards.forEach((c) => { c.style.minHeight = '0px' })
  let changed = false
  cards.forEach((card) => {
    const id = card.closest('.grid-wrap')?.dataset.i
    if (!id) return
    const item = layout.value.find((it) => it.i === id)
    if (!item) return
    const need = rowsForHeight(card.scrollHeight)
    const defH = cardTypeOf(item.type)?.h ?? item.h
    const target = Math.max(defH, need)
    if (item.h > target + 1) { item.h = target; changed = true }
  })
  cards.forEach((c) => { c.style.minHeight = '' })
  try { localStorage.setItem(NORM_KEY, '1') } catch { /* 忽略 */ }
  if (changed) { layout.value = [...layout.value]; persist() }
}
function scheduleAutoResize() {
  clearTimeout(autoResizeTimer)
  autoResizeTimer = setTimeout(autoResizePass, 150)
}
function observeCards() {
  if (!cardObserver) return
  document.querySelectorAll('.vue-grid-item .grid-wrap > .card').forEach((card) => {
    if (observedCards.has(card)) return
    observedCards.add(card)
    cardObserver.observe(card)
  })
}
function setupAutoResize() {
  cardObserver = new ResizeObserver(() => scheduleAutoResize())
  observeCards()
  const grid = document.querySelector('.vue-grid-layout')
  if (grid) {
    // 新增 / 删除卡片时重新扫描
    gridMutObserver = new MutationObserver(() => { observeCards(); scheduleAutoResize() })
    gridMutObserver.observe(grid, { childList: true, subtree: true })
  }
  scheduleAutoResize()
  // 数据基本回来后再做一次性高度归一（每个浏览器只跑一次）
  setTimeout(normalizeHeights, 3000)
}

function addCard(type) {
  const card = newCard(type)
  const maxY = layout.value.reduce((m, it) => Math.max(m, it.y + it.h), 0)
  card.y = maxY
  layout.value.push(card)
  showAdd.value = false
  persist()
}

function removeCard(i) {
  layout.value = layout.value.filter((it) => it.i !== i)
  persist()
}

function resetLayout() {
  if (!confirm('确定恢复默认布局吗？现在的拖拽和增删都会丢掉。')) return
  layout.value = clone(DEFAULT_LAYOUT)
  persist()
}

function openEditor(item) {
  editing.value = clone(item)
}
function saveEditor() {
  const idx = layout.value.findIndex((it) => it.i === editing.value.i)
  if (idx >= 0) layout.value[idx] = clone(editing.value)
  editing.value = null
  persist()
}
function closeEditor() { editing.value = null }

onMounted(() => {
  loadLayout()
  nextTick(setupAutoResize)
  window.addEventListener('resize', onWinResize)
  // 支持 #ops 深链直达运维区
  if (window.location.hash === '#ops') view.value = 'ops'
  window.addEventListener('hashchange', () => {
    view.value = window.location.hash === '#ops' ? 'ops' : 'dashboard'
  })
})
onUnmounted(() => {
  cardObserver?.disconnect()
  gridMutObserver?.disconnect()
  clearTimeout(autoResizeTimer)
  clearTimeout(vwTimer)
  window.removeEventListener('resize', onWinResize)
})
watch(view, (v) => {
  const hash = v === 'ops' ? '#ops' : '#'
  if (window.location.hash !== hash) history.replaceState(null, '', hash === '#' ? window.location.pathname : hash)
})
</script>

<style scoped>
.page { max-width: 1440px; margin: 0 auto; padding: 24px 24px 16px; }
.topnav {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  margin-bottom: 20px;
}
.brand { display: flex; align-items: center; gap: 9px; font-size: 17px; font-weight: 750; letter-spacing: 0.01em; }
.brand-dot { width: 11px; height: 11px; border-radius: 4px; background: var(--blue); display: inline-block; }
.nav-tabs { display: flex; gap: 4px; background: #e9edf3; border-radius: 12px; padding: 4px; }
.nav-tab {
  border: none; background: none; padding: 7px 20px; border-radius: 9px;
  font-size: 14px; font-weight: 600; color: var(--text-2); cursor: pointer;
}
.nav-tab.active { background: #fff; color: var(--text); box-shadow: var(--shadow); }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 20px 0 4px; flex-wrap: wrap; }
.toolbar .warn { color: var(--rose); }
.toolbar-left { display: flex; align-items: baseline; gap: 12px; }
.toolbar-title { font-size: 17px; font-weight: 700; }
.toolbar-right { display: flex; gap: 8px; flex-wrap: wrap; }
.btn {
  height: 36px; padding: 0 16px; border-radius: 10px; border: 1px solid var(--border);
  background: #fff; font-size: 13.5px; font-weight: 600; cursor: pointer; color: var(--text);
}
.btn:hover { border-color: #cbd5e1; }
.btn.primary { background: var(--blue); border-color: var(--blue); color: #fff; }
.btn.primary:hover { background: #1d4ed8; }
.btn.ghost { color: var(--text-2); }
.btn.block { width: 100%; margin-top: 16px; }
.edit-hint {
  margin: 8px 0 0; padding: 10px 14px; border-radius: 12px;
  background: #eff6ff; color: #1d4ed8; font-size: 13px; line-height: 1.6;
}
.add-panel { margin-top: 14px; padding: 16px; }
.add-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.add-item {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px;
  background: #fff; cursor: pointer; text-align: left;
}
.add-item:hover { border-color: var(--blue); box-shadow: var(--shadow); }
.add-name { font-size: 13.5px; font-weight: 650; }
.add-desc { font-size: 12px; color: var(--text-3); line-height: 1.45; }
.grid-wrap { position: relative; height: 100%; }
.grid-wrap.vue-draggable-handle { cursor: grab; }
.grid-wrap.vue-draggable-handle:active { cursor: grabbing; }
/* 卡片自适应高度：高度由内容撑开（至少占满网格项），内容变高时
   ResizeObserver 会把网格项的 h 调大，绝不截断、不重叠 */
.grid-wrap > .card { height: auto; min-height: 100%; }
.grid-tools {
  position: absolute; top: 10px; right: 12px; z-index: 5;
  display: flex; gap: 2px; background: rgba(255, 255, 255, 0.9);
  border-radius: 8px; padding: 2px;
}
.icon-btn {
  border: none; background: none; font-size: 16px; color: var(--text-3);
  cursor: pointer; padding: 2px 6px; border-radius: 8px; line-height: 1;
}
.icon-btn:hover { background: #f1f5f9; color: var(--text); }
.icon-btn.danger:hover { background: #fff1f2; color: var(--rose); }
.card-body { flex: 1; min-height: 0; overflow: auto; }
.card-body::-webkit-scrollbar { width: 4px; }
.card-body::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px; }
.foot {
  display: flex; gap: 16px; justify-content: space-between; flex-wrap: wrap;
  margin-top: 24px; padding: 16px 4px 8px;
  font-size: 12px; color: var(--text-3);
  border-top: 1px solid var(--border);
}
.drawer-mask {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35);
  z-index: 100; display: flex; justify-content: flex-end;
}
.drawer {
  width: min(420px, 92vw); height: 100%; border-radius: 0;
  padding: 24px; overflow-y: auto;
}
.drawer-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.drawer-head h3 { font-size: 17px; }
.field { display: block; margin-bottom: 14px; }
.field-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.field input, .field textarea, .field select {
  width: 100%; border: 1px solid var(--border); border-radius: 10px;
  padding: 9px 12px; font-size: 13.5px; outline: none; background: #fff; color: var(--text);
  font-family: inherit;
}
.field input:focus, .field textarea:focus, .field select:focus {
  border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
@media (max-width: 720px) {
  .page { padding: 16px 14px 12px; }
}
</style>
