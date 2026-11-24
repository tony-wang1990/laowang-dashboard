<template>
  <section class="card chart-card"><div class="card-head"><span class="card-dot" style="background: var(--blue)"></span><span class="card-title">{{ title || '趋势图表' }}</span></div>
  <div class="chart-wrap">
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error || !data.points || data.points.length < 2" class="empty">
      数据采集中…（本机每 30 秒采样一次，稍等片刻即有曲线）
    </div>
    <template v-else>
      <div class="chart-box" ref="box">
        <canvas ref="canvas"></canvas>
      </div>
      <div class="label chart-src">数据来源：{{ data.source }}</div>
    </template>
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
const box = ref(null)
let chart = null
let boxObserver = null

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
  // 兜底：盒子尺寸变化时强制重算（Chart.js 自带的监听在首屏时序里可能漏掉一次）
  if (box.value && !boxObserver) {
    boxObserver = new ResizeObserver(() => { if (chart) chart.resize() })
    boxObserver.observe(box.value)
  }
}

// flush:'post' 很关键：默认 'pre' 会在数据到来的同一 tick、Vue 还没把
// canvas 渲染进 DOM 时就触发 render()，canvas.value 是 null 直接 return，
// 图表要等 30 秒后下一次刷新才出现。'post' 等 DOM 更新完再画，首屏就有图。
watch(data, render, { flush: 'post' })
watch(() => props.config.metric, render, { flush: 'post' })
onMounted(render)
onUnmounted(() => { boxObserver?.disconnect(); if (chart) chart.destroy() })
</script>

<style scoped>
/* 图表区高度必须有确定值：以前画布在文档流里（canvas height:100%!important），
   Chart.js 按父容器给画布定高，父容器高度又由画布内容撑起来——互相顶，
   窄屏下每 30 秒数据一刷新就把画布撑到 13538px，页面无限变长。
   现在画布改成绝对定位（脱离文档流，撑不起父容器），chart-box 的高度只由
   flex-basis（240px）和卡片高度决定，Chart.js 只按容器算尺寸，循环就断了。
   上限 420px 是兜底：即使将来再有异常测量，画布也不会顶爆页面。 */
.chart-card { display: flex; flex-direction: column; }
.chart-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.chart-box { flex: 1 1 240px; min-height: 200px; max-height: 420px; position: relative; overflow: hidden; }
.chart-box canvas { position: absolute; inset: 0; display: block; }
.chart-src { margin-top: 6px; }
/* 没数据时把提示文字在图表区里垂直居中，别顶在上方留一大片空 */
.chart-wrap > .loading, .chart-wrap > .empty { flex: 1; display: flex; align-items: center; justify-content: center; }
</style>
