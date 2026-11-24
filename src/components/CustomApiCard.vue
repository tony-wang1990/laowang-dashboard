<template>
  <section class="card"><div class="card-head"><span class="card-dot" style="background: var(--amber)"></span><span class="card-title">{{ title || '自定义 API' }}</span></div>
  <div>
    <div v-if="!config.url" class="empty">点击右上角编辑，填一个接口地址</div>
    <div v-else-if="loading" class="loading">拉取中…</div>
    <div v-else-if="!data || error" class="empty">接口拉取失败：{{ error || '暂无数据' }}</div>
    <div v-else-if="data.json != null">
      <pre class="json">{{ pretty }}</pre>
    </div>
    <div v-else>
      <pre class="json">{{ data.text || '（空响应）' }}</pre>
      <div class="label" style="margin-top: 8px">该接口未返回 JSON，上面是原始文本前 500 字</div>
    </div>
    <div class="label" style="margin-top: 10px" v-if="data">HTTP {{ data.status }} · {{ data.contentType }}</div>
  </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useApi } from '../useApi.js'

const props = defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })

// field：点号路径，如 data.price / list.0.title；留空则展示整个 JSON
function pick(obj, path) {
  if (!path) return obj
  return path.split('.').reduce((acc, key) => {
    if (acc == null) return undefined
    return acc[key]
  }, obj)
}

const apiUrl = computed(() =>
  props.config.url ? '/api/proxy?url=' + encodeURIComponent(props.config.url) : ''
)
const { data, loading, error } = useApi(apiUrl, 60000)

const pretty = computed(() => {
  if (!data.value?.json) return ''
  const picked = pick(data.value.json, (props.config.field || '').trim())
  if (picked === undefined) return '字段路径不存在：' + (props.config.field || '')
  if (typeof picked === 'object') return JSON.stringify(picked, null, 2)
  return String(picked)
})
</script>

<style scoped>
.json {
  background: #f8fafc;
  border: 1px solid #eef2f7;
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--text-2);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 260px;
  overflow: auto;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
</style>
