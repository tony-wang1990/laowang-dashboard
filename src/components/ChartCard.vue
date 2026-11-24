<template>
  <section class="card"><div class="card-head"><span class="card-dot" style="background: var(--blue)"></span><span class="card-title">{{ title || '趋势图表' }}</span></div>
  <div class="chart-wrap">
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error || !data.points || data.points.length < 2" class="empty">
      数据采集中…（本机每 30 秒采样一次，稍等片刻即有曲线）
    </div>
    <div v-else class="chart-box">
      <canvas ref="canvas"></canvas>
      <div class="label chart-src">数据来源：{{ data.source }}</div>
    </div>
  </div>
  </section>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { Chart, LineController, LineElement, PointElement, LinearScale, TimeScale, CategoryScale, Tooltip, Legend, Filler } from 'chart.js'
import { useApi } from '../useApi.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, CategoryScale, Tooltip, Legend, Filler)

const props = defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
const { data, loading, error } = useApi('/api/history', 30000)
const canvas = ref(null)
let chart = null

function render() {
  if (!canvas.value || !data.value?.points?.length) return
  const pts = data.value.points
  const labels = pts.map((p) => new Date(p.t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
  const metric = props.config.metric || 'load'
  if (chart) chart.destroy()
  chart = new Chart(canvas.value, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: metric === 'mem' ? '内存占用 %' : 'CPU 负载',
          data: pts.map((p) => (metric === 'mem' ? p.memPct : p.load1)),
          borderColor: metric === 'mem' ? '#059669' : '#2563eb',
          backgroundColor: metric === 'mem' ? 'rgba(5,150,105,0.08)' : 'rgba(37,99,235,0.08)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6, color: '#94a3b8', font: { size: 11 } } },
        y: { grid: { color: '#eef2f7' }, ticks: { color: '#94a3b8', font: { size: 11 } }, beginAtZero: true }
      }
    }
  })
}

watch(data, render)
watch(() => props.config.metric, render)
onMounted(render)
onUnmounted(() => { if (chart) chart.destroy() })
</script>

<style scoped>
.chart-box { position: relative; height: 190px; }
.chart-box canvas { width: 100% !important; height: 170px !important; }
.chart-src { margin-top: 6px; }
</style>
