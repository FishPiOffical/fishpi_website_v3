<script setup lang="ts">
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useAppearanceStore } from '@/stores/appearance'
import AdSlot from '@/components/ads/AdSlot.vue'

const nav = [
  { to: '/', label: '最新' },
  { to: '/recent/long', label: '专栏' },
  { to: '/hot', label: '热门' },
  { to: '/cr', label: '聊天室' },
  { to: '/domains', label: '领域' },
  { to: '/breezemoons', label: '清风明月' },
  { to: '/qna', label: '问答' },
  { to: '/perfect', label: '优选' },
  { to: '/top', label: '总榜' },
]

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const appearance = useAppearanceStore()
const { isLoggedIn, account } = storeToRefs(auth)

function onSearch(e: Event) {
  const q = (e.target as HTMLInputElement).value.trim()
  if (q) router.push({ path: '/search', query: { q } })
}

function logout() {
  auth.logout()
  if (route.meta.auth) router.push('/')
}
</script>

<template>
  <div class="shell">
    <header class="nav">
      <RouterLink to="/" class="logo">
        <img src="/favicon.svg" alt="" />
        <span>摸鱼派</span>
      </RouterLink>
      <nav>
        <RouterLink v-for="item in nav" :key="item.to" :to="item.to" :class="{ current: route.path === item.to }">
          {{ item.label }}
        </RouterLink>
      </nav>
      <input class="search" placeholder="搜索你感兴趣的内容" @keydown.enter="onSearch" />
      <div class="user">
        <template v-if="isLoggedIn">
          <span>{{ account?.userName }}</span>
          <button type="button" @click="logout">退出</button>
        </template>
        <template v-else>
          <RouterLink to="/login">登录</RouterLink>
          <RouterLink to="/register">注册</RouterLink>
        </template>
        <RouterLink to="/settings">装扮</RouterLink>
        <button type="button" class="ghost" title="切换颜色模式" @click="appearance.toggleTheme()">◐</button>
      </div>
    </header>
    <AdSlot slot-key="home.top" />
    <main>
      <RouterView />
    </main>
    <footer class="foot">
      <p>摸鱼好站</p>
      <AdSlot slot-key="footer.sponsors" />
      <p class="muted">摸鱼派用户站 · 管理后台不在本仓库</p>
    </footer>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
}
.nav {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 24px;
  height: 56px;
  background: var(--fp-nav);
  border-bottom: 1px solid var(--fp-border);
}
.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: inherit;
  text-decoration: none;
  font-weight: 700;
}
.logo img {
  width: 28px;
  height: 28px;
}
nav {
  display: flex;
  gap: 14px;
  flex: 1;
}
nav a {
  color: var(--fp-text);
  text-decoration: none;
  font-size: 14px;
  opacity: 0.85;
}
nav a.current,
nav a:hover {
  opacity: 1;
  color: var(--fp-link);
}
.search {
  width: 220px;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 16px;
  padding: 6px 12px;
}
.user {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}
.user a {
  color: var(--fp-link);
  text-decoration: none;
}
.user button,
.ghost {
  border: 0;
  background: transparent;
  color: var(--fp-text);
  cursor: pointer;
}
main {
  max-width: 1280px;
  margin: 0 auto;
  padding: 16px 20px 40px;
}
.foot {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 20px 40px;
  color: var(--fp-muted);
}
.muted {
  font-size: 12px;
}
</style>
