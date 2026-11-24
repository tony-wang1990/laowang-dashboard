<template>
  <section class="card">
    <div class="card-head">
      <span class="card-dot" style="background: var(--emerald)"></span>
      <span class="card-title">{{ title || '服务器状态' }}</span>
      <span class="card-sub">{{ data?.hostname || 'VPS' }}</span>
    </div>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error" class="empty">暂无数据</div>
    <div v-else>
      <div class="grid">
        <div class="metric">
          <div class="label">CPU 负载（1 分钟）</div>
          <div class="big-num">{{ data.load1 }}<small>/ {{ data.cpuCount }} 核</small></div>
        </div>
        <div class="metric">
          <div class="label">运行时间</div>
          <div class="big-num" style="font-size: 22px; line-height: 1.5">{{ fmtUptime(data.uptimeSec) }}</div>
        </div>
      </div>
      <div class="meter">
        <div class="meter-head"><span class="label">内存</span><span class="meter-val">{{ data.memUsedMB }} / {{ data.memTotalMB }} MB · {{ data.memUsedPct }}%</span></div>
        <div class="bar"><i :style="{ width: data.memUsedPct + '%', background: 'var(--emerald)' }"></i></div>
      </div>
      <div class="meter" v-if="data.disk">
        <div class="meter-head"><span class="label">磁盘 /</span><span class="meter-val">{{ data.disk.usedGB }} / {{ data.disk.totalGB }} GB · {{ data.disk.usedPct }}%</span></div>
        <div class="bar"><i :style="{ width: data.disk.usedPct + '%', background: 'var(--blue)' }"></i></div>
      </div>
      <div class="foot">
        <span class="label">{{ data.cpuModel }}</span>
        <span class="label" v-if="data.ip">{{ data.ip.ip }} · {{ data.ip.city || data.ip.country || '' }}</span>
        <span class="label" v-else>Node {{ data.node }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
import { useApi, fmtUptime } from '../useApi.js'
const { data, loading, error } = useApi('/api/system', 60000)
</script>

<style scoped>
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.metric .big-num { margin-top: 4px; }
.meter { margin-bottom: 12px; }
.meter-head { display: flex; justify-content: space-between; margin-bottom: 6px; }
.meter-val { font-size: 12px; color: var(--text-2); font-variant-numeric: tabular-nums; }
.foot { display: flex; justify-content: space-between; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #f1f4f8; }
.foot .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
