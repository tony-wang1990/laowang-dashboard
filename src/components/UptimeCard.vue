<template>
  <section class="card card-fill">
    <div class="card-head">
      <span class="card-dot" style="background: var(--emerald)"></span>
      <span class="card-title">{{ title || '站点监测' }}</span>
      <span class="card-sub">每 60 秒检测</span>
    </div>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error" class="empty">暂无数据</div>
    <template v-else>
      <div class="fill-body">
        <div class="row" v-for="t in data.targets" :key="t.url">
          <span class="status-dot" :class="t.up ? 'on' : 'off'"></span>
          <span class="grow" :title="t.name">{{ t.name }}</span>
          <span class="tag" :style="t.up ? '' : 'background:#fff1f2;color:var(--rose)'">
            {{ t.up ? `在线 · ${t.ms} ms` : '离线' }}
          </span>
        </div>
      </div>
      <div class="fill-foot label">{{ data.targets.filter((t) => t.up).length }} / {{ data.targets.length }} 在线 · 每 60 秒检测</div>
    </template>
  </section>
</template>

<script setup>
defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
import { useApi } from '../useApi.js'
const { data, loading, error } = useApi('/api/uptime', 60000)
</script>
