<template>
  <section class="card">
    <div class="card-head">
      <span class="card-dot" style="background: #111827"></span>
      <span class="card-title">{{ title || '我的 GitHub 仓库' }}</span>
      <span class="card-sub">tony-wang1990</span>
    </div>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!data || error" class="empty">暂无数据</div>
    <div v-else>
      <div class="repo" v-for="r in data.repos" :key="r.name">
        <div class="repo-head">
          <a :href="r.url" target="_blank" rel="noopener" class="repo-name">{{ r.name }}</a>
          <span class="tag" v-if="r.language">{{ r.language }}</span>
        </div>
        <div class="repo-desc" v-if="r.description" :title="r.description">{{ r.description }}</div>
        <div class="repo-desc" v-else-if="r.error" :title="r.error">拉取失败：{{ r.error }}</div>
        <div class="repo-meta" v-if="!r.error">
          <span>★ {{ fmtNum(r.stars) }}</span>
          <span>⑂ {{ fmtNum(r.forks) }}</span>
          <span class="label" v-if="r.lastCommit" :title="r.lastCommit.message">最新提交 {{ r.lastCommit.sha }} · {{ r.lastCommit.message }}</span>
        </div>
      </div>
      <div class="total" v-if="totalStars > 0">
        三个项目累计 <strong>★ {{ fmtNum(totalStars) }}</strong>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
import { computed } from 'vue'
import { useApi, fmtNum } from '../useApi.js'
const { data, loading, error } = useApi('/api/github', 5 * 60 * 1000)
const totalStars = computed(() => (data.value?.repos || []).reduce((s, r) => s + (r.stars || 0), 0))
</script>

<style scoped>
.repo { padding: 12px 0; border-top: 1px solid #f1f4f8; }
.repo:first-of-type { border-top: none; padding-top: 0; }
.repo-head { display: flex; align-items: center; gap: 8px; }
.repo-name { font-weight: 650; font-size: 14.5px; color: var(--text); }
.repo-name:hover { color: var(--blue); text-decoration: none; }
.repo-desc { font-size: 13px; color: var(--text-2); margin-top: 4px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.repo-meta { display: flex; gap: 14px; margin-top: 6px; font-size: 12.5px; color: var(--text-2); align-items: baseline; flex-wrap: wrap; }
.repo-meta .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.total { margin-top: 12px; padding-top: 12px; border-top: 1px solid #f1f4f8; font-size: 13.5px; color: var(--text-2); }
.total strong { color: var(--text); font-size: 16px; }
</style>
