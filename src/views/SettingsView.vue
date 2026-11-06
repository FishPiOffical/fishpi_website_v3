<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppearancePicker from '@/components/packs/AppearancePicker.vue'
import EmojiPacks from '@/components/EmojiPacks.vue'
import OwnerProfileSettings from '@/components/settings/OwnerProfileSettings.vue'
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
const descriptions:Record<string,string> = {
  profile:'介绍一下自己，让大家更好地认识你。',avatar:'选择一个让人记住你的头像。',system:'让摸鱼派更合你的心意。',account:'管理账号、安全验证与社区身份。',function:'调整常用功能，找到适合你的使用方式。',point:'管理积分转账，查看每一笔收支。',invite:'邀请朋友，一起加入摸鱼派。',identity:'提交认证材料，查看申请进展。',data:'管理个人内容导出与游戏云存档。',i18n:'选择语言、时区与地区偏好。',privacy:'决定哪些信息可以公开展示。',profession:'探索职业成长与展示方式。',help:'找到常用功能的使用方法。',
}
const menuGroups = [
  {label:'个人与外观',ids:['profile','avatar','system']},
  {label:'社区与偏好',ids:['function','privacy','profession','i18n']},
  {label:'账号与服务',ids:['account','point','invite','identity','data','help']},
].map(group=>({...group,items:group.ids.map(id=>tabs.find(item=>item.id===id)!)}))
const currentTabLabel = computed(() => tabs.find((t) => t.id === tab.value)?.label || '资料')

watch(
  () => route.fullPath,
  () => {
    settingsMenuOpen.value = false
  },
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
  <div class="page fp-page fp-page--wide fp-ui fp-settings">
    <header class="settings-page-head"><div><span class="settings-eyebrow">个人设置</span><h1>{{ currentTabLabel }}</h1><p>{{ descriptions[tab] }}</p></div><RouterLink v-if="isLoggedIn && account?.userName && tab==='profile'" :to="`/member/${encodeURIComponent(account.userName)}`">查看主页 ↗</RouterLink><RouterLink v-if="tab==='point'" to="/points">积分流水 ↗</RouterLink></header>
    <div class="set-main">
      <p v-if="!isLoggedIn" class="card hint fp-card login-notice">
        <span><RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>后可修改设置。游客仍可调整本机主题外观。</span>
      </p>

      <section v-if="tab === 'profile'" class="card fp-card">
        <OwnerProfileSettings v-if="isLoggedIn" key="profile" mode="profile" />
      </section>

      <section v-if="tab === 'system'" class="card fp-card">

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

      <section v-if="tab === 'avatar'" class="card fp-card">

        <OwnerProfileSettings v-if="isLoggedIn" key="avatar" mode="avatar" />
      </section>

      <section v-if="tab === 'account'" class="card fp-card">

        <template v-if="isLoggedIn">
          <OwnerInventory />

          <OwnerMedals />

          <OwnerSecurity />

          <OwnerAppLogin />

        </template>
      </section>

      <section v-if="tab === 'function'" class="card fp-card">

        <template v-if="isLoggedIn">
          <OwnerPreferences key="functions" resource="functions" title="功能设置" />
          <OwnerPreferences key="display-modes" resource="display" title="显示设置" :fields="['commentViewMode', 'avatarViewMode']" />
          <h2>表情包</h2>
          <EmojiPacks />
        </template>
      </section>

      <section v-if="tab === 'privacy'" class="card fp-card">

        <template v-if="isLoggedIn">
          <OwnerPreferences key="privacy" resource="privacy" title="隐私设置" />
          <OwnerPreferences key="location" resource="location" title="地理位置公开设置" />
        </template>
      </section>

      <section v-if="tab === 'profession'" class="card fp-card">

        <template v-if="isLoggedIn">
          <OwnerProfessions />
        </template>
      </section>

      <section v-if="tab === 'point'" class="card fp-card">
        <template v-if="isLoggedIn">
          <PointTransfer :initial-recipient="typeof route.query.to === 'string' ? route.query.to : ''" />
        </template>
      </section>

      <section v-if="tab === 'invite'" class="card fp-card">
<OwnerInvitations v-if="isLoggedIn" />
      </section>

      <section v-if="tab === 'identity'" class="card fp-card">

        <OwnerIdentityApplication v-if="isLoggedIn" />
      </section>

      <section v-if="tab === 'data'" class="card fp-card">

        <nav v-if="isLoggedIn && account" aria-label="本人匿名创作入口"><RouterLink :to="`/member/${encodeURIComponent(account.userName)}/articles/anonymous`">本人匿名文章</RouterLink> · <RouterLink :to="`/member/${encodeURIComponent(account.userName)}/comments/anonymous`">本人匿名评论</RouterLink></nav>
        <OwnerPostExport v-if="isLoggedIn" />
        <OwnerGameSaves v-if="isLoggedIn" />
      </section>

      <section v-if="tab === 'i18n'" class="card fp-card">

        <OwnerPreferences v-if="isLoggedIn" key="locale" resource="locale" title="语言与时区" />
      </section>

      <section v-if="tab === 'help'" class="card fp-card">

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
        class="set-toggle fp-control"
        :aria-expanded="settingsMenuOpen"
        @click="settingsMenuOpen = !settingsMenuOpen"
      >
        <span>{{ currentTabLabel }}</span>
        <span class="chevron" :class="{ open: settingsMenuOpen }">▾</span>
      </button>
      <nav class="set-menu" :class="{ open: settingsMenuOpen }" aria-label="设置分类">
        <div v-for="group in menuGroups" :key="group.label" class="menu-group"><h2>{{ group.label }}</h2><RouterLink v-for="item in group.items" :key="item.id" :to="item.to" :class="{ current: tab === item.id }" :aria-current="tab===item.id?'page':undefined"><span>{{ item.label }}</span><span class="menu-arrow" aria-hidden="true">›</span></RouterLink></div>
      </nav>
    </aside>
  </div>
</template>

<style scoped>
.page{display:grid;grid-template-columns:minmax(0,1fr) 200px;gap:20px;align-items:start}.settings-page-head{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;gap:20px;padding:4px 2px 8px}.settings-eyebrow{font-size:11px;letter-spacing:2px;color:var(--fp-muted)}.settings-page-head h1{font-size:26px;color:var(--fp-title);line-height:1.4;margin:6px 0 7px;font-weight:650}.settings-page-head p{font-size:13px;color:var(--fp-muted);margin:0;line-height:1.7}.settings-page-head>a{font-size:12px;color:var(--fp-muted);text-decoration:none}.settings-page-head>a:hover{text-decoration:underline;text-underline-offset:3px}.set-main{display:flex;flex-direction:column;gap:16px;min-width:0}.card{background:var(--fp-card);border:1px solid var(--fp-border);box-shadow:var(--fp-card-shadow);border-radius:var(--fp-panel-radius,10px);padding:24px;min-width:0}.card>.hint{color:var(--fp-muted);font-size:12px;line-height:1.8;margin:0 0 18px}.login-notice{font-size:13px;color:var(--fp-muted);padding:16px 20px}.set-side{position:sticky;top:calc(var(--fp-nav-h) + 14px)}.set-toggle{display:none}.set-menu{display:flex;flex-direction:column;gap:18px;padding:16px 10px;background:var(--fp-card);border:1px solid var(--fp-border);border-radius:var(--fp-panel-radius,10px)}.menu-group{display:flex;flex-direction:column;gap:3px}.menu-group h2{font-size:11px;font-weight:500;color:var(--fp-muted);margin:0 12px 6px}.set-menu a{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;border-radius:7px;color:var(--fp-text);text-decoration:none;font-size:13px;transition:background-color .16s}.set-menu a:hover{background:var(--fp-hover);text-decoration:underline;text-underline-offset:3px}.set-menu a.current{color:var(--fp-primary);font-weight:600;background:var(--fp-primary-soft)}.menu-arrow{color:var(--fp-muted);opacity:.5}.set-menu a.current .menu-arrow{color:inherit;opacity:1}.help-list{list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:0;margin:0}.help-list li{padding:18px;border:1px solid var(--fp-border);border-radius:10px;display:flex;flex-direction:column;gap:6px}.help-list a{font-size:14px;color:var(--fp-title);font-weight:600}.help-list span{font-size:12px;color:var(--fp-muted)}.chevron{transition:transform .16s}.chevron.open{transform:rotate(180deg)}a:focus-visible,button:focus-visible{outline:2px solid var(--fp-primary);outline-offset:3px}
@media(max-width:800px){.page{grid-template-columns:minmax(0,1fr);gap:14px}.settings-page-head{grid-row:1}.settings-page-head h1{font-size:23px}.set-side{grid-row:2;position:static}.set-main{grid-row:3}.set-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:12px 16px;border:1px solid var(--fp-border);border-radius:10px;background:var(--fp-card);color:var(--fp-title);font:inherit;font-size:13px}.set-menu{display:none;margin-top:8px}.set-menu.open{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 10px}.card{padding:18px}.settings-page-head{gap:12px}.help-list{grid-template-columns:minmax(0,1fr)}}
@media(prefers-reduced-motion:reduce){.set-menu a,.chevron{transition:none}}
</style>
<style src="../styles/settings.css"></style>
