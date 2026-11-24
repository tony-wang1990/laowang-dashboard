<template>
  <section class="card card-fill">
    <div class="card-head">
      <span class="card-dot" style="background: var(--cyan)"></span>
      <button class="city-title" @click="togglePicker" :title="'点这里切换城市'">
        {{ data?.city ? data.city + '天气' : (title || '上海天气') }}<span class="city-caret">⌄</span>
      </button>
      <button class="city-btn" @click="togglePicker">切换城市</button>
      <span class="card-sub">{{ data?.sourceName || 'Open-Meteo' }}</span>
    </div>
    <div v-if="showPicker" class="city-picker">
      <div class="picker-row">
        <input v-model="inputCity" type="text" placeholder="输入城市，如 烟台 / 廊坊 / Los Angeles" @keyup.enter="applyCity" />
        <button class="btn primary" @click="applyCity">确定</button>
      </div>
      <div class="picker-chips">
        <button v-for="c in quickCities" :key="c" class="chip" @click="pickCity(c)">{{ c }}</button>
      </div>
    </div>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error" class="empty">暂无数据</div>
    <div v-else class="fill-body">
      <div class="now">
        <div class="temp">{{ Math.round(data.temp) }}<small>°C</small></div>
        <div class="cond">
          <div class="cond-text">{{ data.text || weatherText(data.code) }}</div>
          <div class="label">湿度 {{ data.humidity }}% · 风速 {{ data.wind }} km/h</div>
          <div class="label" v-if="data.today">今日最高 {{ Math.round(data.today.high) }}° · 最低 {{ Math.round(data.today.low) }}°</div>
        </div>
      </div>
      <div class="hours">
        <div v-for="h in data.hours" :key="h.time" class="hour">
          <div class="label">{{ h.time }}</div>
          <div class="hour-temp">{{ Math.round(h.temp) }}°</div>
          <div class="label">{{ h.text || weatherText(h.code) }}</div>
          <div class="hour-pop" v-if="h.pop != null">{{ h.pop }}%</div>
          <div class="hour-pop empty" v-else>&nbsp;</div>
        </div>
      </div>
      <div v-if="data.daily && data.daily.length" class="daily">
        <div v-for="d in data.daily" :key="d.fullDate" class="day">
          <div class="label day-label">{{ d.label }}</div>
          <div class="day-cond">{{ weatherText(d.code) }}</div>
          <div class="day-temp"><b>{{ Math.round(d.high) }}°</b><span class="day-low"> / {{ Math.round(d.low) }}°</span></div>
          <div class="day-pop" v-if="d.pop != null">{{ d.pop }}%</div>
          <div class="day-pop empty" v-else>&nbsp;</div>
        </div>
      </div>
      <WarningList :city="warnCity" head-text="天气预警" empty-text="当前无生效预警" />
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
const props = defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
const emit = defineEmits(['update:city'])
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

// 卡片内快速换城市：点城市名或“切换城市”打开选择器；快捷城市一点即换，
// 输入框回车/点确定也换（空 = 默认上海）。改完经 update:city 写回 App.vue
// 的布局配置并落盘，和编辑抽屉里的“城市”字段是同一份配置，自动同步。
const showPicker = ref(false)
const inputCity = ref('')
const quickCities = ['上海', '烟台', '廊坊', '北京', '深圳', '广州', '成都', '洛杉矶']
function togglePicker() {
  showPicker.value = !showPicker.value
  if (showPicker.value) inputCity.value = (props.config.city || '').trim()
}
function pickCity(c) { emit('update:city', c); showPicker.value = false }
function applyCity() {
  emit('update:city', inputCity.value.trim())
  inputCity.value = ''
  showPicker.value = false
}
</script>

<style scoped>
.city-title { background: none; border: none; padding: 0; cursor: pointer; font-size: 16px; font-weight: 700; letter-spacing: 0.02em; color: var(--text-1); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.city-title:hover { color: var(--blue); }
.city-caret { font-size: 13px; color: var(--text-3); margin-left: 2px; }
.city-btn { flex: none; font-size: 12px; color: var(--blue); background: #eff6ff; border: 1px solid #dbeafe; border-radius: 999px; padding: 3px 10px; cursor: pointer; line-height: 1.4; }
.city-btn:hover { background: #dbeafe; }
.city-picker { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; margin-bottom: 12px; }
.picker-row { display: flex; gap: 8px; }
.picker-row input { flex: 1; min-width: 0; border: 1px solid #dbe4ee; border-radius: 8px; padding: 7px 10px; font-size: 13px; outline: none; background: #fff; }
.picker-row input:focus { border-color: var(--blue); }
.picker-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.chip { font-size: 12px; border: 1px solid #dbe4ee; background: #fff; border-radius: 999px; padding: 4px 11px; cursor: pointer; color: var(--text-2); }
.chip:hover { border-color: var(--blue); color: var(--blue); }
.now { display: flex; align-items: center; gap: 18px; margin-bottom: 14px; }
.temp { font-size: 54px; font-weight: 800; letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums;
  background: linear-gradient(120deg, #2563eb, #06b6d4); -webkit-background-clip: text; background-clip: text; color: transparent; }
.temp small { font-size: 20px; font-weight: 500; color: var(--text-3); }
.cond-text { font-size: 17px; font-weight: 650; margin-bottom: 4px; }
.hours { display: flex; gap: 4px; overflow-x: auto; padding-top: 12px; border-top: 1px solid #f1f4f8; }
.hour { flex: 1; min-width: 52px; text-align: center; }
.hour-temp { font-size: 15px; font-weight: 650; margin: 4px 0 2px; font-variant-numeric: tabular-nums; }
.hour-pop { font-size: 11px; color: #0284c7; margin-top: 2px; font-variant-numeric: tabular-nums; }
.hour-pop.empty { visibility: hidden; }
/* 7 日逐日预报：星期 + 状况 + 高温/低温 + 降水概率，和逐小时同一套紧凑风格 */
.daily { display: flex; gap: 4px; padding-top: 10px; margin-top: 10px; border-top: 1px solid #f1f4f8; }
.day { flex: 1; min-width: 0; text-align: center; }
.day-label { font-weight: 600; color: var(--text-2); }
.day-cond { font-size: 12px; color: var(--text-2); margin: 4px 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.day-temp { font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.day-temp b { font-weight: 700; }
.day-low { color: var(--text-3); }
.day-pop { font-size: 11px; color: #0284c7; margin-top: 2px; font-variant-numeric: tabular-nums; }
.day-pop.empty { visibility: hidden; }
</style>
