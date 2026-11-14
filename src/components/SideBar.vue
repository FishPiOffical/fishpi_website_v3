<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { usePageSidebarStore } from '@/stores/pageSidebar'
import ClientDownloadCard from '@/components/sidebar/ClientDownloadCard.vue'
import CheckinPanel from '@/components/home/CheckinPanel.vue'
import PersonInfoCard from '@/components/sidebar/PersonInfoCard.vue'
import BreezemoonFeed from '@/components/sidebar/BreezemoonFeed.vue'
import SidebarTabs from '@/components/sidebar/SidebarTabs.vue'
import IncomeModule from '@/chat/sidebar/modules/IncomeModule.vue'
import AppearanceModule from '@/chat/sidebar/modules/AppearanceModule.vue'
import AdModule from '@/chat/sidebar/modules/AdModule.vue'

const { isLoggedIn } = storeToRefs(useAuthStore())
const pageSidebar = usePageSidebarStore()
const { visibleModules } = storeToRefs(pageSidebar)
</script>

<template>
  <aside class="sidebar-wrapper" aria-label="内页侧边栏">
    <SidebarTabs :modules="visibleModules" section="pageSidebar" ariaLabel="内页侧栏模块">
      <template #header-actions="{ module: mod }">
        <RouterLink v-if="mod.id === 'breezemoons'" to="/breezemoons" class="more-link">更多</RouterLink>
      </template>
      <template #default="{ module: mod }">
        <div
          class="side-tab-module"
          :class="{ 'tool-module': ['profile', 'income', 'checkin'].includes(mod.id), 'tool-module--profile': mod.id === 'profile', 'tool-module--income': mod.id === 'income', 'tool-module--checkin': mod.id === 'checkin' }"
        >
          <div class="side-module-body">
            <PersonInfoCard v-if="mod.id === 'profile'" />
            <template v-else-if="mod.id === 'checkin'">
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
  </aside>
</template>

<style scoped>
.sidebar-wrapper,
.side-tab-module {
  width: 100%;
  min-width: 0;
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
