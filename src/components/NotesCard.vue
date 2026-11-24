<template>
  <section class="card">
    <div class="card-head">
      <span class="card-dot" style="background: var(--amber)"></span>
      <span class="card-title">{{ title || '备忘小记' }}</span>
      <span class="card-sub">只保存在本机浏览器</span>
    </div>
    <form class="add" @submit.prevent="addNote">
      <input v-model="text" type="text" placeholder="写点什么，记下来…" maxlength="120" />
      <button type="submit">添加</button>
    </form>
    <div v-if="notes.length === 0" class="empty">还没有便签，写一条试试</div>
    <div v-else>
      <div class="row" v-for="n in notes" :key="n.id">
        <span class="grow" :class="{ done: n.done }" @click="toggle(n)">{{ n.text }}</span>
        <span class="label">{{ n.date }}</span>
        <button class="del" @click="remove(n.id)" title="删除">×</button>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
import { ref, onMounted, watch } from 'vue'

const KEY = 'laowang-dashboard-notes'
const notes = ref([])
const text = ref('')

onMounted(() => {
  try {
    notes.value = JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch { notes.value = [] }
})
watch(notes, (v) => {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* 忽略 */ }
}, { deep: true })

function addNote() {
  const t = text.value.trim()
  if (!t) return
  const d = new Date()
  notes.value.unshift({
    id: Date.now(),
    text: t,
    done: false,
    date: `${d.getMonth() + 1}/${d.getDate()}`
  })
  text.value = ''
}
function toggle(n) { n.done = !n.done }
function remove(id) { notes.value = notes.value.filter((n) => n.id !== id) }
</script>

<style scoped>
.add { display: flex; gap: 8px; margin-bottom: 6px; }
.add input {
  flex: 1; height: 38px; border: 1px solid var(--border); border-radius: 10px;
  padding: 0 12px; font-size: 13.5px; outline: none; background: #fff; color: var(--text);
}
.add input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12); }
.add button {
  height: 38px; padding: 0 16px; border: none; border-radius: 10px;
  background: var(--blue); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
}
.row .grow { cursor: pointer; }
.row .grow.done { text-decoration: line-through; color: var(--text-3); }
.del { border: none; background: none; color: var(--text-3); font-size: 18px; cursor: pointer; padding: 0 4px; line-height: 1; }
.del:hover { color: var(--rose); }
</style>
