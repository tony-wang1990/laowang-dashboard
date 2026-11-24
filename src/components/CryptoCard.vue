<template>
  <section class="card card-fill">
    <div class="card-head">
      <span class="card-dot" style="background: var(--amber)"></span>
      <span class="card-title">{{ title || '加密货币' }}</span>
      <span class="card-sub">CoinGecko · USD</span>
    </div>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error" class="empty">暂无数据</div>
    <template v-else>
      <div class="fill-body">
        <div class="row" v-for="c in data.coins" :key="c.id">
          <span class="grow" :title="c.name"><strong>{{ c.name }}</strong></span>
          <span class="price">${{ fmtMoney(c.usd) }}</span>
          <span :class="['chg', c.chg24 >= 0 ? 'up' : 'down']">
            {{ c.chg24 == null ? '—' : (c.chg24 >= 0 ? '+' : '') + c.chg24.toFixed(2) + '%' }}
          </span>
        </div>
      </div>
      <div class="fill-foot label">24 小时涨跌 · 每 5 分钟刷新</div>
    </template>
  </section>
</template>

<script setup>
defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
import { useApi, fmtMoney } from '../useApi.js'
const { data, loading, error } = useApi('/api/crypto', 5 * 60 * 1000)
</script>

<style scoped>
.price { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }
.chg { font-size: 13px; font-weight: 600; min-width: 64px; text-align: right; font-variant-numeric: tabular-nums; }
.fill-foot { padding-top: 10px; border-top: 1px solid #f1f4f8; }
</style>
