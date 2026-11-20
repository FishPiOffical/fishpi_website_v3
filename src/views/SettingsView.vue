<script setup lang="ts">
import GameSaveRecovery from '@/components/GameSaveRecovery.vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import SidebarIcon from '@/chat/sidebar/SidebarIcon.vue'
import AppearancePicker from '@/components/packs/AppearancePicker.vue'
import EmojiPacks from '@/components/EmojiPacks.vue'
import OwnerProfileSettings from '@/components/settings/OwnerProfileSettings.vue'
import OwnerCardBackground from '@/components/settings/OwnerCardBackground.vue'
import OwnerPreferences from '@/components/settings/OwnerPreferences.vue'
import OwnerGameSaves from '@/components/settings/OwnerGameSaves.vue'
import OwnerAppLogin from '@/components/settings/OwnerAppLogin.vue'
import { useAuthStore } from '@/stores/auth'
import OwnerMedals from '@/components/settings/OwnerMedals.vue'
import OwnerProfessions from '@/components/settings/OwnerProfessions.vue'
import PointTransfer from '@/components/settings/PointTransfer.vue'
import OwnerIdentityApplication from '@/components/settings/OwnerIdentityApplication.vue'
import OwnerPostExport from '@/components/settings/OwnerPostExport.vue'
import OwnerSecurity from '@/components/settings/OwnerSecurity.vue'
import OwnerInventory from '@/components/settings/OwnerInventory.vue'
import OwnerInvitations from '@/components/settings/OwnerInvitations.vue'

const route = useRoute()
const auth = useAuthStore()
const { account, isLoggedIn: authenticated } = storeToRefs(auth)
const mounted = ref(false)
const isLoggedIn = computed(() => mounted.value && authenticated.value)
const settingsMenuOpen = ref(false)
const pageHeading = ref<HTMLElement | null>(null)
const menuToggle = ref<HTMLButtonElement | null>(null)

const menuGroups = [
  {
    label: '个人与外观',
    items: [
      { id: 'profile', to: '/settings', label: '个人资料' },
      { id: 'avatar', to: '/settings/avatar', label: '头像' },
      { id: 'system', to: '/settings/system', label: '个性化' },
      { id: 'emojis', to: '/settings/emojis', label: '表情包' },
    ],
  },
  {
    label: '社区与偏好',
    items: [
      { id: 'function', to: '/settings/function', label: '功能与显示' },
      { id: 'privacy', to: '/settings/privacy', label: '隐私' },
      { id: 'profession', to: '/settings/profession', label: '职业' },
      { id: 'i18n', to: '/settings/i18n', label: '语言与时区' },
    ],
  },
  {
    label: '账号与服务',
    items: [
      { id: 'account', to: '/settings/account', label: '账号' },
      { id: 'point', to: '/settings/point', label: '积分' },
      { id: 'invite', to: '/settings/invite', label: '邀请' },
      { id: 'identity', to: '/settings/identity', label: '认证' },
      { id: 'data', to: '/settings/data', label: '数据' },
      { id: 'help', to: '/settings/help', label: '帮助' },
    ],
  },
]

const helpLinks = [
  { to: '/article/1630569106133', title: '快速开始', tip: '新人上手' },
  { to: '/article/1630575841478', title: '基础功能', tip: '发帖与互动' },
  { to: '/article/1631459254239', title: '快捷键', tip: '键盘操作' },
  { to: '/article/1631460144004', title: 'Markdown 教程', tip: '排版指南' },
]
const tab = computed(() => String(route.meta.settingsTab || 'profile'))
const tabs = menuGroups.flatMap(group => group.items)
const currentTabLabel = computed(() => tabs.find(item => item.id === tab.value)?.label || '个人资料')

function closeMenu(focus: 'heading' | 'toggle') {
  if (!settingsMenuOpen.value) return
  settingsMenuOpen.value = false
  void nextTick(() => (focus === 'heading' ? pageHeading.value : menuToggle.value)?.focus({ preventScroll: true }))
}

watch(
  () => route.fullPath,
  () => closeMenu('heading'),
)


function scrollToHashTarget() {
  const id = route.hash.replace(/^#/, '')
  if (!id || typeof document === 'undefined') return
  void nextTick(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

watch(tab, (t) => {
  if (t === 'account') scrollToHashTarget()
})

watch(
  () => route.hash,
  () => {
    if (tab.value === 'account') scrollToHashTarget()
  },
)

onMounted(() => { mounted.value = true; if (tab.value === 'account') scrollToHashTarget() })

</script>

<template>
  <div class="page fp-page fp-ui fp-settings">
    <aside class="set-side" @keydown.esc="closeMenu('toggle')">
      <div class="menu-title"><SidebarIcon name="settings" />个人设置</div>
      <button
        ref="menuToggle"
        type="button"
        class="set-toggle fp-control"
        aria-controls="settings-navigation"
        :aria-expanded="settingsMenuOpen"
        @click="settingsMenuOpen = !settingsMenuOpen"
      >
        <SidebarIcon name="settings" />
        设置分类
        <SidebarIcon name="chevron" class="chevron" :class="{ open: settingsMenuOpen }" />
      </button>
      <nav id="settings-navigation" class="set-menu" :class="{ open: settingsMenuOpen }" aria-label="设置分类">
        <div v-for="group in menuGroups" :key="group.label" class="menu-group">
          <h2>{{ group.label }}</h2>
          <RouterLink v-for="item in group.items" :key="item.id" :to="item.to" :aria-current="tab === item.id ? 'page' : undefined" @click="item.id === tab && closeMenu('heading')">
            {{ item.label }}
          </RouterLink>
        </div>
      </nav>
    </aside>
    <div class="set-main">
      <header class="settings-page-head">
        <h1 ref="pageHeading" tabindex="-1">{{ currentTabLabel }}</h1>
        <RouterLink v-if="isLoggedIn && account?.userName && tab === 'profile'" :to="`/member/${encodeURIComponent(account.userName)}`">查看主页 ↗</RouterLink>
        <RouterLink v-if="tab === 'point'" to="/points">积分流水 ↗</RouterLink>
      </header>
      <p v-if="!isLoggedIn" class="card hint fp-card login-notice">
        <span><RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>后可修改设置。游客仍可调整本机主题外观。</span>
      </p>

      <section v-if="tab === 'profile' && isLoggedIn" class="card fp-card">
        <OwnerProfileSettings key="profile" mode="profile" />
      </section>

      <div v-if="tab === 'system'" class="settings-stack">
        <section class="card fp-card">
          <p class="hint">主题免费。对话框和头像框的进阶样式需<RouterLink to="/vips">开通 VIP</RouterLink>。</p>
          <AppearancePicker />
        </section>
        <OwnerPreferences v-if="isLoggedIn" key="site-skins" resource="display" title="站点皮肤" :fields="['skin', 'mobileSkin']" />
        <OwnerCardBackground v-if="isLoggedIn" />
      </div>

      <section v-if="tab === 'avatar' && isLoggedIn" class="card fp-card">
        <OwnerProfileSettings key="avatar" mode="avatar" />
      </section>

      <div v-if="tab === 'account' && isLoggedIn" class="settings-stack">
        <OwnerInventory />
        <OwnerMedals />
        <OwnerSecurity />
        <OwnerAppLogin />
      </div>

      <div v-if="tab === 'function' && isLoggedIn" class="settings-stack">
        <OwnerPreferences key="functions" resource="functions" title="功能设置" />
        <OwnerPreferences key="display-modes" resource="display" title="显示设置" :fields="['commentViewMode', 'avatarViewMode']" />
        <RouterLink class="card fp-card emoji-shortcut" to="/settings/emojis">
          管理表情包 <span aria-hidden="true">→</span>
        </RouterLink>
      </div>

      <div v-if="tab === 'emojis' && isLoggedIn" class="card fp-card">
        <EmojiPacks />
      </div>

      <div v-if="tab === 'privacy' && isLoggedIn" class="settings-stack">
        <OwnerPreferences key="privacy" resource="privacy" title="隐私设置" />
        <OwnerPreferences key="location" resource="location" title="地理位置公开设置" />
      </div>

      <section v-if="tab === 'profession' && isLoggedIn" class="card fp-card">
        <OwnerProfessions />
      </section>

      <section v-if="tab === 'point' && isLoggedIn" class="card fp-card">
        <PointTransfer :initial-recipient="typeof route.query.to === 'string' ? route.query.to : ''" />
      </section>

      <section v-if="tab === 'invite' && isLoggedIn" class="card fp-card">
        <OwnerInvitations />
      </section>

      <section v-if="tab === 'identity' && isLoggedIn" class="card fp-card">
        <OwnerIdentityApplication />
      </section>

      <div v-if="tab === 'data' && isLoggedIn" class="settings-stack">
        <nav v-if="account" class="card fp-card settings-quick-links" aria-label="本人匿名创作入口">
          <RouterLink :to="`/member/${encodeURIComponent(account.userName)}/articles/anonymous`">本人匿名文章</RouterLink>
          <RouterLink :to="`/member/${encodeURIComponent(account.userName)}/comments/anonymous`">本人匿名评论</RouterLink>
        </nav>
        <div class="card fp-card"><OwnerPostExport /></div>
        <GameSaveRecovery />
        <OwnerGameSaves />
      </div>

      <OwnerPreferences v-if="tab === 'i18n' && isLoggedIn" key="locale" resource="locale" title="语言与时区" />

      <section v-if="tab === 'help'" class="card fp-card">

        <ul class="help-list">
          <li v-for="item in helpLinks" :key="item.to">
            <RouterLink :to="item.to">{{ item.title }}</RouterLink>
            <span>{{ item.tip }}</span>
          </li>
        </ul>
      </section>
    </div>

  </div>
</template>

<style scoped>
.page {
  display: grid;
  grid-template-columns: 188px minmax(0, 1fr);
  align-items: start;
  gap: var(--fp-page-gap);
}
.set-side, .set-main { min-width: 0; }
.set-side {
  position: sticky;
  top: calc(var(--fp-nav-h) + var(--fp-page-top));
  max-height: calc(100vh - var(--fp-nav-h) - 2 * var(--fp-page-top));
  max-height: calc(100dvh - var(--fp-nav-h) - 2 * var(--fp-page-top));
  overflow-y: auto;
  scrollbar-width: thin;
  padding: 14px 10px;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius);
}
.menu-title, .set-toggle {
  align-items: center;
  gap: 9px;
  font-weight: 650;
  color: var(--fp-title);
}
.menu-title { display: flex; padding: 0 10px 14px; border-bottom: 1px solid var(--fp-divider); }
.set-side svg { flex: none; width: 17px; height: 17px; }
.menu-title svg { color: var(--fp-muted); }
.set-toggle { display: none; }
.set-menu { display: grid; gap: 16px; margin-top: 14px; }
.menu-group { display: grid; gap: 2px; }
.menu-group h2 { margin: 0 10px 3px; }
.set-menu a {
  position: relative;
  padding: 6px 12px;
  border-radius: var(--fp-control-radius);
  color: var(--fp-text);
  font-size: 13px;
  line-height: 1.55;
  text-decoration: none;
}
.set-menu a:hover { background: var(--fp-hover); }
.set-menu a[aria-current="page"] {
  color: var(--fp-primary-ink, var(--fp-primary));
  background: var(--fp-primary-soft);
  font-weight: 650;
}
.set-menu a[aria-current="page"]::before {
  content: '';
  position: absolute;
  inset: 9px auto 9px 0;
  width: 3px;
  border-radius: 3px;
  background: var(--fp-primary);
}
.set-main { display: grid; align-content: start; gap: 14px; }
.settings-page-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.settings-page-head h1 {
  margin: 0;
  font-size: var(--fp-page-title-size);
  color: var(--fp-title);
  line-height: 1.4;
}
.settings-page-head a { font-size: 13px; color: var(--fp-muted); }
.card { min-width: 0; }
.card > .hint { color: var(--fp-muted); margin: 0 0 16px; }
.fp-settings .login-notice { margin: 0; padding: 14px var(--fp-panel-padding); }
.emoji-shortcut {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-weight: 600;
  font-size: 14px;
  color: var(--fp-title);
  text-decoration: none;
}
.emoji-shortcut:hover { color: var(--fp-primary-ink, var(--fp-primary)); border-color: var(--fp-border-strong); }
.help-list { list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 0; margin: 0; }
.help-list li { padding: 16px; border: 1px solid var(--fp-border); border-radius: 10px; display: grid; gap: 6px; }
.help-list a { font-size: 14px; color: var(--fp-title); font-weight: 600; }
.help-list span { font-size: 12px; color: var(--fp-muted); }
a:focus-visible, button:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 2px; }

@media (max-width: 800px) {
  .page { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .set-side { position: static; max-height: none; overflow: visible; padding: 0; }
  .menu-title { display: none; }
  .set-toggle.fp-control {
    display: flex;
    width: 100%;
    padding: 10px 14px;
    background: transparent;
    border: 0;
    font-size: 14px;
  }
  .chevron { margin-inline-start: auto; }
  .chevron.open { transform: rotate(180deg); }
  .set-menu { display: none; }
  .set-menu.open { display: grid; margin: 0; padding: 12px; border-top: 1px solid var(--fp-divider); }
  .menu-group { grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr)); }
  .menu-group h2 { grid-column: 1 / -1; }
  .set-menu a { padding-block: 9px; }
  .help-list { grid-template-columns: minmax(0, 1fr); }
}
</style>
<style src="../styles/settings.css"></style>
