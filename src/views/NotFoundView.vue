<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { usePageSeo } from '@/composables/usePageSeo'

const route = useRoute()
const path = computed(() => {
  const raw = typeof route.query.from === 'string' ? route.query.from : route.fullPath
  return raw === '/error/404' ? '/' : raw
})

usePageSeo(() => ({ title: '页面不存在', path: route.fullPath, robots: 'noindex' }))
</script>

<template>
  <section class="page">
    <p class="code">404</p>
    <h1>页面走丢了</h1>
    <p class="desc">这个地址没有对应页面，可能被移动或从未存在过。</p>
    <p v-if="path && path !== '/'" class="path">
      路径 <code>{{ path }}</code>
    </p>
    <div class="actions">
      <RouterLink to="/" class="primary">回首页</RouterLink>
      <RouterLink to="/recent" class="ghost">看最新</RouterLink>
      <RouterLink to="/cr" class="ghost">聊天室</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.page {
  max-width: 520px;
  margin: 56px auto;
  padding: 36px 28px;
  border: 1px solid var(--fp-border);
  border-radius: 14px;
  background: var(--fp-card);
  text-align: center;
}
.code {
  margin: 0;
  font-size: 72px;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1;
  color: color-mix(in srgb, var(--fp-muted) 55%, transparent);
}
h1 {
  margin: 12px 0 8px;
  font-size: 22px;
  color: var(--fp-title);
}
.desc,
.path {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--fp-muted);
  line-height: 1.55;
}
.path code {
  font-size: 12px;
  word-break: break-all;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 22px;
}
.primary,
.ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 96px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  text-decoration: none;
}
.primary {
  background: var(--fp-primary);
  color: #fff;
}
.ghost {
  border: 1px solid var(--fp-border);
  color: var(--fp-link);
  background: transparent;
}
.ghost:hover {
  background: var(--fp-hover);
}
</style>
