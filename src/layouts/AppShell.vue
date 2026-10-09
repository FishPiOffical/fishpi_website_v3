<script setup lang="ts">
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ensureMedalSession } from '@/utils/medalSession'
import { useAuthStore } from '@/stores/auth'
import { useAppearanceStore } from '@/stores/appearance'
import { useNoticeStore } from '@/stores/notices'
import { useWhisperStore } from '@/stores/whispers'
import { useChatStore } from '@/stores/chat'
import AdSlot from '@/components/ads/AdSlot.vue'
import LogoMark from '@/components/LogoMark.vue'
import RiskCaptchaGate from '@/components/RiskCaptchaGate.vue'
import SystemAlertDialog from '@/components/SystemAlertDialog.vue'
import WarnBroadcastDialog from '@/components/WarnBroadcastDialog.vue'
import CountWidget from '@/components/CountWidget.vue'
import { useCountStore } from '@/stores/count'
import { useLayoutStore } from '@/stores/layout'
import { openRhythmPage } from '@/api/pageAuth'

const baseNav = [
  { to: '/', label: '最新' },
  { to: '/column', label: '专栏' },
  { to: '/hot', label: '热门' },
  { to: '/cr', label: '聊天室' },
  { to: '/domains', label: '领域' },
  { to: '/breezemoons', label: '清风明月' },
  { to: '/qna', label: '问答' },
  { to: '/perfect', label: '优选' },
] as const

/** 与现网 footer 赞助卡对齐（静态，非广告位拉取） */
const partnerCards = [
  {
    href: 'https://www.tsyvps.com/',
    title: 'CDN由蓝易云支持',
    desc: '性价比主机，高防 CDN',
    color: '#0f8cee',
    bg: '#e3f9fd',
    icon: 'https://file.fishpi.cn/2024/11/lanyiyun-e749f98f.png',
  },
  {
    href: 'https://www.svyun.com/',
    title: '云集群由速维云支持',
    desc: '速维云，安全可靠的云服务',
    color: '#ff6000',
    bg: '#ffefc3c9',
    icon: 'https://file.fishpi.cn/2025/11/09fa5df84a83a0e2bf9edcfed93655e01760763018gwsy1-cea09de1.png',
  },
  {
    href: 'https://zhuayuya.com/',
    title: '抓鱼鸭 - 新标签页',
    desc: '是一个有趣的新标签页',
    color: '#39b362',
    bg: '#d9ffcfc9',
    icon: '',
  },
]

const goodSites = [
  { href: 'https://bbs.tampermonkey.net.cn/', label: '油猴中文网' },
  { href: 'https://www.lundao.pub/', label: '论道社区' },
  { href: 'https://nbtab.com/', label: 'NBtab新标签页' },
  { href: 'https://www.haozpay.com/', label: '皓臻聚合支付' },
]

const exploreLinks = [
  { href: 'https://github.com/orgs/FishPiOffical/repositories', label: '摸鱼派开源项目组', external: true },
  { href: 'https://github.com/FishPiOffical/rhythm', label: 'Rhythm社区引擎', external: true },
  { href: '/milestones', label: '大事记', external: false, rhythm: true },
  { href: '/domains', label: '领域', external: false },
  { href: '/tags', label: '标签', external: false },
  { href: 'https://cloudy.iwpz.cn', label: 'Cloudy 词云', external: true },
]

const clientLinks = [
  { href: '/article/1653059669471', label: 'iOS' },
  { href: '/article/1662284317542', label: 'PC' },
  { href: '/article/1638189205758', label: 'IDEA' },
  { href: '/article/1639648815789', label: 'Chrome' },
  { href: '/article/1745833503658', label: '安卓' },
  { href: '/article/1642231999994', label: 'VSCode' },
  { href: '/article/1641135630423', label: 'Python' },
  { href: '/article/1641661864119', label: 'Golang' },
  { href: '/article/1748939764736', label: 'uTools' },
]

const legalLinks = [
  { href: '/article/1630569106133', label: '关于', external: false },
  { href: '/tags/announcement', label: '系统公告', external: false },
  { href: '/statistic', label: '数据统计', external: false, rhythm: true },
  { href: '/agreement', label: '用户协议', external: false },
  { href: '/privacy', label: '隐私政策', external: false },
  { href: '/logs', label: '日志公开', external: false },
  { href: '/article/1636516552191', label: '开放 API', external: false },
  { href: '/article/1782119519493', label: '接入 OAuth', external: false },
]

const route = useRoute()
const openRhythm = (href: string) => openRhythmPage(href, auth.apiKey)
/** 需登录页服务端只出空壳；客户端挂载前也保持空壳，hydration 才能对上，挂载后再渲染真实页面。 */
const mounted = ref(false)
const ssrAuthShell = computed(() => Boolean(route.meta.auth) && !mounted.value)
const router = useRouter()
const auth = useAuthStore()
const appearance = useAppearanceStore()
const notices = useNoticeStore()
const whispers = useWhisperStore()
const chat = useChatStore()
const countStore = useCountStore()
const { immersive } = storeToRefs(useLayoutStore())
const { isLoggedIn, account, isVip } = storeToRefs(auth)
const { total: unreadTotal } = storeToRefs(notices)
const { unreadTotal: whisperUnread } = storeToRefs(whispers)

const isModernChat = computed(() => route.path === '/cr' && chat.chatStyle === 'modern')

const memberPath = computed(() => (account.value?.userName ? `/member/${account.value.userName}` : '/login'))
const avatarUrl = computed(() => account.value?.userAvatarURL || '')
const displayName = computed(() => account.value?.userNickname || account.value?.userName || '')
const userCity = computed(() => (account.value?.userCity || '').trim())
const menuOpen = ref(false)

/** 与现网 header.ftl nav-tabs 顺序一致：优选 → [城市] → 总榜 → [关注] */
const navItems = computed(() => {
  const items: { to: string; label: string; key: string }[] = baseNav.map((item) => ({
    ...item,
    key: item.to,
  }))
  if (isLoggedIn.value && userCity.value) {
    items.push({
      to: `/city/${encodeURIComponent(userCity.value)}`,
      label: userCity.value,
      key: 'city',
    })
  }
  items.push({ to: '/top', label: '总榜', key: 'top' })
  if (isLoggedIn.value) {
    items.push({ to: '/watch', label: '关注', key: 'watch' })
  }
  return items
})

function navCurrent(item: { to: string; key: string }) {
  const path = route.path
  if (item.key === 'city') return path.startsWith('/city/')
  if (item.to === '/') return path === '/'
  if (item.to === '/column') {
    return path === '/column' || path === '/recent/long' || path.startsWith('/column/')
  }
  if (item.to === '/top') return path === '/top' || path.startsWith('/top/')
  if (item.to === '/watch') return path === '/watch' || path.startsWith('/watch/')
  return path === item.to || path.startsWith(`${item.to}/`)
}

/** 与现网 person-list 对齐（倒计时为按钮，插在设置后） */
const accountMenuTop = computed(() => {
  const name = account.value?.userName
  return [
    { to: name ? `/member/${name}` : '/login', label: '我的主页' },
    { to: '/settings', label: '设置' },
  ]
})
const accountMenuBottom = computed(() => [
  { to: '/charge/point', label: '❤ 捐助' },
  { to: '/vips', label: isVip.value ? '👑 我的 VIP' : '👑 开通 VIP' },
  { to: '/settings/help', label: '帮助' },
])

watch(
  () => auth.apiKey,
  (key) => {
    if (key) {
      void notices.refresh()
      notices.connect()
      void whispers.refreshUnread()
      void ensureMedalSession(key)
    } else {
      notices.disconnect()
      notices.clear()
      whispers.clear()
    }
  },
  { immediate: true },
)

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)

function onSearch(e: Event) {
  const q = (e.target as HTMLInputElement).value.trim()
  if (q) router.push({ path: '/search', query: { q } })
}

function logout() {
  menuOpen.value = false
  auth.logout()
  if (route.meta.auth) router.push('/')
}

function openCountSettings() {
  menuOpen.value = false
  countStore.settingsOpen = true
}

function toggleMenu(e: Event) {
  e.stopPropagation()
  menuOpen.value = !menuOpen.value
}

function onDocClick(e: MouseEvent) {
  const t = e.target as HTMLElement | null
  if (!t?.closest?.('.user-menu')) menuOpen.value = false
}

const apiOffline = ref(false)

function onApiOffline() {
  if (route.name === 'offline') return
  apiOffline.value = true
}

onMounted(() => {
  mounted.value = true
  document.addEventListener('click', onDocClick)
  window.addEventListener('fp:api-offline', onApiOffline)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('fp:api-offline', onApiOffline)
})
</script>

<template>
  <div class="shell">
    <div v-if="apiOffline && route.name !== 'offline'" class="offline-banner">
      <span>连不上摸鱼派接口</span>
      <RouterLink :to="{ path: '/offline', query: { from: route.fullPath } }" @click="apiOffline = false">
        查看详情
      </RouterLink>
      <button type="button" class="dismiss" aria-label="关闭" @click="apiOffline = false">×</button>
    </div>
    <header v-if="!immersive" class="nav">
      <RouterLink to="/" class="logo" aria-label="摸鱼派">
        <LogoMark />
      </RouterLink>
      <nav class="nav-tabs">
        <RouterLink
          v-for="item in navItems"
          :key="item.key"
          :to="item.to"
          :class="{ current: navCurrent(item) }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
      <input class="search" placeholder="搜索你感兴趣的内容" @keydown.enter="onSearch" />
      <div class="user">
        <template v-if="isLoggedIn">
          <RouterLink to="/games" class="bar-icon" title="活动" aria-label="活动">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21 6H3a1 1 0 0 0-1 1v4a5 5 0 0 0 5 5h1l1 2h2l1-2h4l1 2h2l1-2h1a5 5 0 0 0 5-5V7a1 1 0 0 0-1-1zM7.5 13.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9-1h-1v1h-2v-1h-1v-2h1v-1h2v1h1v2z"
              />
            </svg>
          </RouterLink>
          <button type="button" class="bar-icon theme" title="切换颜色模式" @click="appearance.toggleTheme()">
            ◐
          </button>
          <RouterLink
            to="/notifications"
            class="bar-icon count-link"
            :class="{ 'has-msg': unreadTotal > 0 }"
            title="通知"
            aria-label="通知"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2z"
              />
            </svg>
            <span>{{ unreadTotal > 99 ? '99+' : unreadTotal }}</span>
          </RouterLink>
          <RouterLink
            to="/chat"
            class="bar-icon count-link"
            :class="{ 'has-msg': whisperUnread > 0 }"
            title="私信"
            aria-label="私信"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="currentColor"
                d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 3v-3H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
              />
            </svg>
            <span>{{ whisperUnread > 99 ? '99+' : whisperUnread }}</span>
          </RouterLink>
          <RouterLink to="/pre-post" class="nav-pre-post" title="发帖">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z" />
            </svg>
            <span>发帖</span>
          </RouterLink>
          <div class="user-menu" :class="{ open: menuOpen }">
            <button
              type="button"
              class="avatar-btn"
              :title="displayName"
              aria-haspopup="menu"
              :aria-expanded="menuOpen"
              @click="toggleMenu"
            >
              <img v-if="avatarUrl" class="avatar" :src="avatarUrl" alt="" />
              <span v-else class="avatar fallback">{{ (account?.userName || '?').slice(0, 1) }}</span>
            </button>
            <div class="menu" role="menu">
              <div class="menu-head">
                <RouterLink :to="memberPath" class="menu-user" @click="menuOpen = false">
                  <img v-if="avatarUrl" :src="avatarUrl" alt="" />
                  <div>
                    <b>{{ displayName }}</b>
                    <span>@{{ account?.userName }}</span>
                  </div>
                </RouterLink>
                <p v-if="account?.userPoint != null" class="menu-points">
                  积分 {{ Number(account.userPoint).toLocaleString() }}
                  <em v-if="isVip">VIP</em>
                </p>
              </div>
              <RouterLink
                v-for="item in accountMenuTop"
                :key="item.to"
                :to="item.to"
                role="menuitem"
                @click="menuOpen = false"
              >
                {{ item.label }}
              </RouterLink>
              <button type="button" class="menu-btn" role="menuitem" @click="openCountSettings">⏰ 下班倒计时</button>
              <RouterLink
                v-for="item in accountMenuBottom"
                :key="item.to"
                :to="item.to"
                role="menuitem"
                @click="menuOpen = false"
              >
                {{ item.label }}
              </RouterLink>
              <button type="button" class="logout" role="menuitem" @click="logout">退出登录</button>
            </div>
          </div>
        </template>
        <template v-else>
          <RouterLink to="/login">登录</RouterLink>
          <RouterLink to="/register">注册</RouterLink>
          <button type="button" class="bar-icon theme" title="切换颜色模式" @click="appearance.toggleTheme()">
            ◐
          </button>
        </template>
      </div>
    </header>
    <CountWidget />
    <AdSlot v-if="!immersive" slot-key="home.top" />
    <main :class="{ 'main--cr-modern': isModernChat, 'main--immersive': immersive }">
      <div v-if="ssrAuthShell" class="auth-shell" />
      <RouterView v-else />
    </main>
    <footer v-if="!isModernChat && !immersive" class="foot">
      <div class="foot-inner">
        <div class="partner-row">
          <a
            v-for="p in partnerCards"
            :key="p.href"
            class="partner"
            :href="p.href"
            target="_blank"
            rel="noopener"
            :style="{ color: p.color, background: p.bg }"
          >
            <span class="partner-title">
              <img v-if="p.icon" :src="p.icon" width="16" height="16" alt="" />
              {{ p.title }}
            </span>
            <span class="partner-desc">{{ p.desc }}</span>
          </a>
        </div>

        <div class="foot-nav">
          <div class="foot-col">
            <div class="foot-label">摸鱼好站</div>
            <div class="foot-links">
              <a v-for="s in goodSites" :key="s.href" :href="s.href" target="_blank" rel="noopener">{{ s.label }}</a>
            </div>
          </div>
          <div class="foot-col">
            <div class="foot-label">探索</div>
            <div class="foot-links">
              <template v-for="s in exploreLinks" :key="s.href">
                <a v-if="s.external" :href="s.href" target="_blank" rel="noopener">{{ s.label }}</a>
                <a v-else-if="'rhythm' in s" :href="s.href" @click.prevent="openRhythm(s.href)">{{ s.label }}</a>
                <RouterLink v-else :to="s.href">{{ s.label }}</RouterLink>
              </template>
            </div>
          </div>
          <div class="foot-col">
            <div class="foot-label">摸鱼派客户端</div>
            <div class="foot-links">
              <RouterLink to="/download" class="client-main">客户端下载</RouterLink>
              <div class="client-icons">
                <RouterLink v-for="c in clientLinks" :key="c.href" :to="c.href" :title="c.label">{{ c.label }}</RouterLink>
              </div>
            </div>
          </div>
          <div class="foot-col">
            <div class="foot-label">关于 & 支持</div>
            <div class="foot-links">
              <template v-for="item in legalLinks" :key="item.href">
                <a v-if="item.external" :href="item.href" target="_blank" rel="noopener">{{ item.label }}</a>
                <a v-else-if="'rhythm' in item" :href="item.href" @click.prevent="openRhythm(item.href)">{{ item.label }}</a>
                <RouterLink v-else :to="item.href">{{ item.label }}</RouterLink>
              </template>
            </div>
          </div>
        </div>

        <div class="foot-bottom">
          <div class="slogan-box">
            <img src="/logo.png" alt="" class="foot-logo" width="24" height="24" />
            <span class="slogan">摸鱼派 - 鱼油专属摸鱼社区</span>
          </div>
          <div class="copy">
            <p>Copyright © 2021 - 2026 W&amp;P Tech. All Rights Reserved. 北京白与画科技有限公司 版权所有</p>
            <p class="beian">
              <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">京ICP备2022000226号-1</a>
              <a
                href="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=11011302003886"
                target="_blank"
                rel="noopener"
                class="police"
              >
                <img
                  src="https://mbdp01.bdstatic.com/static/landing-pc/img/icon_police.7296bdfd.png"
                  width="16"
                  height="16"
                  alt=""
                />
                京公网安备 11011302003886号
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
    <RiskCaptchaGate />
    <SystemAlertDialog />
    <WarnBroadcastDialog />
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
}
.offline-banner {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 16px;
  background: color-mix(in srgb, var(--fp-accent) 18%, var(--fp-card));
  border-bottom: 1px solid var(--fp-border);
  color: var(--fp-title);
  font-size: 13px;
}
.offline-banner a {
  color: var(--fp-link);
}
.offline-banner .dismiss {
  position: absolute;
  right: 12px;
  border: 0;
  background: transparent;
  color: var(--fp-muted);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
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
.logo :deep(.logo-animate) {
  display: block;
}
.nav-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  min-width: 0;
  justify-content: center;
  overflow-x: auto;
  scrollbar-width: none;
}
.nav-tabs::-webkit-scrollbar {
  display: none;
}
.nav-tabs a {
  color: var(--fp-nav-text);
  text-decoration: none;
  font-size: 14px;
  white-space: nowrap;
  padding: 6px 10px;
  border-radius: 6px;
}
.nav-tabs a.current,
.nav-tabs a:hover {
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
  flex-shrink: 0;
}
.user {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  flex-shrink: 0;
}
.user > a {
  color: var(--fp-nav-text);
  text-decoration: none;
  white-space: nowrap;
}
.user > a:hover {
  color: var(--fp-accent);
}
.bar-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 36px;
  height: 36px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--fp-nav-text);
  text-decoration: none;
  cursor: pointer;
  line-height: 1;
}
.bar-icon:hover {
  color: var(--fp-accent);
  background: var(--fp-hover);
}
.bar-icon.theme {
  font-size: 18px;
}
.count-link span {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  min-width: 1ch;
}
.count-link.has-msg {
  color: var(--fp-accent);
}
.nav-pre-post {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 10px;
  border-radius: 6px;
  color: var(--fp-nav-text);
  text-decoration: none;
  white-space: nowrap;
}
.nav-pre-post:hover {
  color: var(--fp-accent);
  background: var(--fp-hover);
}
.user-menu {
  position: relative;
  margin-left: 4px;
}
.avatar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  border-radius: 50%;
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  box-shadow: 0 0 0 2px transparent;
}
.avatar-btn:hover .avatar,
.user-menu.open .avatar {
  box-shadow: 0 0 0 2px var(--fp-accent);
}
.avatar.fallback {
  display: grid;
  place-items: center;
  background: var(--fp-hover);
  color: var(--fp-nav-text);
  font-size: 14px;
  font-weight: 600;
}
.menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 220px;
  background: var(--fp-card);
  color: var(--fp-text);
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  box-shadow: var(--fp-card-shadow, 0 8px 24px rgba(0, 0, 0, 0.12));
  padding: 0;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition:
    opacity 0.12s ease,
    transform 0.12s ease,
    visibility 0.12s;
  z-index: 40;
  overflow: hidden;
}
.user-menu:hover .menu,
.user-menu.open .menu {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
.menu-head {
  padding: 10px 12px 12px;
  border-bottom: 1px solid var(--fp-border);
}
.menu-user {
  display: flex;
  gap: 10px;
  align-items: center;
  width: auto;
  padding: 0;
  border: 0;
  background: transparent !important;
  text-decoration: none;
  color: inherit !important;
  cursor: pointer;
}
.menu-user:hover,
.menu-user.router-link-active,
.menu-user.router-link-exact-active {
  background: transparent !important;
  color: inherit !important;
}
.menu-user img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.menu-user b {
  display: block;
  font-size: 14px;
  color: var(--fp-title);
}
.menu-user span {
  font-size: 12px;
  color: var(--fp-muted);
}
.menu-points {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--fp-muted);
}
.menu-points em {
  margin-left: 6px;
  font-style: normal;
  color: var(--fp-accent);
  font-weight: 600;
}
.menu > a:not(.menu-user),
.menu-btn,
.logout {
  display: block;
  width: 100%;
  padding: 8px 14px;
  font-size: 13px;
  color: var(--fp-text);
  text-decoration: none;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--fp-border);
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  box-sizing: border-box;
  line-height: 21px;
}
.menu > :last-child {
  border-bottom: 0;
}
.menu > a:not(.menu-user):hover,
.menu-btn:hover,
.logout:hover {
  background: var(--fp-hover);
  color: var(--fp-accent);
}
.logout {
  color: #c45c4a;
}
main {
  max-width: var(--fp-wrap);
  margin: 0 auto;
  padding: 25px 15px 20px;
}
main.main--immersive {
  max-width: none;
  padding: 0;
}
main.main--cr-modern {
  padding: 8px 15px 0;
  max-width: 1440px;
}
.foot {
  background: var(--fp-footer);
  color: var(--fp-nav-text);
  padding: 32px 0;
}
.foot-inner {
  max-width: var(--fp-wrap);
  margin: 0 auto;
  padding: 0 15px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.partner-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.partner {
  flex: 1 1 200px;
  text-align: center;
  padding: 12px;
  line-height: 1.4;
  border-radius: 8px;
  text-decoration: none;
  font-size: 13px;
  transition: transform 0.2s;
}
.partner:hover {
  transform: translateY(-2px);
}
.partner-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-weight: 600;
  margin-bottom: 4px;
}
.partner-title img {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}
.partner-desc {
  display: block;
  opacity: 0.8;
  color: inherit;
}
.foot-nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 24px;
  border-top: 1px solid var(--fp-border);
  border-bottom: 1px solid var(--fp-border);
  padding: 24px 0;
}
.foot-col {
  flex: 1;
  min-width: 140px;
}
.foot-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--fp-title);
  margin-bottom: 12px;
}
.foot-links {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
}
.foot-links a {
  color: var(--fp-nav-text);
  text-decoration: none;
  transition: color 0.2s;
}
.foot-links a:hover {
  color: var(--fp-accent);
}
.client-main {
  font-weight: 600;
  color: var(--fp-primary) !important;
}
.client-icons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}
.client-icons a {
  background: var(--fp-bg);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  border: 1px solid var(--fp-border);
  opacity: 0.85;
}
.client-icons a:hover {
  border-color: var(--fp-accent);
  color: var(--fp-accent);
  opacity: 1;
}
.foot-bottom {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  font-size: 12px;
}
.slogan-box {
  display: flex;
  align-items: center;
  gap: 8px;
}
.slogan {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--fp-title);
}
.copy {
  text-align: right;
  line-height: 1.6;
}
.copy p {
  margin: 0 0 6px;
  color: var(--fp-muted);
}
.beian {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}
.beian a {
  color: var(--fp-nav-text);
  text-decoration: none;
}
.beian a:hover {
  color: var(--fp-accent);
}
.police {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

@media (max-width: 768px) {
  .foot-bottom {
    flex-direction: column;
    align-items: flex-start;
  }
  .copy, .beian {
    text-align: left;
    justify-content: flex-start;
  }
}
.beian {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
  align-items: center;
}
.police {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.legal-links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  margin-top: 10px;
}
@media (max-width: 1200px) {
  .nav-tabs a {
    padding: 6px 7px;
  }
  .search {
    width: 150px;
  }
}
@media (max-width: 960px) {
  .nav {
    justify-content: space-between;
    gap: 6px;
    padding: 5px 10px;
  }
  .nav-tabs {
    justify-content: flex-start;
  }
  .nav-tabs a {
    padding: 4px 8px;
  }
  .search {
    display: none;
  }
  .user {
    gap: 2px;
  }
  .nav-pre-post span {
    display: none;
  }
  .foot-inner {
    flex-direction: column;
    gap: 12px;
  }
  .slogan {
    flex: none;
  }
}
</style>
