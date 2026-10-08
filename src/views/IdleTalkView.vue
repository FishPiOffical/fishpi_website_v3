<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { usePageSeo } from '@/composables/usePageSeo'

usePageSeo(() => ({
  title: '闲聊室',
  path: '/idle-talk',
  robots: 'noindex',
}))
</script>

<template>
  <section class="card">
    <h1>闲聊室</h1>
    <p>现网 Rhythm 未开放闲聊室（<code>/idle-talk</code> 返回 404），本站保留路由占位。</p>
    <p class="hint">请使用主聊天室交流。</p>
    <p class="links">
      <RouterLink to="/cr">进入聊天室</RouterLink>
      <RouterLink to="/">回首页</RouterLink>
    </p>
  </section>
</template>

<style scoped>
.card {
  max-width: 480px;
  margin: 40px auto;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 24px;
}
h1 {
  margin: 0 0 12px;
  font-size: 20px;
  color: var(--fp-title);
}
p {
  margin: 0 0 10px;
  color: var(--fp-text);
  line-height: 1.6;
  font-size: 14px;
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.links {
  display: flex;
  gap: 14px;
}
.links a {
  color: var(--fp-link);
}
</style>
