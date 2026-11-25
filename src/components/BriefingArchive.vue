<template>
  <div class="archive">
    <div class="archive-intro card">
      <div class="card-head">
        <span class="card-dot" style="background: var(--blue)"></span>
        <span class="card-title">早报归档</span>
        <span class="card-sub">每天 07:00 的早间简报，全文存档</span>
      </div>
      <div class="label">早上发到聊天里的简报，这里也留一份全文——写日报时直接打开看，不用在聊天记录里翻。每天只存一期，同一天不会重复。</div>
    </div>

    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="error" class="empty">{{ error }}<button class="mini" style="margin-left: 8px" @click="refresh">重试</button></div>
    <div v-else-if="!issues.length" class="empty">还没有存档的简报——明天 07:00 的简报发完后会自动出现在这里。</div>

    <section v-for="(issue, idx) in issues" :key="issue.date" class="card issue">
      <div class="issue-head" @click="toggle(issue.date)">
        <span class="issue-date">{{ fmtDate(issue.date) }}</span>
        <span class="issue-title">{{ issue.title }}</span>
        <span v-if="idx === 0" class="tag">今天</span>
        <span class="issue-caret">{{ open.has(issue.date) ? '⌃' : '⌄' }}</span>
      </div>
      <div v-if="open.has(issue.date)" class="issue-body">
        <div v-for="sec in issue.sections" :key="sec.heading" class="bl-section">
          <h3 class="bl-heading">{{ sec.heading }}</h3>
          <div v-for="(line, i) in sec.lines" :key="i" class="bl-line">{{ line }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useApi } from '../useApi.js'

const { data, loading, error, refresh } = useApi('/api/briefings', 0)
const issues = computed(() => data.value?.issues || [])

// 默认展开最新一期；用户点开/收起哪期就记住哪期
const open = ref(new Set())
watch(issues, (list) => {
  if (list.length && open.value.size === 0) open.value = new Set([list[0].date])
}, { immediate: true })

function toggle(date) {
  const next = new Set(open.value)
  if (next.has(date)) next.delete(date)
  else next.add(date)
  open.value = next
}

const WEEK = '日一二三四五六'
function fmtDate(dateStr) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return dateStr || ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return `${Number(m[2])} 月 ${Number(m[3])} 日 星期${WEEK[d.getDay()]}`
}
</script>

<style scoped>
.archive { display: flex; flex-direction: column; gap: 16px; }
.archive-intro { margin-bottom: 4px; }
.archive-intro .label { line-height: 1.7; font-size: 13px; }
.issue { padding: 0; overflow: hidden; }
.issue-head {
  display: flex; align-items: baseline; gap: 12px;
  padding: 18px 22px; cursor: pointer; user-select: none;
}
.issue-head:hover { background: #f8fafc; }
.issue-date { font-size: 16px; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.issue-title { font-size: 13.5px; color: var(--text-2); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.issue-caret { color: var(--text-3); font-size: 14px; flex: none; }
.issue-body { padding: 0 22px 20px; border-top: 1px solid #f1f4f8; }
.bl-section { margin-top: 16px; }
.bl-heading { font-size: 14.5px; font-weight: 700; margin-bottom: 6px; }
.bl-line {
  position: relative;
  padding: 7px 0 7px 16px;
  border-top: 1px solid #f1f4f8;
  font-size: 13.5px; line-height: 1.7; color: var(--text-2);
}
.bl-line:first-of-type { border-top: none; }
.bl-line::before {
  content: '';
  position: absolute; left: 2px; top: 15px;
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--blue);
}
.mini {
  border: 1px solid var(--border); background: #fff; border-radius: 8px;
  font-size: 12px; padding: 3px 10px; cursor: pointer; color: var(--text-2);
}
@media (max-width: 640px) {
  .issue-head { flex-wrap: wrap; gap: 6px 10px; }
  .issue-title { flex-basis: 100%; order: 3; }
}
</style>
