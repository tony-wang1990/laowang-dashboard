<template>
  <section class="card card-fill">
    <div class="card-head">
      <span class="card-dot" style="background: var(--cyan)"></span>
      <span class="card-title">{{ data?.city ? data.city + '天气' : (title || '上海天气') }}</span>
      <span class="card-sub">{{ data?.sourceName || 'Open-Meteo' }}</span>
    </div>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error" class="empty">暂无数据</div>
    <div v-else class="fill-body">
      <div class="now">
        <div class="temp">{{ Math.round(data.temp) }}<small>°C</small></div>
        <div class="cond">
          <div class="cond-text">{{ data.text || weatherText(data.code) }}</div>
          <div class="label">湿度 {{ data.humidity }}% · 风速 {{ data.wind }} km/h</div>
        </div>
      </div>
      <div class="hours">
        <div v-for="h in data.hours" :key="h.time" class="hour">
          <div class="label">{{ h.time }}</div>
          <div class="hour-temp">{{ Math.round(h.temp) }}°</div>
          <div class="label">{{ h.text || weatherText(h.code) }}</div>
        </div>
      </div>
      <WarningList :city="warnCity" head-text="天气预警" empty-text="当前无生效预警" />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
import { useApi, weatherText } from '../useApi.js'
import WarningList from './WarningList.vue'
// 城市改了自动重拉：空 = 默认上海
const apiPath = computed(() => {
  const city = (props.config.city || '').trim()
  return city ? `/api/weather?city=${encodeURIComponent(city)}` : '/api/weather'
})
// 预警按卡片自己的城市查（默认上海；国外城市查不到中国预警，显示无预警，不报错）
const warnCity = computed(() => (props.config.city || '').trim() || '上海')
const { data, loading, error } = useApi(apiPath, 5 * 60 * 1000)
</script>

<style scoped>
.now { display: flex; align-items: center; gap: 18px; margin-bottom: 14px; }
.temp { font-size: 54px; font-weight: 800; letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums;
  background: linear-gradient(120deg, #2563eb, #06b6d4); -webkit-background-clip: text; background-clip: text; color: transparent; }
.temp small { font-size: 20px; font-weight: 500; color: var(--text-3); }
.cond-text { font-size: 17px; font-weight: 650; margin-bottom: 4px; }
.hours { display: flex; gap: 4px; overflow-x: auto; padding-top: 12px; border-top: 1px solid #f1f4f8; }
.hour { flex: 1; min-width: 52px; text-align: center; }
.hour-temp { font-size: 15px; font-weight: 650; margin: 4px 0 2px; font-variant-numeric: tabular-nums; }
</style>
