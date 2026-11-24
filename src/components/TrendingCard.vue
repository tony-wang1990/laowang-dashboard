<template>
  <section class="card">
    <div class="card-head">
      <span class="card-dot" style="background: var(--rose)"></span>
      <span class="card-title">{{ title || 'GitHub 本周趋势' }}</span>
      <span class="card-sub">按 star 排序</span>
    </div>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error || !data.items?.length" class="empty">暂无数据</div>
    <div v-else>
      <div class="row" v-for="r in data.items" :key="r.name">
        <span class="grow" :title="r.name + (r.description ? ' — ' + r.description : '')">
          <a :href="r.url" target="_blank" rel="noopener">{{ r.name }}</a>
          <span class="label" v-if="r.description"> — {{ r.description }}</span>
        </span>
        <span class="tag" v-if="r.language">{{ r.language }}</span>
        <span style="font-size: 13px; font-weight: 600; white-space: nowrap">★ {{ fmtNum(r.stars) }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
import { useApi, fmtNum } from '../useApi.js'
const { data, loading, error } = useApi('/api/trending', 10 * 60 * 1000)
</script>

<style scoped>
.row { padding: 12px 0; }
.row a { color: var(--text); font-weight: 600; }
.row a:hover { color: var(--blue); text-decoration: none; }
.row .grow { white-space: normal; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
</style>
