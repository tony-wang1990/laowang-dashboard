<template>
  <!-- 实时指标条：一整条通栏大数字卡片。5 个指标在一排（CSS grid 自动换行，
       窄屏自动折成多行），取代原来 5 张分开的单指标卡——分开摆会在 12 列
       里左右各留 1 列空隙，窄屏还可能排错行。 -->
  <section class="card stat-strip">
    <div class="strip-head">
      <span class="live-dot" title="实时"></span>
      <span class="strip-title">{{ title || '实时指标' }}</span>
      <span class="strip-sub">每 30 秒采样 · 本机</span>
    </div>
    <div class="strip-grid">
      <StatCard v-for="m in metrics" :key="m" :config="{ metric: m }" bare />
    </div>
  </section>
</template>

<script setup>
import StatCard from './StatCard.vue'
// 注意：App.vue 渲染卡片只传 config / title（不传 item），这里和其他卡片保持一致
const props = defineProps({ config: { type: Object, default: () => ({}) }, title: { type: String, default: '' } })
const metrics = ['cpu', 'mem', 'disk', 'load', 'net']
</script>

<style scoped>
.stat-strip {
  /* 通栏大数字块：浅蓝渐变底 + 蓝色左侧竖线，科技感但保持浅色 */
  background: linear-gradient(115deg, #ffffff 0%, #f8fbff 55%, #f3f5ff 100%);
  border-left: 3px solid var(--blue);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.strip-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.live-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 0 rgba(34, 197, 94, .45);
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, .45) }
  70% { box-shadow: 0 0 0 7px rgba(34, 197, 94, 0) }
  100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0) }
}
.strip-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}
.strip-sub {
  font-size: 12px;
  color: var(--muted);
}
.strip-grid {
  flex: 1;
  display: grid;
  /* 每格至少 120px，自动换行：宽屏 5 个一排，手机上 2 列，不会一格占一整行 */
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px 20px;
  align-content: center;
}
/* 指标之间的竖分隔线（只在桌面端一行时显示） */
.strip-grid :deep(.stat-block + .stat-block) {
  border-left: 1px solid #e8edf4;
  padding-left: 20px;
}
@media (max-width: 1100px) {
  .strip-grid :deep(.stat-block + .stat-block) {
    border-left: none;
    padding-left: 0;
  }
}
</style>
