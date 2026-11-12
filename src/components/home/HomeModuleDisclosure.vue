<script setup lang="ts">
import { ref, useId } from 'vue'
import { storeToRefs } from 'pinia'
import SidebarModuleHeader from '@/components/sidebar/SidebarModuleHeader.vue'
import { useHomeLayoutStore } from '@/stores/homeLayout'
import type { ChatSidebarModuleId } from '@/chat/sidebar/meta'

defineProps<{
  moduleKey: string
  moduleId: ChatSidebarModuleId | 'checkin'
  title: string
}>()

const layout = useHomeLayoutStore()
const { collapsed, editing } = storeToRefs(layout)
const summary = ref<string>()
const panelId = useId()

function reportSummary(text: string) {
  summary.value = text
}
</script>

<template>
  <div class="home-disclosure">
    <div class="disclosure-head">
      <SidebarModuleHeader
        :module-id="moduleId"
        :title="title"
        :expanded="!collapsed.includes(moduleKey)"
        :controls="panelId"
        :summary="summary"
        :disabled="editing"
        @toggle="layout.toggleCollapsed(moduleKey)"
      />
      <slot name="action" />
    </div>
    <div :id="panelId" v-show="!collapsed.includes(moduleKey)" class="disclosure-body">
      <slot :report-summary="reportSummary" />
    </div>
  </div>
</template>

<style scoped>
.home-disclosure { min-width: 0; }
.disclosure-head { display: flex; align-items: center; gap: 6px; }
</style>
