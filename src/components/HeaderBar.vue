<template>
  <!-- 顶部大字区：不再是卡片（以前 .card 的 22px 内边距让搜索按钮右缘
       比下面的「编辑布局」缩进 22px，看着没对齐），改成透明通栏，
       搜索按钮右缘和页面内容右缘（= 编辑布局按钮右缘）完全对齐；
       时钟改成蓝紫渐变大字 + 底部一条渐变细线，带科技感但仍是浅色。 -->
  <header class="hero">
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
  <div class="hero-rule" aria-hidden="true"></div>
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
/* 透明通栏：无卡片底色 / 边框 / 阴影，左右两端贴合页面内容边缘 */
.hero {
  display: flex;
  gap: 32px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  padding: 6px 2px 0;
}
.hero-left { min-width: 260px; }
.greet { font-size: 15px; color: var(--text-2); font-weight: 550; }
.clock {
  font-size: 64px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  /* 渐变大字：科技感 */
  background: linear-gradient(92deg, #2563eb 10%, #06b6d4 50%, #7c3aed 90%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.date { font-size: 13px; color: var(--text-3); margin-top: 4px; }
/* 右侧贴到页面最右：搜索按钮右缘 = 编辑布局按钮右缘 */
.hero-right { flex: 1; min-width: 280px; max-width: 560px; margin-left: auto; }
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
/* 顶部通栏下方一条蓝紫渐变细线，分隔大字区和工具栏 */
.hero-rule {
  height: 3px;
  border-radius: 99px;
  margin: 18px 0 2px;
  background: linear-gradient(90deg, #2563eb 0%, #06b6d4 45%, #7c3aed 100%);
  opacity: 0.85;
}
</style>
