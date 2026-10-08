<script setup lang="ts">
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAppearanceStore } from '@/stores/appearance'
import { useNoticeStore } from '@/stores/notices'
import { useWhisperStore } from '@/stores/whispers'
import { useChatStore } from '@/stores/chat'
import AdSlot from '@/components/ads/AdSlot.vue'
import LogoMark from '@/components/LogoMark.vue'

const nav = [
  { to: '/', label: '最新' },
  { to: '/column', label: '专栏' },
  { to: '/hot', label: '热门' },
  { to: '/cr', label: '聊天室' },
  { to: '/domains', label: '领域' },
  { to: '/breezemoons', label: '清风明月' },
  { to: '/qna', label: '问答' },
  { to: '/perfect', label: '优选' },
  { to: '/top', label: '总榜' },
]

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
  { href: 'https://fishpi.cn/milestones', label: '大事记', external: true },
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
  { href: 'https://fishpi.cn/statistic', label: '数据统计', external: true },
  { href: '/agreement', label: '用户协议', external: false },
  { href: '/privacy', label: '隐私政策', external: false },
  { href: '/logs', label: '日志公开', external: false },
  { href: '/article/1636516552191', label: '开放 API', external: false },
  { href: '/article/1782119519493', label: '接入 OAuth', external: false },
]

const route = useRoute()
/** 需登录页服务端只出空壳，避免 hydration 复用错页面 DOM（含 scoped 样式标记）。 */
const ssrAuthShell = computed(() => import.meta.env.SSR && Boolean(route.meta.auth))
const router = useRouter()
const auth = useAuthStore()
const appearance = useAppearanceStore()
const notices = useNoticeStore()
const whispers = useWhisperStore()
const chat = useChatStore()
const { isLoggedIn, account, isVip } = storeToRefs(auth)
const { total: unreadTotal } = storeToRefs(notices)
const { unreadTotal: whisperUnread } = storeToRefs(whispers)

const isModernChat = computed(() => route.path === '/cr' && chat.chatStyle === 'modern')

const memberPath = computed(() => (account.value?.userName ? `/member/${account.value.userName}` : '/login'))
const avatarUrl = computed(() => account.value?.userAvatarURL || '')
const displayName = computed(() => account.value?.userNickname || account.value?.userName || '')
const menuOpen = ref(false)

const accountMenu = computed(() => {
  const name = account.value?.userName
  return [
    { to: name ? `/member/${name}` : '/login', label: '我的主页' },
    { to: '/points', label: '积分', hint: account.value?.userPoint != null ? Number(account.value.userPoint).toLocaleString() : '' },
    { to: '/vips', label: isVip.value ? '我的 VIP' : '开通 VIP' },
    { to: '/stars', label: '收藏' },
    { to: '/following', label: '关注' },
    { to: '/settings', label: '设置' },
    { to: '/activity', label: '活动' },
    { to: '/games', label: '游戏 / 鱼游' },
    { to: '/logs', label: '公开日志' },
    { to: '/charge/point', label: '捐助' },
  ]
})

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

function toggleMenu(e: Event) {
  e.stopPropagation()
  menuOpen.value = !menuOpen.value
}

function onDocClick(e: MouseEvent) {
  const t = e.target as HTMLElement | null
  if (!t?.closest?.('.user-menu')) menuOpen.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div class="shell">
    <header class="nav">
      <RouterLink to="/" class="logo" aria-label="摸鱼派">
        <LogoMark />
      </RouterLink>
      <nav>
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          :class="{
            current:
              route.path === item.to ||
              (item.to === '/column' &&
                (route.path === '/recent/long' || route.path.startsWith('/column/'))) ||
              (item.to === '/top' && route.path.startsWith('/top/')),
          }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
      <input class="search" placeholder="搜索你感兴趣的内容" @keydown.enter="onSearch" />
      <div class="user">
        <template v-if="isLoggedIn">
          <RouterLink to="/post" class="bar-link">发帖</RouterLink>
          <RouterLink to="/chat" class="bar-link icon-link" title="私信">
            私信
            <em v-if="whisperUnread" class="badge">{{ whisperUnread > 99 ? '99+' : whisperUnread }}</em>
          </RouterLink>
          <RouterLink to="/notifications" class="bar-link icon-link" title="通知">
            通知
            <em v-if="unreadTotal" class="badge">{{ unreadTotal > 99 ? '99+' : unreadTotal }}</em>
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
                v-for="item in accountMenu"
                :key="item.to"
                :to="item.to"
                role="menuitem"
                @click="menuOpen = false"
              >
                <span>{{ item.label }}</span>
                <em v-if="item.hint">{{ item.hint }}</em>
              </RouterLink>
              <button type="button" class="logout" role="menuitem" @click="logout">退出登录</button>
            </div>
          </div>
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
    <main :class="{ 'main--cr-modern': isModernChat }">
      <div v-if="ssrAuthShell" class="auth-shell" />
      <RouterView v-else />
    </main>
    <footer v-if="!isModernChat" class="foot">
      <div class="foot-inner">
        <p class="slogan">摸鱼派 - 鱼油专属摸鱼社区</p>
        <div class="foot-main">
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
                <img v-if="p.icon" :src="p.icon" width="14" height="14" alt="" />
                {{ p.title }}
              </span>
              <span class="partner-desc">{{ p.desc }}</span>
            </a>
          </div>

          <div class="foot-block">
            <div class="foot-label">摸鱼好站</div>
            <p class="pipe-links">
              <template v-for="(s, i) in goodSites" :key="s.href">
                <span v-if="i">｜</span>
                <a :href="s.href" target="_blank" rel="noopener">{{ s.label }}</a>
              </template>
            </p>
          </div>

          <div class="foot-block">
            <div class="foot-label">探索</div>
            <p class="pipe-links">
              <template v-for="(s, i) in exploreLinks" :key="s.href">
                <span v-if="i">｜</span>
                <a v-if="s.external" :href="s.href" target="_blank" rel="noopener">{{ s.label }}</a>
                <RouterLink v-else :to="s.href">{{ s.label }}</RouterLink>
              </template>
            </p>
            <p class="clients">
              <RouterLink to="/download">摸鱼派客户端</RouterLink>
              <span class="client-icons">
                <RouterLink v-for="c in clientLinks" :key="c.href" :to="c.href" :title="c.label">{{
                  c.label
                }}</RouterLink>
              </span>
            </p>
          </div>

          <div class="foot-legal">
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
            <p class="legal-links">
              <template v-for="item in legalLinks" :key="item.href">
                <a v-if="item.external" :href="item.href" target="_blank" rel="noopener">{{ item.label }}</a>
                <RouterLink v-else :to="item.href">{{ item.label }}</RouterLink>
              </template>
            </p>
          </div>
        </div>
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
.logo :deep(.logo-animate) {
  display: block;
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
.user > a,
.bar-link {
  color: var(--fp-nav-text);
  text-decoration: none;
  position: relative;
  white-space: nowrap;
}
.user > a:hover,
.bar-link:hover {
  color: var(--fp-accent);
}
.icon-link {
  padding-right: 4px;
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
.user-menu {
  position: relative;
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
  padding: 8px 0;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition:
    opacity 0.12s ease,
    transform 0.12s ease,
    visibility 0.12s;
  z-index: 40;
}
.user-menu:hover .menu,
.user-menu.open .menu {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
.menu-head {
  padding: 8px 12px 10px;
  border-bottom: 1px solid var(--fp-border);
  margin-bottom: 4px;
}
.menu-user {
  display: flex;
  gap: 10px;
  align-items: center;
  text-decoration: none;
  color: inherit;
}
.menu-user img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
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
.menu a,
.logout {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  font-size: 13px;
  color: var(--fp-text);
  text-decoration: none;
  background: transparent;
  border: 0;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}
.menu a:hover,
.logout:hover {
  background: var(--fp-hover);
  color: var(--fp-accent);
}
.menu a em {
  font-style: normal;
  color: var(--fp-muted);
  font-size: 12px;
}
.logout {
  border-top: 1px solid var(--fp-border);
  margin-top: 4px;
  color: #c45c4a;
}
.theme {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--fp-border) !important;
  background: transparent;
  color: var(--fp-nav-text);
  cursor: pointer;
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
@media (max-width: 1400px) {
  .income {
    display: none;
  }
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
main.main--cr-modern {
  padding: 8px 15px 0;
  max-width: 1440px;
}
.foot {
  background: var(--fp-footer);
  color: var(--fp-nav-text);
  padding: 24px 0 36px;
}
.foot-inner {
  max-width: var(--fp-wrap);
  margin: 0 auto;
  padding: 0 15px;
  display: flex;
  gap: 28px;
  align-items: flex-start;
}
.slogan {
  flex: 0 0 160px;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--fp-nav-text);
}
.foot-main {
  flex: 1;
  min-width: 0;
}
.partner-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.partner {
  width: 175px;
  text-align: center;
  padding: 8px 0;
  line-height: 20px;
  border-radius: 12px;
  text-decoration: none;
  font-size: 12px;
}
.partner-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-weight: 600;
}
.partner-title img {
  width: 14px;
  height: 14px;
}
.partner-desc {
  display: block;
  color: #323232;
  margin-top: 2px;
}
.foot-block {
  margin-bottom: 10px;
  font-size: 12px;
}
.foot-label {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--fp-nav-text);
}
.pipe-links,
.clients,
.legal-links {
  margin: 0;
  line-height: 1.8;
}
.pipe-links a,
.clients a,
.legal-links a,
.beian a {
  color: var(--fp-nav-text);
  text-decoration: none;
}
.pipe-links a:hover,
.clients a:hover,
.legal-links a:hover,
.beian a:hover {
  color: var(--fp-accent);
}
.pipe-links span {
  margin: 0 4px;
  color: var(--fp-muted);
  opacity: 0.7;
}
.clients {
  margin-top: 4px;
}
.client-icons {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: 10px;
}
.client-icons a {
  font-size: 11px;
  opacity: 0.85;
}
.foot-legal {
  margin-top: 14px;
  font-size: 12px;
}
.copy p {
  margin: 0 0 6px;
  color: var(--fp-muted);
  line-height: 1.5;
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
@media (max-width: 960px) {
  .search {
    width: 120px;
  }
  .bar-link {
    font-size: 13px;
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
