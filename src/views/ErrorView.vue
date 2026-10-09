<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'

const ERRORS: Record<number, { title: string; desc: string }> = {
  401: { title: '401 Unauthorized!', desc: '请登录后再试~' },
  403: { title: '403 Forbidden!', desc: '因权限不足操作已被禁止 :(' },
  500: { title: '500 Internal Server Error!', desc: '服务器开小差了' },
}

const route = useRoute()
const { isLoggedIn } = storeToRefs(useAuthStore())
const code = computed(() => Number(route.meta.errorCode) || 500)
const info = computed(() => ERRORS[code.value] || ERRORS[500])
const redirect = computed(() => (typeof route.query.redirect === 'string' ? route.query.redirect : '/'))

usePageSeo(() => ({ title: info.value.title, path: route.fullPath, robots: 'noindex' }))
</script>

<template>
  <section class="card">
    <p class="code">{{ code }}</p>
    <h1>{{ info.title }}</h1>
    <p class="hint">{{ info.desc }}</p>
    <p v-if="code === 500" class="hint">
      请到 <a href="https://github.com/FishPiOffical/rhythm/issues" target="_blank" rel="noopener noreferrer">这里</a>
      反馈问题以帮助我们进行改进，非常感谢 ♥
    </p>
    <p class="hint">
      若是接口连不上，请打开
      <RouterLink to="/offline">网络故障页</RouterLink>；页面不存在请看
      <RouterLink to="/error/404">404 页</RouterLink>。
    </p>
    <p v-if="(code === 401 || code === 403) && !isLoggedIn" class="links">
      <RouterLink :to="{ path: '/login', query: { redirect } }">登录</RouterLink>
      <RouterLink to="/register">现在注册</RouterLink>
    </p>
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
.hint a {
  color: var(--fp-link);
}
.links {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin: 0 0 12px;
  font-size: 14px;
}
.links a {
  color: var(--fp-link);
}
</style>
