<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, useId } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion, onAccessTokenChange } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { usePageSidebarStore } from '@/stores/pageSidebar'
import ClientDownloadCard from '@/components/sidebar/ClientDownloadCard.vue'
import CheckinPanel from '@/components/home/CheckinPanel.vue'
import PersonInfoCard from '@/components/sidebar/PersonInfoCard.vue'
import BreezemoonFeed from '@/components/sidebar/BreezemoonFeed.vue'
import SidebarConfigureButton from '@/components/sidebar/SidebarConfigureButton.vue'
import SidebarModuleHeader from '@/components/sidebar/SidebarModuleHeader.vue'
import SidebarTabs from '@/components/sidebar/SidebarTabs.vue'
import IncomeModule from '@/chat/sidebar/modules/IncomeModule.vue'
import AppearanceModule from '@/chat/sidebar/modules/AppearanceModule.vue'
import AdModule from '@/chat/sidebar/modules/AdModule.vue'

const { isLoggedIn, account } = storeToRefs(useAuthStore())
const pageSidebar = usePageSidebarStore()
const { visibleModules } = storeToRefs(pageSidebar)
const profileModule = computed(() => visibleModules.value.find(mod => mod.id === 'profile'))
const tabModules = computed(() => visibleModules.value.filter(mod => mod.id !== 'profile'))
const uid = useId()
const ready = ref(false)
const authVersion = ref(getAuthContextVersion())
const unsubscribe = onAccessTokenChange(() => { authVersion.value = getAuthContextVersion() })
onScopeDispose(unsubscribe)
const identity = computed(() => `${authVersion.value}:${isLoggedIn.value ? account.value?.oId : 'guest'}`)
// 身份和本机布局只在挂载后显示，保持公共 SSR 与客户端首帧一致。
onMounted(() => { ready.value = true })
</script>

<template>
  <aside class="sidebar-wrapper" aria-label="内页侧边栏">
    <p v-if="!ready" class="empty-side" role="status">正在加载侧栏…</p>
    <template v-else>
      <section
        v-if="profileModule"
        :key="identity"
        class="module side-module-card tool-module tool-module--profile"
        :class="{ 'is-collapsed': pageSidebar.isCollapsed('profile') }"
      >
        <header class="module-header side-module-head">
          <SidebarModuleHeader
            module-id="profile"
            :title="profileModule.title"
            :expanded="!pageSidebar.isCollapsed('profile')"
            :controls="`${uid}-profile`"
            heading="h2"
            @toggle="pageSidebar.toggleCollapsed('profile')"
          />
          <SidebarConfigureButton section="pageSidebar" />
        </header>
        <div :id="`${uid}-profile`" v-show="!pageSidebar.isCollapsed('profile')" class="module-panel side-module-body">
          <PersonInfoCard />
        </div>
      </section>
      <SidebarTabs
        v-if="tabModules.length || !profileModule"
        :modules="tabModules"
        :show-configure="!profileModule"
        section="pageSidebar"
        ariaLabel="内页侧栏模块"
      >
        <template #header-actions="{ module: mod }">
          <RouterLink v-if="mod.id === 'breezemoons'" to="/breezemoons" class="more-link">更多</RouterLink>
        </template>
        <template #default="{ module: mod }">
          <div
            class="side-tab-module"
            :class="{ 'tool-module': ['income', 'checkin'].includes(mod.id), 'tool-module--income': mod.id === 'income', 'tool-module--checkin': mod.id === 'checkin' }"
          >
            <div class="side-module-body">
              <template v-if="mod.id === 'checkin'">
                <CheckinPanel v-if="isLoggedIn" dashboard class="embedded-checkin" />
                <p v-else class="guest-hint">登录后查看今日活跃情况</p>
              </template>
              <ClientDownloadCard v-else-if="mod.id === 'download'" />
              <BreezemoonFeed v-else-if="mod.id === 'breezemoons'" />
              <IncomeModule v-else-if="mod.id === 'income'" />
              <AppearanceModule v-else-if="mod.id === 'appearance'" />
              <AdModule v-else-if="mod.id === 'ad'" />
            </div>
          </div>
        </template>
      </SidebarTabs>
    </template>
  </aside>
</template>

<style scoped>
.sidebar-wrapper,
.side-tab-module {
  width: 100%;
  min-width: 0;
}

.sidebar-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.side-module-card {
  margin-bottom: 0;
  border-radius: var(--fp-panel-radius, 10px);
  box-shadow: var(--fp-card-shadow);
  overflow: hidden;
}

.side-module-head {
  padding: 0;
  gap: 0;
}

.side-module-card.is-collapsed .side-module-head {
  border-bottom-color: transparent;
}

.side-module-card > .side-module-body {
  padding: 10px 12px;
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
  padding: 14px 16px;
}

.guest-hint {
  margin: 0;
  padding-block: 14px;
  color: var(--fp-muted);
  font-size: 12px;
}

.embedded-checkin {
  margin-bottom: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
}

.embedded-checkin :deep(.checkin-head h3) {
  display: none;
}

.embedded-checkin :deep(.checkin-head) {
  justify-content: flex-end;
  margin-bottom: 2px;
}

</style>

<style scoped src="./sidebar/tool-module.css"></style>
