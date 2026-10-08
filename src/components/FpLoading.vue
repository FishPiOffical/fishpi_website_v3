<script setup lang="ts">
withDefaults(
  defineProps<{
    text?: string
    /** 骨架屏行数；为 0 时显示转圈 */
    rows?: number
    /** 行内小尺寸（面板、下拉等狭小区域） */
    small?: boolean
  }>(),
  { text: '加载中…', rows: 0, small: false },
)
</script>

<template>
  <div v-if="rows" class="fp-skeleton" role="status" :aria-label="text">
    <div v-for="i in rows" :key="i" class="sk-row">
      <span class="sk-avatar" />
      <div class="sk-lines">
        <span class="sk-line" :style="{ width: `${60 + ((i * 17) % 30)}%` }" />
        <span class="sk-line short" />
      </div>
    </div>
  </div>
  <div v-else class="fp-loading" :class="{ small }" role="status">
    <span class="spinner" />
    <span v-if="text" class="text">{{ text }}</span>
  </div>
</template>

<style scoped>
.fp-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--fp-muted);
  font-size: 13px;
}
.fp-loading.small {
  padding: 10px 8px;
  font-size: 12px;
  gap: 6px;
}
.spinner {
  width: 18px;
  height: 18px;
  flex: none;
  border-radius: 50%;
  border: 2px solid var(--fp-border);
  border-top-color: var(--fp-primary);
  animation: fp-spin 0.75s linear infinite;
}
.small .spinner {
  width: 14px;
  height: 14px;
}
@keyframes fp-spin {
  to {
    transform: rotate(360deg);
  }
}

.fp-skeleton {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 16px;
}
.sk-row {
  display: flex;
  gap: 12px;
  align-items: center;
}
.sk-avatar,
.sk-line {
  background: linear-gradient(90deg, var(--fp-hover) 25%, var(--fp-border) 37%, var(--fp-hover) 63%);
  background-size: 400% 100%;
  animation: fp-shimmer 1.4s ease infinite;
}
.sk-avatar {
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 6px;
}
.sk-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sk-line {
  height: 12px;
  border-radius: 4px;
}
.sk-line.short {
  width: 35%;
}
@keyframes fp-shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .spinner,
  .sk-avatar,
  .sk-line {
    animation: none;
  }
}
</style>
