<script setup lang="ts">
import { onMounted, ref, useId } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { usePageSidebarStore, type PageSidebarModuleId } from '@/stores/pageSidebar'
import { useSettingsDrawerStore } from '@/stores/settingsDrawer'
import CheckinPanel from '@/components/home/CheckinPanel.vue'
import PersonInfoCard from '@/components/sidebar/PersonInfoCard.vue'
import BreezemoonFeed from '@/components/sidebar/BreezemoonFeed.vue'
import IncomeModule from '@/chat/sidebar/modules/IncomeModule.vue'
import AppearanceModule from '@/chat/sidebar/modules/AppearanceModule.vue'
import BarrageModule from '@/chat/sidebar/modules/BarrageModule.vue'
import AdModule from '@/chat/sidebar/modules/AdModule.vue'

const router = useRouter()
const { isLoggedIn } = storeToRefs(useAuthStore())
const pageSidebar = usePageSidebarStore()
const { visibleModules } = storeToRefs(pageSidebar)
const drawer = useSettingsDrawerStore()
const uid = useId()
// Identity and locally saved module layout are browser state, unavailable to public SSR.
const ready = ref(false)
onMounted(() => { ready.value = true })

const ICONS: Record<PageSidebarModuleId, string> = {
  profile: '👤',
  checkin: '📅',
  download: '📱',
  breezemoons: '🌙',
  income: '🕒',
  appearance: '🎨',
  barrage: '💬',
  ad: '✨',
}

function goDownload() {
  void router.push('/download')
}
</script>

<template>
  <aside class="sidebar-wrapper" aria-label="内页侧边栏">
    <header class="sidebar-toolbar">
      <span class="toolbar-title">社区侧栏</span>
      <button type="button" class="configure-btn" @click="drawer.show('pageSidebar')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          />
          <path
            d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
          />
        </svg>
        配置模块
      </button>
    </header>

    <p v-if="!ready" class="empty-side" role="status">正在加载侧栏…</p>
    <template v-else>
      <template v-for="mod in visibleModules" :key="mod.id">
        <section
          v-if="mod.id !== 'checkin' || isLoggedIn"
          class="module side-module-card"
          :class="{ 'is-collapsed': pageSidebar.isCollapsed(mod.id) }"
        >
          <header class="module-header side-module-head">
            <button
              type="button"
              class="head-toggle"
              :aria-expanded="!pageSidebar.isCollapsed(mod.id)"
              :aria-controls="`${uid}-${mod.id}`"
              @click="pageSidebar.toggleCollapsed(mod.id)"
            >
              <span class="mod-ico" aria-hidden="true">{{ ICONS[mod.id] }}</span>
              <h2>{{ mod.title }}</h2>
              <span class="chevron" aria-hidden="true">▾</span>
            </button>
            <RouterLink v-if="mod.id === 'breezemoons'" to="/breezemoons" class="more-link">更多</RouterLink>
          </header>

          <div
            :id="`${uid}-${mod.id}`"
            v-show="!pageSidebar.isCollapsed(mod.id)"
            class="module-panel side-module-body"
          >
            <PersonInfoCard v-if="mod.id === 'profile'" />
            <CheckinPanel v-else-if="mod.id === 'checkin'" class="embedded-checkin" />
            <div v-else-if="mod.id === 'download'" class="app-download">
              <div class="app-left">
                <img src="https://file.fishpi.cn/logo_app.png" width="36" height="36" alt="摸鱼派客户端" />
                <div class="app-text">
                  <b>随时随地摸鱼？</b>
                  <p>下载摸鱼派客户端，想摸就摸！</p>
                </div>
              </div>
              <button type="button" class="btn green small" @click="goDownload">下载</button>
            </div>
            <BreezemoonFeed v-else-if="mod.id === 'breezemoons'" />
            <IncomeModule v-else-if="mod.id === 'income'" />
            <AppearanceModule v-else-if="mod.id === 'appearance'" />
            <BarrageModule v-else-if="mod.id === 'barrage'" />
            <AdModule v-else-if="mod.id === 'ad'" />
          </div>
        </section>
      </template>

      <p v-if="!visibleModules.length" class="empty-side">
        暂未开启内页侧栏模块，点击上方
        <button type="button" class="link-btn" @click="drawer.show('pageSidebar')">配置模块</button>
        开启。
      </p>
    </template>
  </aside>
</template>

<style scoped>
.sidebar-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
  min-height: 24px;
}

.toolbar-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--fp-muted);
}

.configure-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: var(--fp-radius-sm, 6px);
  background: transparent;
  color: var(--fp-muted);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease;
}

.configure-btn svg {
  width: 13px;
  height: 13px;
}

.configure-btn:hover {
  background: var(--fp-hover);
  border-color: var(--fp-border);
  color: var(--fp-title);
}

.side-module-card {
  margin-bottom: 0;
  overflow: hidden;
}

.side-module-head {
  padding: 0 12px 0 0;
  gap: 8px;
}

.side-module-card.is-collapsed .side-module-head {
  border-bottom-color: transparent;
}

.head-toggle {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 12px 11px 14px;
  border: 0;
  background: transparent;
  color: var(--fp-head);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: color 0.16s ease, background-color 0.16s ease;
}

.head-toggle:hover {
  color: var(--fp-title);
  background: var(--fp-hover);
}

.head-toggle h2 {
  font-size: 13px;
  font-weight: 600;
  color: var(--fp-title);
  margin: 0;
}

.mod-ico {
  font-size: 13px;
  line-height: 1;
}

.chevron {
  margin-left: auto;
  font-size: 12px;
  color: var(--fp-muted);
  transition: transform 0.16s ease;
}

.head-toggle[aria-expanded='false'] .chevron {
  transform: rotate(-90deg);
}

.more-link {
  flex: none;
  font-size: 12px;
  color: var(--fp-muted);
  text-decoration: none;
  padding: 2px 4px;
  border-radius: 4px;
}

.more-link:hover {
  color: var(--fp-link);
  background: var(--fp-hover);
  text-decoration: none;
}

.side-module-body {
  padding: 12px 14px;
}

.embedded-checkin {
  margin-bottom: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
}

.app-download {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.app-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.app-left img {
  border-radius: 8px;
  flex-shrink: 0;
}

.app-text b {
  display: block;
  font-size: 13px;
  color: var(--fp-title);
}

.app-text p {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--fp-muted);
}

.empty-side {
  margin: 0;
  padding: 16px;
  border: 1px dashed var(--fp-border);
  border-radius: var(--fp-radius-lg, 10px);
  color: var(--fp-muted);
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}

.link-btn {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--fp-link);
  font: inherit;
  cursor: pointer;
}

.link-btn:hover {
  text-decoration: underline;
}
</style>
