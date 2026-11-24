<template>
  <section class="card">
    <div class="card-head">
      <span class="card-dot" style="background: var(--blue)"></span>
      <span class="card-title">{{ title || '汇率 · 美元' }}</span>
      <span class="card-sub">{{ data?.date || 'Frankfurter' }}</span>
    </div>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error" class="empty">暂无数据</div>
    <div v-else>
      <div class="big">
        <span class="big-num">$1 <small>=</small> ¥{{ fmtMoney(data.rates.CNY) }}</span>
      </div>
      <div class="row" v-for="c in others" :key="c.code">
        <span class="grow" :title="c.name">{{ c.name }}</span>
        <span style="font-weight: 650; font-variant-numeric: tabular-nums">{{ c.symbol }}{{ fmtMoney(c.value, c.code === 'JPY' ? 1 : 4) }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
import { computed } from 'vue'
import { useApi, fmtMoney } from '../useApi.js'
const { data, loading, error } = useApi('/api/rates', 10 * 60 * 1000)
const others = computed(() => {
  if (!data.value?.rates) return []
  const r = data.value.rates
  return [
    { code: 'EUR', name: '欧元 EUR', symbol: '€', value: r.EUR },
    { code: 'HKD', name: '港币 HKD', symbol: 'HK$', value: r.HKD },
    { code: 'JPY', name: '日元 JPY', symbol: '¥', value: r.JPY }
  ].filter((c) => c.value != null)
})
</script>

<style scoped>
.big { padding: 6px 0 12px; }
</style>
