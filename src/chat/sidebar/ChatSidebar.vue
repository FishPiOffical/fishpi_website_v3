<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { sidebarModule } from './registry'
import SidebarLayout from '@/components/sidebar/SidebarLayout.vue'
import { useChatSidebarStore } from '@/stores/chatSidebar'

const sidebar = useChatSidebarStore()
const { visibleModules, pref } = storeToRefs(sidebar)
</script>

<template>
  <SidebarLayout
    class="chat-sidebar"
    :modules="visibleModules"
    section="chatSidebar"
    ariaLabel="聊天室侧栏"
    :presentation-of="sidebar.presentationOf"
    :is-collapsed="(id) => pref.collapsed.includes(id)"
    @toggle="sidebar.toggleCollapsed"
  >
    <template #default="{ module, onSummary }">
      <component :is="sidebarModule(module.id)?.component" @summary="onSummary" />
    </template>
  </SidebarLayout>
</template>
