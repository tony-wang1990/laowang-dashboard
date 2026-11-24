<template>
  <div class="warn-block">
    <div class="label warn-head">{{ headText }}</div>
    <div v-if="loading" class="label">预警加载中…</div>
    <div v-else-if="error || !data" class="label">预警暂不可用</div>
    <div v-else-if="!data.items || !data.items.length" class="label">{{ emptyText }}</div>
    <div v-else class="warn-list">
      <a v-for="w in data.items" :key="w.alertid" class="warn-item" :class="'lv-' + w.level"
         :href="w.url" target="_blank" rel="noopener" :title="w.title">
        <span class="warn-chip">{{ w.type }} · {{ w.level }}</span>
        <span class="warn-title">{{ w.title }}</span>
        <span class="warn-time">{{ w.issuetime }}</span>
      </a>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useApi } from '../useApi.js'
// city：按标题过滤的城市名（中文，如“烟台”）；province：省级站发布的预警也算
// （标题以“XX省…发布”开头、发布前无“市”字）；type：只看某一类，如“大风”。
// 国外城市（如 Los Angeles）查不到中国预警，显示无预警，不报错。
const props = defineProps({
  city: { type: String, default: '' },
  province: { type: String, default: '' },
  type: { type: String, default: '' },
  headText: { type: String, default: '天气预警' },
  emptyText: { type: String, default: '当前无生效预警' }
})
const apiPath = computed(() => {
  const q = new URLSearchParams()
  if (props.city) q.set('city', props.city)
  if (props.province) q.set('province', props.province)
  if (props.type) q.set('type', props.type)
  return '/api/warnings?' + q.toString()
})
const { data, loading, error } = useApi(apiPath, 10 * 60 * 1000)
</script>

<style scoped>
.warn-block { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid #f1f4f8; }
.warn-head { font-weight: 600; color: var(--text-2); }
.warn-list { display: flex; flex-direction: column; gap: 6px; }
.warn-item { display: flex; align-items: baseline; gap: 8px; padding: 7px 10px; border-radius: 8px;
  border-left: 3px solid var(--warn-c, #94a3b8); background: var(--warn-bg, #f8fafc);
  color: inherit; text-decoration: none; }
.warn-item:hover { filter: brightness(0.97); }
.warn-item.lv-蓝色 { --warn-c: #2563eb; --warn-bg: #eff6ff; }
.warn-item.lv-黄色 { --warn-c: #ca8a04; --warn-bg: #fefce8; }
.warn-item.lv-橙色 { --warn-c: #ea580c; --warn-bg: #fff7ed; }
.warn-item.lv-红色 { --warn-c: #dc2626; --warn-bg: #fef2f2; }
.warn-chip { flex: none; font-size: 12px; font-weight: 700; color: var(--warn-c); white-space: nowrap; }
.warn-title { flex: 1; min-width: 0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.warn-time { flex: none; font-size: 11px; color: var(--text-3); white-space: nowrap; font-variant-numeric: tabular-nums; }
</style>
