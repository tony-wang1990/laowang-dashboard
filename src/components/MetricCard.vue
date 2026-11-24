<template>
  <section class="card metric-card"><div class="card-head"><span class="card-dot" style="background: var(--emerald)"></span><span class="card-title">{{ title || '数字指标' }}</span></div>
  <div class="metrics">
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error" class="empty">暂无数据</div>
    <div v-else class="metric-grid">
      <div class="metric" v-for="m in shown" :key="m.key">
        <div class="label">{{ m.label }}</div>
        <div class="big-num" :title="String(m.value) + (m.unit || '')">{{ m.value }}<small v-if="m.unit">{{ m.unit }}</small></div>
        <div class="label sub" v-if="m.sub" :title="m.sub">{{ m.sub }}</div>
      </div>
    </div>
  </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useApi, fmtNum, fmtUptime } from '../useApi.js'

const props = defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
// config.metrics：逗号分隔，可选 load / mem / disk / uptime / ip / docker
const { data, loading, error } = useApi('/api/system', 60000)
const { data: docker } = useApi('/api/docker', 60000)

const ALL = {
  load: (d) => ({ label: 'CPU 负载（1 分钟）', value: d.load1, unit: `/ ${d.cpuCount} 核` }),
  mem: (d) => ({ label: '内存占用', value: d.memUsedPct, unit: '%', sub: `${fmtNum(d.memUsedMB)} / ${fmtNum(d.memTotalMB)} MB` }),
  disk: (d) => d.disk
    ? { label: '磁盘占用', value: d.disk.usedPct, unit: '%', sub: `${d.disk.usedGB} / ${d.disk.totalGB} GB` }
    : { label: '磁盘占用', value: '—' },
  uptime: (d) => ({ label: '运行时间', value: fmtUptime(d.uptimeSec) }),
  ip: (d) => d.ip
    ? { label: '公网 IP', value: d.ip.ip, sub: `${d.ip.country || ''} ${d.ip.city || ''} · ${d.ip.isp || ''}`.trim() }
    : { label: '公网 IP', value: '—' },
  docker: () => ({ label: 'Docker 容器', value: docker.value ? docker.value.count : '—', unit: '个' })
}

const shown = computed(() => {
  if (!data.value) return []
  const keys = (props.config.metrics || 'load,mem,uptime,ip').split(',').map((s) => s.trim()).filter(Boolean)
  return keys.map((k) => ALL[k] ? { key: k, ...ALL[k](data.value) } : null).filter(Boolean)
})
</script>

<style scoped>
/* 卡片自身作为容器查询容器：窄了自动 4 列变 2x2 */
.metric-card { container-type: inline-size; }
.metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
.metric { min-width: 0; }
.metric .big-num {
  margin-top: 4px;
  font-size: 22px;
  /* 按卡片宽度自适应：放不下就缩小字号，绝不把一个值劈成两截 */
  font-size: clamp(15px, 2.6cqw, 22px);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.metric .big-num small { font-size: 0.62em; margin-left: 2px; }
.metric .label:last-child { margin-top: 2px; }
.metric .sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@container (max-width: 620px) {
  .metric-grid { grid-template-columns: repeat(2, 1fr); }
  .metric .big-num { font-size: clamp(15px, 5cqw, 26px); }
}
</style>
