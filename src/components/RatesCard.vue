<template>
  <section class="card card-fill">
    <div class="card-head">
      <span class="card-dot" style="background: var(--blue)"></span>
      <span class="card-title">{{ title || '汇率 · 美元' }}</span>
      <span class="card-sub">{{ data?.date || 'Frankfurter' }}</span>
    </div>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error" class="empty">暂无数据</div>
    <template v-else>
      <div class="big">
        <span class="big-num">$1 <small>=</small> ¥{{ fmtMoney(data.rates.CNY) }}</span>
      </div>
      <div class="fill-body">
        <div class="row" v-for="c in others" :key="c.code">
          <span class="grow" :title="c.name">{{ c.name }}</span>
          <span style="font-weight: 650; font-variant-numeric: tabular-nums">{{ c.symbol }}{{ fmtMoney(c.value, c.code === 'JPY' ? 1 : 4) }}</span>
        </div>
      </div>
      <div class="fill-foot label">数据来源：Frankfurter · 每 10 分钟刷新</div>
    </template>
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
/* 大数字在窄卡里允许在空格处换行（"$1 =" / "¥6.66" 两行），数字本身不断行；
   不加这个，390px 宽屏下 32px 不换行的大数字会顶出卡片、页面出现横向滚动条 */
.big-num { white-space: normal; line-height: 1.25; }
</style>
