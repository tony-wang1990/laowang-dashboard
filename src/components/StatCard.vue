<template>
  <section :class="bare ? 'stat-block' : 'card stat-card'">
    <div class="stat-head">
      <span class="stat-icon" :style="{ background: meta.bg, color: meta.fg }">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" v-html="meta.icon"></svg>
      </span>
      <span class="stat-label">{{ meta.label }}</span>
    </div>
    <div v-if="loading && value == null" class="loading">加载中…</div>
    <div v-else-if="value == null" class="empty">暂无数据</div>
    <template v-else>
      <div class="stat-value" :title="valueTitle">{{ value }}<small v-if="unit">{{ unit }}</small></div>
      <div class="stat-bottom">
        <div class="stat-bar" v-if="pct != null"><i :style="{ width: pct + '%', background: meta.bar }"></i></div>
        <div class="stat-sub" :title="sub">{{ sub }}</div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useApi, fmtUptime } from '../useApi.js'

const props = defineProps({
  config: { type: Object, default: () => ({}) },
  title: { type: String, default: '' },
  // bare：去掉卡片外壳，只留指标本体，供 StatStrip（通栏指标条）复用
  bare: { type: Boolean, default: false }
})
const kind = computed(() => props.config.metric || 'cpu')

const { data: sys, loading: sysLoading } = useApi('/api/system', 60000)
// CPU 使用率与实时上下行来自运维区 10 秒采样（只读公开接口）
const { data: ops, loading: opsLoading } = useApi('/api/ops/metrics?range=1h', 30000)
const loading = computed(() => sysLoading.value || opsLoading.value)

const ICONS = {
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  mem: '<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 11h.01M10 11h.01M14 11h.01M18 11h.01M7 17v2M17 17v2"/>',
  disk: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  load: '<path d="M5 19a9 9 0 1 1 14 0"/><path d="M12 13l3.5-3.5"/><path d="M12 13v.01"/>',
  net: '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7.2 10.8l9.6-3.6M7.2 13.2l9.6 3.6"/>'
}
const META = {
  cpu: { label: 'CPU', bg: '#eff6ff', fg: '#1e40af', icon: ICONS.cpu, bar: 'linear-gradient(90deg,#2563eb,#06b6d4)' },
  mem: { label: '内存', bg: '#ecfdf5', fg: '#047857', icon: ICONS.mem, bar: 'linear-gradient(90deg,#059669,#34d399)' },
  disk: { label: '系统盘', bg: '#eff6ff', fg: '#1d4ed8', icon: ICONS.disk, bar: 'linear-gradient(90deg,#7c3aed,#a78bfa)' },
  load: { label: '1 分钟负载', bg: '#fff7ed', fg: '#c2410c', icon: ICONS.load, bar: 'linear-gradient(90deg,#ea580c,#f59e0b)' },
  net: { label: '实时网络', bg: '#f5f3ff', fg: '#6d28d9', icon: ICONS.net, bar: 'linear-gradient(90deg,#2563eb,#7c3aed)' }
}
const meta = computed(() => META[kind.value] || META.cpu)

function fmt1(n) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toFixed(1)
}
function fmtRate(bps) {
  if (bps == null || isNaN(bps)) return { num: '—', unit: '' }
  if (bps >= 1e6) return { num: (bps / 1e6).toFixed(1), unit: 'MB/s' }
  if (bps >= 1e3) return { num: (bps / 1e3).toFixed(1), unit: 'KB/s' }
  return { num: String(Math.round(bps)), unit: 'B/s' }
}

// 每种指标：{ value, unit, pct（有进度条的才给）, sub, valueTitle }
const stat = computed(() => {
  const s = sys.value
  const latest = ops.value?.latest || null
  switch (kind.value) {
    case 'cpu': {
      if (!latest) return { value: '—', unit: '', pct: null, sub: '采集中…', valueTitle: 'CPU 使用率采集中' }
      return { value: fmt1(latest.cpu), unit: '%', pct: latest.cpu, sub: '当前总使用率', valueTitle: `CPU 使用率 ${fmt1(latest.cpu)}%` }
    }
    case 'mem': {
      if (!s) return null
      return { value: fmt1(s.memUsedPct), unit: '%', pct: s.memUsedPct, sub: `${fmt1(s.memUsedMB)} / ${fmt1(s.memTotalMB)} MB`, valueTitle: `内存 ${fmt1(s.memUsedMB)} / ${fmt1(s.memTotalMB)} MB` }
    }
    case 'disk': {
      if (!s || !s.disk) return null
      return { value: fmt1(s.disk.usedPct), unit: '%', pct: s.disk.usedPct, sub: `${fmt1(s.disk.usedGB)} / ${fmt1(s.disk.totalGB)} GB`, valueTitle: `磁盘 ${fmt1(s.disk.usedGB)} / ${fmt1(s.disk.totalGB)} GB` }
    }
    case 'load': {
      if (!s) return null
      return { value: String(s.load1), unit: '', pct: null, sub: `${s.cpuCount} 个 CPU 核心`, valueTitle: `1 分钟负载 ${s.load1}，${s.cpuCount} 核` }
    }
    case 'net': {
      if (!latest) return { value: '—', unit: '', pct: null, sub: '采集中…', valueTitle: '网络速率采集中' }
      const total = fmtRate((latest.down || 0) + (latest.up || 0))
      const down = fmtRate(latest.down || 0)
      const up = fmtRate(latest.up || 0)
      return {
        value: total.num, unit: total.unit, pct: null,
        sub: `↓${down.num} ${down.unit} · ↑${up.num} ${up.unit}`,
        valueTitle: `下行 ${down.num} ${down.unit}，上行 ${up.num} ${up.unit}`
      }
    }
    default:
      return null
  }
})

const value = computed(() => stat.value?.value ?? null)
const unit = computed(() => stat.value?.unit ?? '')
const pct = computed(() => stat.value?.pct ?? null)
const sub = computed(() => stat.value?.sub ?? '')
const valueTitle = computed(() => stat.value?.valueTitle ?? '')
</script>

<style scoped>
/* KPanel 式单指标卡：图标 + 小标签 → 大号数字 → 细进度条 → 底部小字 */
.stat-card, .stat-block {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
}
/* 指标条里的大数字模式：无卡片外壳，数字更大 */
.stat-block { padding: 2px 4px; min-width: 0; }
.stat-block .stat-value { font-size: 34px; }
.stat-head { display: flex; align-items: center; gap: 9px; min-width: 0; }
.stat-icon {
  width: 30px; height: 30px; border-radius: 9px; flex: none;
  display: flex; align-items: center; justify-content: center;
}
.stat-label {
  font-size: 13px; color: var(--text-2); font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.stat-value {
  font-size: 30px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1;
  font-variant-numeric: tabular-nums; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.stat-value small { font-size: 14px; font-weight: 500; color: var(--text-3); margin-left: 3px; }
.stat-bottom { min-width: 0; }
.stat-bar { height: 5px; border-radius: 99px; background: #eef2f7; overflow: hidden; margin-bottom: 9px; }
.stat-bar > i { display: block; height: 100%; border-radius: 99px; background: var(--blue); transition: width 0.5s ease; }
.stat-sub {
  font-size: 12px; color: var(--text-3); font-variant-numeric: tabular-nums;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
</style>
