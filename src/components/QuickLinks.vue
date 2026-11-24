<template>
  <section class="card">
    <div class="card-head">
      <span class="card-dot" style="background: var(--cyan)"></span>
      <span class="card-title">{{ title || '快捷入口' }}</span>
    </div>
    <div class="links">
      <a v-for="l in links" :key="l.url" :href="l.url" target="_blank" rel="noopener" class="link" :title="l.name + ' · ' + l.desc">
        <span class="link-icon" :style="{ background: l.bg }">{{ l.icon }}</span>
        <span class="link-text"><span class="link-name">{{ l.name }}</span>
        <span class="link-desc">{{ l.desc }}</span></span>
      </a>
    </div>
  </section>
</template>

<script setup>
defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
const links = [
  { name: 'KPanel 运维', desc: '67.215.229.127:38083', url: 'http://67.215.229.127:38083/', icon: 'K', bg: '#eff6ff' },
  { name: '订阅转换', desc: 'sub.199060.xyz', url: 'https://sub.199060.xyz/', icon: '转', bg: '#eff6ff' },
  { name: '老王导航', desc: '67.215.229.127:8080', url: 'http://67.215.229.127:8080/', icon: '导', bg: '#ecfdf5' },
  { name: 'GitHub', desc: 'tony-wang1990', url: 'https://github.com/tony-wang1990', icon: 'G', bg: '#f1f5f9' },
  { name: 'NPM 管理', desc: '67.215.229.127:81', url: 'http://67.215.229.127:81/', icon: 'N', bg: '#f5f3ff' },
  { name: 'Hacker News', desc: 'news.ycombinator.com', url: 'https://news.ycombinator.com/', icon: 'H', bg: '#fff7ed' },
  { name: '少数派', desc: 'sspai.com', url: 'https://sspai.com/', icon: '派', bg: '#fdf2f8' }
]
</script>

<style scoped>
.links { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.link {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px;
  color: var(--text);
}
.link:hover { text-decoration: none; border-color: #cbd5e1; box-shadow: var(--shadow); }
.link-icon {
  width: 34px; height: 34px; border-radius: 10px; flex: none;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 700; color: var(--text-2);
}
.link-name { font-size: 13.5px; font-weight: 650; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.link-desc { font-size: 11.5px; color: var(--text-3); display: block; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.link-text { flex: 1; min-width: 0; }
</style>
