<template>
  <section class="card"><div class="card-head"><span class="card-dot" style="background: var(--violet)"></span><span class="card-title">{{ title || 'RSS 资讯' }}</span></div>
  <div>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error || !data.items?.length" class="empty">暂无数据（检查订阅地址是否正确）</div>
    <div v-else>
      <div class="row" v-for="n in data.items" :key="n.url + n.title">
        <span class="grow"><a :href="n.url" target="_blank" rel="noopener">{{ n.title }}</a></span>
        <span class="label" v-if="n.date">{{ shortDate(n.date) }}</span>
      </div>
    </div>
  </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useApi } from '../useApi.js'

const props = defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
const feedUrl = computed(() => props.config.url || 'https://sspai.com/feed')
const { data, loading, error } = useApi(
  computed(() => '/api/rss?url=' + encodeURIComponent(feedUrl.value)),
  10 * 60 * 1000
)

function shortDate(d) {
  const t = new Date(d)
  if (isNaN(t)) return ''
  return `${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped>
.row a { color: var(--text); font-weight: 550; }
.row a:hover { color: var(--blue); text-decoration: none; }
.row .grow {
  white-space: normal; display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden; line-height: 1.45;
}
</style>
