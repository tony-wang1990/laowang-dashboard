<template>
  <section class="card"><div class="card-head"><span class="card-dot" style="background: var(--blue)"></span><span class="card-title">{{ title || '内嵌页面' }}</span></div>
  <div class="iframe-wrap">
    <div v-if="!config.url" class="empty">点击右上角编辑，填一个要内嵌的页面地址</div>
    <iframe
      v-else
      :src="config.url"
      :style="{ height: (config.height || 320) + 'px' }"
      frameborder="0"
      loading="lazy"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    ></iframe>
    <div class="label" v-if="config.url">内嵌页面由对方站点提供；若对方禁止被嵌套，这里会显示空白</div>
  </div>
  </section>
</template>

<script setup>
defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
</script>

<style scoped>
.iframe-wrap iframe { width: 100%; border: 1px solid var(--border); border-radius: 12px; background: #fff; display: block; }
.iframe-wrap .label { margin-top: 8px; }
</style>
