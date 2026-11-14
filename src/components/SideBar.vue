<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { usePageSidebarStore, type PageSidebarModuleId } from '@/stores/pageSidebar'
import ClientDownloadCard from '@/components/sidebar/ClientDownloadCard.vue'
import CheckinPanel from '@/components/home/CheckinPanel.vue'
import PersonInfoCard from '@/components/sidebar/PersonInfoCard.vue'
import BreezemoonFeed from '@/components/sidebar/BreezemoonFeed.vue'
import SidebarLayout from '@/components/sidebar/SidebarLayout.vue'
import IncomeModule from '@/chat/sidebar/modules/IncomeModule.vue'
import AppearanceModule from '@/chat/sidebar/modules/AppearanceModule.vue'
import AdModule from '@/chat/sidebar/modules/AdModule.vue'

const { isLoggedIn } = storeToRefs(useAuthStore())
const pageSidebar = usePageSidebarStore()
const { visibleModules, pref } = storeToRefs(pageSidebar)
</script>

<template>
  <SidebarLayout
    class="sidebar-wrapper"
    :modules="visibleModules"
    section="pageSidebar"
    ariaLabel="内页侧边栏"
    :presentation-of="pageSidebar.presentationOf"
    :is-collapsed="(id) => pref.collapsed.includes(id as PageSidebarModuleId)"
    @toggle="pageSidebar.toggleCollapsed($event as PageSidebarModuleId)"
  >
    <template #header-actions="{ module }">
      <RouterLink v-if="module.id === 'breezemoons'" to="/breezemoons" class="more-link">更多</RouterLink>
    </template>
    <template #default="{ module, onSummary }">
      <PersonInfoCard v-if="module.id === 'profile'" />
      <template v-else-if="module.id === 'checkin'">
        <CheckinPanel v-if="isLoggedIn" dashboard class="embedded-checkin" @summary="onSummary" />
        <p v-else class="guest-hint">登录后查看今日活跃情况</p>
      </template>
      <ClientDownloadCard v-else-if="module.id === 'download'" />
      <BreezemoonFeed v-else-if="module.id === 'breezemoons'" @summary="onSummary" />
      <IncomeModule v-else-if="module.id === 'income'" />
      <AppearanceModule v-else-if="module.id === 'appearance'" />
      <AdModule v-else-if="module.id === 'ad'" />
    </template>
  </SidebarLayout>
</template>

<style scoped>
.more-link { flex: none; font-size: 12px; color: var(--fp-muted); padding: 2px 4px; }
.guest-hint { margin: 0; padding-block: 14px; color: var(--fp-muted); font-size: 12px; }
.embedded-checkin { margin-bottom: 0 !important; padding: 0 !important; border: 0 !important; background: transparent !important; }
.embedded-checkin :deep(.checkin-head h3) { display: none; }
.embedded-checkin :deep(.checkin-head) { justify-content: flex-end; margin-bottom: 2px; }
</style>
