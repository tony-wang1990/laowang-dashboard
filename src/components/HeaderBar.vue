<template>
  <header class="hero card">
    <div class="hero-left">
      <div class="greet">{{ greeting }}，yatao</div>
      <div class="clock">{{ time }}</div>
      <div class="date">{{ dateStr }} · {{ weekday }} · 上海</div>
    </div>
    <div class="hero-right">
      <form class="search" @submit.prevent="doSearch">
        <input v-model="q" type="text" placeholder="搜点什么…（回车用 Bing 搜索）" />
        <button type="submit">搜索</button>
      </form>
      <div class="hero-quote" v-if="quote">
        「{{ quote.text }}」<span v-if="quote.from">—— {{ quote.from }}</span>
      </div>
      <div class="hero-quote empty-quote" v-else-if="!quoteLoading">今日一言暂无数据</div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useApi } from '../useApi.js'

const { data: quote, loading: quoteLoading } = useApi('/api/quote', 10 * 60 * 1000)

const q = ref('')
const now = ref(new Date())
let timer = null

onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 1000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

const greeting = computed(() => {
  const h = now.value.getHours()
  if (h < 6) return '夜深了'
  if (h < 9) return '早上好'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  if (h < 22) return '晚上好'
  return '夜深了'
})

const time = computed(() => {
  const n = now.value
  const p = (x) => String(x).padStart(2, '0')
  return `${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`
})

const dateStr = computed(() => {
  const n = now.value
  return `${n.getFullYear()} 年 ${n.getMonth() + 1} 月 ${n.getDate()} 日`
})

const weekday = computed(() => '星期' + '日一二三四五六'[now.value.getDay()])

function doSearch() {
  const query = q.value.trim()
  if (!query) return
  window.open('https://www.bing.com/search?q=' + encodeURIComponent(query), '_blank')
}
</script>

<style scoped>
.hero {
  display: flex;
  gap: 32px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  background: linear-gradient(120deg, #ffffff 0%, #f8fbff 55%, #f5f7ff 100%);
}
.hero-left { min-width: 260px; }
.greet { font-size: 15px; color: var(--text-2); font-weight: 550; }
.clock {
  font-size: 56px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}
.date { font-size: 13px; color: var(--text-3); margin-top: 2px; }
.hero-right { flex: 1; min-width: 280px; max-width: 560px; }
.search { display: flex; gap: 8px; }
.search input {
  flex: 1;
  height: 44px;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0 16px;
  font-size: 14px;
  outline: none;
  background: #fff;
  color: var(--text);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.search input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12); }
.search button {
  height: 44px;
  padding: 0 22px;
  border: none;
  border-radius: 12px;
  background: var(--blue);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.search button:hover { background: #1d4ed8; }
.hero-quote { margin-top: 14px; font-size: 13.5px; color: var(--text-2); line-height: 1.6; }
.hero-quote span { color: var(--text-3); font-size: 12px; }
.empty-quote { color: var(--text-3); }
</style>
