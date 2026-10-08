<script setup lang="ts">
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAppearanceStore } from '@/stores/appearance'
import { useNoticeStore } from '@/stores/notices'
import { useWhisperStore } from '@/stores/whispers'
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

const extraNav = [
  { to: '/tags', label: '标签' },
  { to: '/good', label: '点赞' },
  { to: '/following', label: '关注' },
  { to: '/activity', label: '活动' },
  { to: '/repeater', label: '复读机' },
  { to: '/logs', label: '日志' },
  { to: '/download', label: '下载' },
  { to: '/agreement', label: '协议' },
  { to: '/privacy', label: '隐私' },
]

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const appearance = useAppearanceStore()
const notices = useNoticeStore()
const whispers = useWhisperStore()
const { isLoggedIn, account } = storeToRefs(auth)
const { total: unreadTotal } = storeToRefs(notices)
const { unreadTotal: whisperUnread } = storeToRefs(whispers)
const memberPath = computed(() => (account.value?.userName ? `/member/${account.value.userName}` : '/login'))

watch(
  () => auth.apiKey,
  (key) => {
    if (key) {
      void notices.refresh()
      notices.connect()
      void whispers.refreshUnread()
    } else {
      notices.disconnect()
      notices.clear()
      whispers.clear()
    }
  },
  { immediate: true },
)

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
      <RouterLink to="/" class="logo" aria-label="摸鱼派">
        <img src="/logo.png" width="48" height="48" alt="摸鱼派" />
      </RouterLink>
      <nav>
        <RouterLink v-for="item in nav" :key="item.to" :to="item.to" :class="{ current: route.path === item.to }">
          {{ item.label }}
        </RouterLink>
      </nav>
      <input class="search" placeholder="搜索你感兴趣的内容" @keydown.enter="onSearch" />
      <div class="user">
        <template v-if="isLoggedIn">
          <RouterLink to="/post">发帖</RouterLink>
          <RouterLink to="/stars">收藏</RouterLink>
          <RouterLink to="/points" class="points-link">
            积分
            <em v-if="account?.userPoint != null" class="pts">{{ Number(account.userPoint).toLocaleString() }}</em>
          </RouterLink>
          <RouterLink to="/chat">
            私信
            <em v-if="whisperUnread" class="badge">{{ whisperUnread > 99 ? '99+' : whisperUnread }}</em>
          </RouterLink>
          <RouterLink to="/notifications">
            通知
            <em v-if="unreadTotal" class="badge">{{ unreadTotal > 99 ? '99+' : unreadTotal }}</em>
          </RouterLink>
          <RouterLink :to="memberPath">{{ account?.userName }}</RouterLink>
          <RouterLink to="/settings">设置</RouterLink>
          <button type="button" @click="logout">退出</button>
        </template>
        <template v-else>
          <RouterLink to="/login">登录</RouterLink>
          <RouterLink to="/register">注册</RouterLink>
        </template>
        <button type="button" class="theme" title="切换颜色模式" @click="appearance.toggleTheme()">◐</button>
      </div>
    </header>
    <div class="income" aria-label="今日收入">
      <span>🎉</span>
      <div class="count-time">今日收入</div>
      <b>￥365</b>
    </div>
    <AdSlot slot-key="home.top" />
    <main>
      <RouterView />
    </main>
    <footer class="foot">
      <div class="foot-inner">
        <div class="foot-brand">
          <b>摸鱼派</b>
          <span>鱼油专属摸鱼社区</span>
        </div>
        <div class="foot-sponsors">
          <p class="foot-label">摸鱼好站</p>
          <AdSlot slot-key="footer.sponsors" />
        </div>
        <p class="extra">
          <RouterLink v-for="item in extraNav" :key="item.to" :to="item.to">{{ item.label }}</RouterLink>
        </p>
        <p class="foot-meta">
          <a href="https://github.com/FishPiOffical/rhythm" target="_blank" rel="noopener">Rhythm 社区引擎</a>
          <a href="https://github.com/FishPiOffical" target="_blank" rel="noopener">FishPi Official</a>
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
}
.nav {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 8px;
  padding: 5px 15px;
  height: var(--fp-nav-h);
  background: var(--fp-nav);
  box-shadow: var(--fp-nav-shadow);
  font-weight: 500;
}
.logo {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.logo img {
  width: 48px;
  height: 48px;
  display: block;
  object-fit: contain;
}
nav {
  display: flex;
  gap: 18px;
  flex: 1;
  justify-content: center;
}
nav a {
  color: var(--fp-nav-text);
  text-decoration: none;
  font-size: 14px;
  white-space: nowrap;
  padding: 6px 10px;
  border-radius: 6px;
}
nav a.current,
nav a:hover {
  color: var(--fp-accent);
  background: var(--fp-hover);
}
.search {
  width: 210px;
  height: 38px;
  background: var(--fp-search-bg);
  border: 0;
  color: var(--fp-nav-text);
  border-radius: 3px;
  padding: 5px 8px;
}
.user {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  flex-shrink: 0;
}
.user a {
  color: var(--fp-nav-text);
  text-decoration: none;
  position: relative;
}
.user a:hover {
  color: var(--fp-accent);
}
.badge {
  position: absolute;
  top: -8px;
  right: -10px;
  min-width: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #c45c4a;
  color: #fff;
  font-size: 10px;
  font-style: normal;
  text-align: center;
}
.points-link .pts {
  margin-left: 4px;
  font-style: normal;
  font-size: 12px;
  color: var(--fp-green);
}
.user button {
  border: 0;
  background: transparent;
  color: var(--fp-nav-text);
  cursor: pointer;
}
.theme {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--fp-border) !important;
}
.income {
  position: fixed;
  top: 70px;
  right: 20px;
  z-index: 20;
  width: 110px;
  text-align: center;
  background: var(--fp-income-bg);
  box-shadow: var(--fp-income-shadow);
  border-radius: 16px;
  padding: 8px 0 10px;
  font-size: 12px;
  color: var(--fp-text);
}
.income b {
  display: block;
  color: var(--fp-income);
  font-size: 22px;
  margin-top: 2px;
}
main {
  max-width: var(--fp-wrap);
  margin: 0 auto;
  padding: 25px 15px 20px;
}
.foot {
  background: var(--fp-footer);
  color: var(--fp-nav-text);
  padding: 16px 0 32px;
}
.foot-inner {
  max-width: var(--fp-wrap);
  margin: 0 auto;
  padding: 8px 15px 0;
}
.foot-brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--fp-muted);
}
.foot-brand b {
  font-size: 15px;
  color: var(--fp-nav-text);
}
.foot-sponsors {
  margin-bottom: 14px;
}
.foot-label {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fp-nav-text);
}
.extra {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
}
.foot-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin: 12px 0 0;
  font-size: 12px;
}
.foot-meta a {
  color: var(--fp-link);
  text-decoration: none;
}
.extra a {
  color: var(--fp-nav-text);
  text-decoration: none;
}
</style>
