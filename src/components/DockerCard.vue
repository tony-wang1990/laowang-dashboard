<template>
  <section class="card card-fill">
    <div class="card-head">
      <span class="card-dot" style="background: var(--violet)"></span>
      <span class="card-title">{{ title || 'Docker 容器' }}</span>
      <span class="card-sub" v-if="data">共 {{ data.count }} 个</span>
    </div>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error" class="empty">暂无数据（Docker 未运行或不可用）</div>
    <div v-else-if="data.containers.length === 0" class="empty">当前没有运行中的容器</div>
    <div v-else class="fill-body">
      <div class="row" v-for="c in data.containers" :key="c.name">
        <span class="status-dot" :class="c.running ? 'on' : 'off'"></span>
        <span class="grow" :title="c.name + ' · ' + c.image"><strong>{{ c.name }}</strong><span class="label"> · {{ shortImage(c.image) }}</span></span>
        <span class="label">{{ c.status }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
import { useApi } from '../useApi.js'
const { data, loading, error } = useApi('/api/docker', 60000)

function shortImage(img) {
  if (!img) return ''
  return img.length > 42 ? img.slice(0, 42) + '…' : img
}
</script>

<style scoped>
.row strong { font-weight: 600; }
</style>
