<template>
  <section class="card"><div class="card-head"><span class="card-dot" style="background: var(--cyan)"></span><span class="card-title">{{ title || '文本 / 链接卡片' }}</span></div>
  <div class="text-card">
    <p v-if="config.text" class="text-body">{{ config.text }}</p>
    <div class="text-links" v-if="links.length">
      <a v-for="l in links" :key="l.url" :href="l.url" target="_blank" rel="noopener" class="text-link" :title="l.name + ' · ' + l.url">
        {{ l.name }}
      </a>
    </div>
    <div v-if="!config.text && !links.length" class="empty">点击右上角编辑，写点文字或加几个链接</div>
  </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
// links 格式：每行一个「名称|https://…」
const links = computed(() => {
  const raw = props.config.links || ''
  return raw.split('\n').map((line) => {
    const [name, url] = line.split('|').map((s) => (s || '').trim())
    return name && url ? { name, url } : null
  }).filter(Boolean)
})
</script>

<style scoped>
.text-body { font-size: 14px; line-height: 1.7; color: var(--text-2); white-space: pre-wrap; overflow-wrap: anywhere; }
.text-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.text-link {
  padding: 7px 14px; border: 1px solid var(--border); border-radius: 99px;
  font-size: 13px; font-weight: 550; color: var(--text);
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.text-link:hover { text-decoration: none; border-color: var(--blue); color: var(--blue); }
</style>
