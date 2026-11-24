<template>
  <section class="card">
    <div class="card-head">
      <span class="card-dot" style="background: var(--emerald)"></span>
      <span class="card-title">{{ title || '服务器状态' }}</span>
      <span class="card-sub">{{ data?.hostname || 'VPS' }}</span>
    </div>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error" class="empty">暂无数据</div>
    <!-- KPanel 式两列定义列表：标签小字在上、值清晰，行间分隔线，关键值绝不断行 -->
    <div v-else class="dl">
      <div class="dl-item" v-for="f in fields" :key="f.label">
        <div class="label">{{ f.label }}</div>
        <div class="dl-val" :title="f.title || f.value">{{ f.value }}</div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
import { useApi, fmtUptime } from '../useApi.js'
// /api/ops/host 是只读公开接口：systemInfo + 磁盘 + 公网 IP + 内核 + 操作系统
const { data, loading, error } = useApi('/api/ops/host', 60000)

function fmt1(n) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toFixed(1)
}

const fields = computed(() => {
  const d = data.value
  if (!d) return []
  const ip = d.ip ? `${d.ip.ip} · ${[d.ip.city, d.ip.country].filter(Boolean).join(' ')}` : '—'
  return [
    { label: '操作系统', value: d.osType || d.platform || '—' },
    { label: '内核', value: d.kernel || '—' },
    { label: 'CPU 型号', value: d.cpuModel || '—' },
    { label: 'CPU 规格', value: `${d.cpuCount} 核` },
    { label: '系统负载', value: `${d.load1} / ${d.load5} / ${d.load15}`, title: '1 / 5 / 15 分钟负载' },
    { label: '运行时间', value: fmtUptime(d.uptimeSec) },
    { label: '公网 IP', value: ip },
    { label: '内存', value: `${fmt1(d.memUsedMB)} / ${fmt1(d.memTotalMB)} MB · ${d.memUsedPct}%` },
    { label: '磁盘', value: d.disk ? `${fmt1(d.disk.usedGB)} / ${fmt1(d.disk.totalGB)} GB · ${d.disk.usedPct}%` : '—' }
  ]
})
</script>

<style scoped>
.dl { display: grid; grid-template-columns: 1fr 1fr; column-gap: 20px; }
.dl-item { padding: 6px 0; border-top: 1px solid #f1f4f8; min-width: 0; }
.dl-item:nth-child(-n+2) { border-top: none; }
.dl-val {
  font-size: 14px; font-weight: 550; margin-top: 3px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
</style>
