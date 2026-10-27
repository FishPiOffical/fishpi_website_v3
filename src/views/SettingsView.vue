<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppearancePicker from '@/components/packs/AppearancePicker.vue'
import EmojiPacks from '@/components/EmojiPacks.vue'
import OwnerProfileSettings from '@/components/settings/OwnerProfileSettings.vue'
import OwnerPreferences from '@/components/settings/OwnerPreferences.vue'
import {
  fetchAppLoginQr,
} from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import FpLoading from '@/components/FpLoading.vue'
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
const { apiKey, account, isLoggedIn: authenticated } = storeToRefs(auth)
const mounted = ref(false)
const isLoggedIn = computed(() => mounted.value && authenticated.value)
const settingsMenuOpen = ref(false)

const tabs = [
  { id: 'profile', to: '/settings', label: '资料' },
  { id: 'system', to: '/settings/system', label: '个性化' },
  { id: 'avatar', to: '/settings/avatar', label: '头像' },
  { id: 'account', to: '/settings/account', label: '账号' },
  { id: 'function', to: '/settings/function', label: '功能' },
  { id: 'point', to: '/settings/point', label: '积分' },
  { id: 'invite', to: '/settings/invite', label: '邀请' },
  { id: 'identity', to: '/settings/identity', label: '认证' },
  { id: 'data', to: '/settings/data', label: '数据' },
  { id: 'i18n', to: '/settings/i18n', label: '语言' },
  { id: 'privacy', to: '/settings/privacy', label: '隐私' },
  { id: 'profession', to: '/settings/profession', label: '职业' },
  { id: 'help', to: '/settings/help', label: '帮助' },
] as const

const helpLinks = [
  { to: '/article/1630569106133', title: '快速开始', tip: '新人上手' },
  { to: '/article/1630575841478', title: '基础功能', tip: '发帖与互动' },
  { to: '/article/1631459254239', title: '快捷键', tip: '键盘操作' },
  { to: '/article/1631460144004', title: 'Markdown 教程', tip: '排版指南' },
]
const tab = computed(() => String(route.meta.settingsTab || 'profile'))
const currentTabLabel = computed(() => tabs.find((t) => t.id === tab.value)?.label || '资料')

watch(
  () => route.fullPath,
  () => {
    settingsMenuOpen.value = false
  },
)


const appQr = ref('')
const appQrLoading = ref(false)
const appQrErr = ref('')

function scrollToHashTarget() {
  const id = route.hash.replace(/^#/, '')
  if (!id || typeof document === 'undefined') return
  void nextTick(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

watch(tab, (t) => {
  if (t === 'account' && apiKey.value) void loadAccountExtras().then(scrollToHashTarget)
})

watch(
  () => route.hash,
  () => {
    if (tab.value === 'account') scrollToHashTarget()
  },
)

onMounted(async () => {
  mounted.value = true
  if (apiKey.value && !account.value) await auth.restore()
  const name = account.value?.userName
  if (apiKey.value && name) {
    if (tab.value === 'account') {
      await loadAccountExtras()
      scrollToHashTarget()
    }
  }
})

async function loadAccountExtras() {
  await Promise.all([loadAppQr()])
}

async function loadAppQr() {
  if (!apiKey.value) return
  appQrLoading.value = true
  appQrErr.value = ''
  try {
    appQr.value = await fetchAppLoginQr(apiKey.value)
  } catch (e) {
    appQrErr.value = e instanceof Error ? e.message : 'APP 扫码加载失败'
    appQr.value = ''
  } finally {
    appQrLoading.value = false
  }
}

</script>

<template>
  <div class="page">
    <div class="set-main">
      <p v-if="!isLoggedIn" class="card hint">
        <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>
        后可修改设置。游客仍可调整本机主题外观。
      </p>

      <section v-if="tab === 'profile'" class="card">
        <header class="mod-head">
          <RouterLink v-if="isLoggedIn && account?.userName" :to="`/member/${account.userName}`">{{ account.userName }}</RouterLink>
          <h1>资料</h1>
        </header>
        <OwnerProfileSettings v-if="isLoggedIn" key="profile" mode="profile" />
      </section>

      <section v-if="tab === 'system'" class="card">
        <h1>个性化</h1>
        <p class="hint">
          主题免费。对话框和头像框的进阶样式需
          <RouterLink to="/vips">开通 VIP</RouterLink>
          。
        </p>
        <AppearancePicker />
        <template v-if="isLoggedIn">
          <p class="hint">以下皮肤选项用于经典页面的桌面与移动显示。</p>
          <OwnerPreferences key="site-skins" resource="display" title="站点皮肤" :fields="['skin', 'mobileSkin']" />
        </template>
      </section>

      <section v-if="tab === 'avatar'" class="card">
        <h1>头像</h1>
        <OwnerProfileSettings v-if="isLoggedIn" key="avatar" mode="avatar" />
      </section>

      <section v-if="tab === 'account'" class="card">
        <h1>账号</h1>
        <template v-if="isLoggedIn">
          <OwnerInventory />

          <OwnerMedals />

          <OwnerSecurity />

          <h2>官方 APP 扫码登录</h2>
          <p class="hint">请使用摸鱼派官方 APP 扫码登录。勿将本二维码分享给他人。</p>
          <FpLoading v-if="appQrLoading" />
          <p v-else-if="appQrErr" class="err">{{ appQrErr }}</p>
          <img v-else-if="appQr" class="mfa-qr" :src="appQr" width="150" height="150" alt="APP 登录二维码" />
          <button type="button" class="ghost-btn" :disabled="appQrLoading" @click="loadAppQr">刷新二维码</button>

        </template>
      </section>

      <section v-if="tab === 'function'" class="card">
        <h1>功能</h1>
        <template v-if="isLoggedIn">
          <OwnerPreferences key="functions" resource="functions" title="功能设置" />
          <OwnerPreferences key="display-modes" resource="display" title="显示设置" :fields="['commentViewMode', 'avatarViewMode']" />
          <h2>表情包</h2>
          <EmojiPacks />
        </template>
      </section>

      <section v-if="tab === 'privacy'" class="card">
        <h1>隐私</h1>
        <template v-if="isLoggedIn">
          <OwnerPreferences key="privacy" resource="privacy" title="隐私设置" />
          <OwnerPreferences key="location" resource="location" title="地理位置公开设置" />
        </template>
      </section>

      <section v-if="tab === 'profession'" class="card">
        <h1>职业成长</h1>
        <template v-if="isLoggedIn">
          <OwnerProfessions />
        </template>
      </section>

      <section v-if="tab === 'point'" class="card">
        <header class="mod-head">
          <h1>积分转账</h1>
          <RouterLink to="/points">流水</RouterLink>
        </header>
        <template v-if="isLoggedIn">
          <PointTransfer :initial-recipient="typeof route.query.to === 'string' ? route.query.to : ''" />
        </template>
      </section>

      <section v-if="tab === 'invite'" class="card">
        <h1>邀请</h1><OwnerInvitations v-if="isLoggedIn" />
      </section>

      <section v-if="tab === 'identity'" class="card">
        <h1>官方身份认证</h1>
        <OwnerIdentityApplication v-if="isLoggedIn" />
      </section>

      <section v-if="tab === 'data'" class="card">
        <h1>数据导出</h1>
        <nav v-if="isLoggedIn && account" aria-label="本人匿名创作入口"><RouterLink :to="`/member/${encodeURIComponent(account.userName)}/articles/anonymous`">本人匿名文章</RouterLink> · <RouterLink :to="`/member/${encodeURIComponent(account.userName)}/comments/anonymous`">本人匿名评论</RouterLink></nav>
        <OwnerPostExport v-if="isLoggedIn" />
      </section>

      <section v-if="tab === 'i18n'" class="card">
        <h1>语言与时区</h1>
        <OwnerPreferences v-if="isLoggedIn" key="locale" resource="locale" title="语言与时区" />
      </section>

      <section v-if="tab === 'help'" class="card">
        <h1>使用指南</h1>
        <ul class="help-list">
          <li v-for="item in helpLinks" :key="item.to">
            <RouterLink :to="item.to">{{ item.title }}</RouterLink>
            <span>{{ item.tip }}</span>
          </li>
        </ul>
      </section>
    </div>

    <aside class="set-side">
      <button
        type="button"
        class="set-toggle"
        :aria-expanded="settingsMenuOpen"
        @click="settingsMenuOpen = !settingsMenuOpen"
      >
        <span>{{ currentTabLabel }}</span>
        <span class="chevron" :class="{ open: settingsMenuOpen }">▾</span>
      </button>
      <nav class="set-menu" :class="{ open: settingsMenuOpen }">
        <RouterLink
          v-for="item in tabs"
          :key="item.id"
          :to="item.to"
          :class="{ current: tab === item.id }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>
  </div>
</template>

<style scoped lang="scss">
.page {
  display: grid;
  /* 与现网 settings 一致：内容在左、菜单在右 */
  grid-template-columns: minmax(0, 1fr) 200px;
  gap: 16px;
  align-items: start;
  max-width: 960px;
  margin: 0 auto;
}
.set-side {
  position: sticky;
  top: calc(var(--fp-nav-h) + 12px);
}
.set-toggle {
  display: none;
}
.set-menu {
  display: flex;
  flex-direction: column;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  box-shadow: var(--fp-card-shadow);
  border-radius: var(--fp-radius-lg, 10px);
  overflow: hidden;
}
.set-menu a {
  padding: 10px 14px;
  color: var(--fp-text);
  text-decoration: none;
  font-size: 14px;
  border-left: 3px solid transparent;
  transition: background-color 0.16s ease, color 0.16s ease;
}
.set-menu a:hover {
  background: var(--fp-hover);
}
.set-menu a.current {
  color: var(--fp-primary);
  border-left-color: var(--fp-primary);
  font-weight: 600;
  background: var(--fp-hover);
}
.set-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  box-shadow: var(--fp-card-shadow);
  border-radius: var(--fp-radius-lg, 10px);
  padding: 20px 22px;
}
.mod-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}
.mod-head a {
  color: var(--fp-link);
  text-decoration: none;
}
h1 {
  margin: 0 0 12px;
  font-size: 18px;
  color: var(--fp-title);
}
h2 {
  margin: 18px 0 8px;
  font-size: 15px;
  color: var(--fp-title);
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.form,
.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--fp-muted);
  font-size: 13px;
}
input:not([type='checkbox']):not([type='radio']):not([type='file']),
textarea,
select {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: var(--fp-radius-md, 8px);
  padding: 8px 12px;
  outline: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}
input:not([type='checkbox']):not([type='radio']):not([type='file']):hover,
textarea:hover,
select:hover {
  border-color: var(--fp-border-strong, var(--fp-border));
}
input:not([type='checkbox']):not([type='radio']):not([type='file']):focus,
textarea:focus,
select:focus {
  border-color: var(--fp-primary);
  box-shadow: var(--fp-focus-ring);
}
input[readonly] {
  opacity: 0.75;
}
.checks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.check {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-radius-md, 8px);
  background: var(--fp-bg);
  color: var(--fp-text);
  cursor: pointer;
  transition: border-color 0.16s ease, background-color 0.16s ease;
}
.check:hover {
  border-color: var(--fp-border-strong, var(--fp-border));
  background: var(--fp-hover);
}
.avatar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.fp-avatar {
  width: 72px;
  height: 72px;
}
.file {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-radius-sm, 6px);
  padding: 6px 14px;
  cursor: pointer;
  font-size: 13px;
  color: var(--fp-text);
  transition: border-color 0.16s ease, background-color 0.16s ease;
}
.file:hover {
  border-color: var(--fp-primary);
  background: var(--fp-hover);
}
.file input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.primary {
  align-self: flex-end;
  border: 1px solid var(--fp-primary);
  background: var(--fp-primary);
  color: #fff;
  border-radius: var(--fp-radius-sm, 6px);
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}
.primary:hover:not(:disabled) {
  background: var(--fp-primary-hover, var(--fp-primary));
  border-color: var(--fp-primary-hover, var(--fp-primary));
  box-shadow: 0 4px 12px color-mix(in srgb, var(--fp-primary) 28%, transparent);
}
.primary:disabled,
.ghost-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.primary.danger {
  background: var(--fp-danger, #d9534f);
  border-color: var(--fp-danger, #d9534f);
}
.primary.danger:hover:not(:disabled) {
  background: var(--fp-danger-hover, #c6433f);
  border-color: var(--fp-danger-hover, #c6433f);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--fp-danger) 28%, transparent);
}
.ghost-btn {
  align-self: flex-end;
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-text);
  border-radius: var(--fp-radius-sm, 6px);
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}
.ghost-btn:hover:not(:disabled) {
  background: var(--fp-hover);
  border-color: var(--fp-border-strong, var(--fp-border));
  color: var(--fp-title);
}
.captcha {
  min-height: 44px;
}
.mfa-qr {
  width: 180px;
  height: 180px;
  object-fit: contain;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: #fff;
}
.bag-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.help-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.help-list li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 0;
  border-bottom: 1px solid var(--fp-border);
}
.help-list a {
  color: var(--fp-link);
  text-decoration: none;
  font-size: 15px;
}
.help-list span {
  font-size: 12px;
  color: var(--fp-muted);
}
.ok {
  color: var(--fp-primary);
  font-size: 13px;
}
.err {
  color: #e07a5f;
  font-size: 13px;
}

@media (max-width: 800px) {
  .page {
    grid-template-columns: 1fr;
  }
  .set-side {
    position: static;
    order: -1;
  }
  .set-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 12px 14px;
    border: 0;
    border-radius: 8px;
    background: var(--fp-card);
    box-shadow: var(--fp-card-shadow);
    color: var(--fp-title);
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }
  .chevron {
    color: var(--fp-muted);
    transition: transform 0.15s ease;
  }
  .chevron.open {
    transform: rotate(180deg);
  }
  .set-menu {
    display: none;
    margin-top: 8px;
  }
  .set-menu.open {
    display: flex;
  }
  .set-menu a {
    border-left: 0;
    border-bottom: 1px solid var(--fp-border);
  }
  .set-menu a:last-child {
    border-bottom: 0;
  }
  .set-menu a.current {
    border-left-color: transparent;
  }
  .checks {
    grid-template-columns: 1fr;
  }
}
</style>
