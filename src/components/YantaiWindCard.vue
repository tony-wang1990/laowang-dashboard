<template>
  <section class="card card-fill">
    <div class="card-head">
      <span class="card-dot" style="background: var(--cyan)"></span>
      <span class="card-title">{{ title || '烟台风力/停航' }}</span>
      <span class="card-sub">{{ updatedText }}</span>
    </div>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error" class="empty">暂无数据</div>
    <template v-else>
      <div class="risk" :class="'risk-' + data.risk.level">
        <div class="risk-big">{{ data.risk.text }}</div>
        <div class="risk-sub">海面风 {{ fmt(data.sea.windMs) }} m/s（{{ data.sea.beaufort }} 级）· 阵风 {{ fmt(data.sea.gustMs) }} m/s（{{ data.sea.gustBeaufort }} 级）</div>
        <div class="risk-note">{{ data.risk.note }}</div>
      </div>
      <div class="fill-body">
        <div class="wind-row">
          <span class="label">陆地风 · 烟台</span>
          <span class="wind-val">{{ fmt(data.land.windMs) }} m/s（{{ data.land.beaufort }} 级）· 阵风 {{ fmt(data.land.gustMs) }} m/s（{{ data.land.gustBeaufort }} 级）· {{ data.land.dirText || '—' }}风</span>
        </div>
        <div class="wind-row">
          <span class="label">海面风 · 崆峒岛附近海域</span>
          <span class="wind-val">{{ fmt(data.sea.windMs) }} m/s（{{ data.sea.beaufort }} 级）· 阵风 {{ fmt(data.sea.gustMs) }} m/s（{{ data.sea.gustBeaufort }} 级）· {{ data.sea.dirText || '—' }}风</span>
        </div>
        <div class="wind-row">
          <span class="label">浪高 · 崆峒岛附近海域</span>
          <span class="wind-val" v-if="data.waves">有效波高 {{ fmt(data.waves.height) }} m · 风浪 {{ fmt(data.waves.windWave) }} m · 涌浪 {{ fmt(data.waves.swell) }} m · 周期 {{ fmt(data.waves.period) }} s</span>
          <span class="wind-val" v-else>浪高暂无数据</span>
        </div>
        <div class="hours" v-if="data.seaHours && data.seaHours.length">
          <div v-for="h in data.seaHours" :key="h.time" class="hour">
            <div class="label">{{ h.time }}</div>
            <div class="hour-temp">{{ fmt(h.windMs) }}<small class="unit"> m/s</small></div>
            <div class="label">{{ h.beaufort }} 级</div>
          </div>
        </div>
        <div class="days">
          <div class="days-head label">未来 7 天 · 每日最大风（海面）</div>
          <div v-for="d in data.days" :key="d.date" class="day-row">
            <span class="day-label">{{ d.label }} {{ d.date }}</span>
            <span class="day-wind">最大 {{ fmt(d.maxWindMs) }} m/s（{{ d.beaufort }} 级）</span>
            <span class="day-gust">阵风 {{ fmt(d.maxGustMs) }} m/s（{{ d.gustBeaufort }} 级）</span>
            <span class="day-flag" :class="dayFlagClass(d)">{{ dayFlagText(d) }}</span>
          </div>
        </div>
        <WarningList city="烟台" province="山东" type="大风" head-text="大风预警" empty-text="当前无生效大风预警" />
      </div>
      <div class="fill-foot links">
        <a href="https://www.sd.msa.gov.cn/" target="_blank" rel="noopener">山东海事局 ↗</a>
        <a href="http://www.nmc.cn/f/alarm.html" target="_blank" rel="noopener">中央气象台预警 ↗</a>
        <a href="tel:05356506666">烟台港客运 0535-6506666</a>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
import { useApi } from '../useApi.js'
import WarningList from './WarningList.vue'
const { data, loading, error } = useApi('/api/yantai-wind', 30 * 60 * 1000)

function fmt(v) { return v == null ? '—' : v }
const updatedText = computed(() => {
  if (!data.value?.updatedAt) return 'Open-Meteo · 免费免 key'
  try {
    const t = new Date(data.value.updatedAt)
    return '更新于 ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0')
  } catch { return 'Open-Meteo · 免费免 key' }
})
// 当日定级只看持续风（阵风只展示、不定级）：持续风 ≥8 级（＞7 级）停航，
// 6–7 级停航风险，其余正常——阵风平时也常冲到 7–9 级，不能按阵风定级
function dayFlagClass(d) {
  const b = d.beaufort ?? 0
  return b >= 8 ? 'flag-red' : b >= 6 ? 'flag-yellow' : 'flag-green'
}
function dayFlagText(d) {
  const b = d.beaufort ?? 0
  return b >= 8 ? '停航' : b >= 6 ? '停航风险' : '正常'
}
</script>

<style scoped>
.risk { border-radius: 12px; padding: 12px 14px; margin-bottom: 4px; }
.risk-green { background: #f0fdf4; border: 1px solid #bbf7d0; }
.risk-yellow { background: #fefce8; border: 1px solid #fde68a; }
.risk-red { background: #fef2f2; border: 1px solid #fecaca; }
.risk-big { font-size: 20px; font-weight: 800; line-height: 1.2; }
.risk-green .risk-big { color: #15803d; }
.risk-yellow .risk-big { color: #a16207; }
.risk-red .risk-big { color: #b91c1c; }
.risk-sub { font-size: 13px; margin-top: 4px; font-variant-numeric: tabular-nums; }
.risk-note { font-size: 12px; color: var(--text-3); margin-top: 2px; }
.wind-row { display: flex; flex-direction: column; gap: 2px; }
.wind-val { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.hours { display: flex; gap: 4px; overflow-x: auto; padding-top: 10px; border-top: 1px solid #f1f4f8; }
.hour { flex: 1; min-width: 48px; text-align: center; }
.hour-temp { font-size: 14px; font-weight: 650; margin: 3px 0 2px; font-variant-numeric: tabular-nums; }
.hour-temp .unit { font-size: 11px; font-weight: 400; color: var(--text-3); }
.days { display: flex; flex-direction: column; gap: 4px; padding-top: 10px; border-top: 1px solid #f1f4f8; }
.days-head { font-weight: 600; color: var(--text-2); }
.day-row { display: flex; align-items: baseline; gap: 8px; font-size: 13px; font-variant-numeric: tabular-nums; }
.day-label { flex: none; width: 74px; font-weight: 650; }
.day-wind { flex: 1; min-width: 0; }
.day-gust { flex: none; color: var(--text-2); }
.day-flag { flex: none; font-size: 12px; font-weight: 700; }
.flag-green { color: #15803d; }
.flag-yellow { color: #a16207; }
.flag-red { color: #b91c1c; }
.links { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; }
.links a { color: var(--blue); text-decoration: none; }
.links a:hover { text-decoration: underline; }
</style>
