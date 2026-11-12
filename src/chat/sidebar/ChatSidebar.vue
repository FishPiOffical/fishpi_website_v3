<script setup lang="ts">
import { ref, useId } from 'vue'
import { storeToRefs } from 'pinia'
import { sidebarModule } from './registry'
import SidebarConfigureButton from '@/components/sidebar/SidebarConfigureButton.vue'
import SidebarModuleHeader from '@/components/sidebar/SidebarModuleHeader.vue'
import { useChatSidebarStore } from '@/stores/chatSidebar'
import type { ChatSidebarModuleId } from './meta'

const sidebar = useChatSidebarStore()
const { visibleModules, pref } = storeToRefs(sidebar)
const summaries = ref<Partial<Record<ChatSidebarModuleId, string>>>({})
const id = useId()
</script>

<template>
  <aside class="chat-sidebar" aria-label="聊天室侧栏">
    <section v-for="(mod, index) in visibleModules" :key="mod.id" class="card">
      <header class="card-header">
        <SidebarModuleHeader
          :module-id="mod.id"
          :title="mod.title"
          :expanded="!pref.collapsed.includes(mod.id)"
          :controls="`${id}-${mod.id}`"
          :summary="summaries[mod.id]"
          @toggle="sidebar.toggleCollapsed(mod.id)"
        />
        <SidebarConfigureButton v-if="index === 0" section="chatSidebar" />
      </header>
      <div :id="`${id}-${mod.id}`" v-show="!pref.collapsed.includes(mod.id)" class="card-body">
        <component :is="sidebarModule(mod.id)?.component" @summary="summaries[mod.id] = $event" />
      </div>
    </section>
    <div v-if="!visibleModules.length" class="card-header empty">
      <span>暂未开启模块</span>
      <SidebarConfigureButton section="chatSidebar" />
    </div>
  </aside>
</template>

<style scoped>
.chat-sidebar { display: flex; flex-direction: column; gap: 10px; width: 100%; min-width: 0; }
.card-header { display: flex; align-items: center; }
.card { min-width: 0; border: 1px solid var(--fp-border); background: var(--fp-card); box-shadow: var(--fp-card-shadow); border-radius: 8px; }
.card-body { padding: 0 14px 14px; font-size: 12px; line-height: 1.6; }
.empty { justify-content: space-between; min-height: 46px; padding-inline-start: 14px; border: 1px dashed var(--fp-border); border-radius: 8px; color: var(--fp-muted); font-size: 12px; }
</style>
