<template>
  <section class="card">
    <div class="card-head">
      <span class="card-dot" style="background: var(--violet)"></span>
      <span class="card-title">{{ title || '科技资讯' }}</span>
      <span class="card-sub">
        <button class="tab" :class="{ active: tab === 'hn' }" @click="tab = 'hn'">Hacker News</button>
        <button class="tab" :class="{ active: tab === 'sspai' }" @click="tab = 'sspai'">少数派</button>
      </span>
    </div>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error" class="empty">暂无数据</div>
    <div v-else-if="items.length === 0" class="empty">暂无数据</div>
    <div v-else>
      <div class="row" v-for="n in items" :key="n.url + n.title">
        <span class="grow" :title="n.title"><a :href="n.url" target="_blank" rel="noopener">{{ n.title }}</a></span>
        <span class="label" v-if="n.points != null">▲ {{ n.points }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
import { ref, computed } from 'vue'
import { useApi } from '../useApi.js'
const { data, loading, error } = useApi('/api/news', 5 * 60 * 1000)
const tab = ref('hn')
const items = computed(() => {
  if (!data.value) return []
  return tab.value === 'hn' ? (data.value.hn || []) : (data.value.sspai || [])
})
</script>

<style scoped>
.tab {
  border: none; background: none; font-size: 12px; color: var(--text-3);
  cursor: pointer; padding: 4px 8px; border-radius: 99px;
}
.tab.active { background: #eff6ff; color: var(--blue); font-weight: 600; }
.row a { color: var(--text); font-weight: 550; }
.row a:hover { color: var(--blue); text-decoration: none; }
.row .grow {
  white-space: normal; display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden; line-height: 1.45;
}
</style>
