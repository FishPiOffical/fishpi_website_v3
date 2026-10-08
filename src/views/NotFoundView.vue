<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { usePageSeo } from '@/composables/usePageSeo'

const route = useRoute()

usePageSeo(() => ({
  title: '页面不存在',
  path: route.fullPath,
  robots: 'noindex',
}))
</script>

<template>
  <section class="card">
    <p class="code">404</p>
    <h1>页面不存在</h1>
    <p class="hint">路径 <code>{{ route.fullPath }}</code> 没有对应页面。</p>
    <p class="links">
      <RouterLink to="/">回首页</RouterLink>
      <RouterLink to="/recent">看最新</RouterLink>
      <RouterLink to="/cr">聊天室</RouterLink>
    </p>
  </section>
</template>

<style scoped>
.card {
  max-width: 480px;
  margin: 48px auto;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 28px 24px;
  text-align: center;
}
.code {
  margin: 0;
  font-size: 48px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--fp-muted);
  line-height: 1;
}
h1 {
  margin: 8px 0 12px;
  font-size: 20px;
  color: var(--fp-title);
}
.hint {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--fp-muted);
  word-break: break-all;
}
.hint code {
  font-size: 12px;
}
.links {
  display: flex;
  justify-content: center;
  gap: 16px;
  font-size: 14px;
}
.links a {
  color: var(--fp-link);
}
</style>
