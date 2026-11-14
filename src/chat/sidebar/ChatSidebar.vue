<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { sidebarModule } from './registry'
import SidebarTabs from '@/components/sidebar/SidebarTabs.vue'
import { useChatSidebarStore } from '@/stores/chatSidebar'

const sidebar = useChatSidebarStore()
const { visibleModules } = storeToRefs(sidebar)
</script>

<template>
  <aside class="chat-sidebar" aria-label="聊天室侧栏">
    <SidebarTabs :modules="visibleModules" section="chatSidebar" ariaLabel="聊天室侧栏模块">
      <template #default="{ module: mod }">
        <div class="chat-tab-module" :class="{ 'tool-module': ['profile', 'income', 'activity'].includes(mod.id), 'tool-module--profile': mod.id === 'profile', 'tool-module--income': mod.id === 'income', 'tool-module--checkin': mod.id === 'activity' }">
          <div class="card-body">
            <component :is="sidebarModule(mod.id)?.component" />
          </div>
        </div>
      </template>
    </SidebarTabs>
  </aside>
</template>

<style scoped>
.chat-sidebar, .chat-tab-module { width: 100%; min-width: 0; }
.card-body { padding: 14px 16px; font-size: 12px; line-height: 1.6; }
</style>

<style scoped src="../../components/sidebar/tool-module.css"></style>
