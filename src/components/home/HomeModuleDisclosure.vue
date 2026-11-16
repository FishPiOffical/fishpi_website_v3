<script setup lang="ts">
import { ref, useId } from 'vue'
import { storeToRefs } from 'pinia'
import SidebarIcon from '@/chat/sidebar/SidebarIcon.vue'
import SidebarModuleHeader from '@/components/sidebar/SidebarModuleHeader.vue'
import { useHomeLayoutStore } from '@/stores/homeLayout'
import type { ChatSidebarModuleId } from '@/chat/sidebar/meta'

defineProps<{
  moduleKey: string
  moduleId: ChatSidebarModuleId | 'checkin'
  title: string
  fixedOpen?: boolean
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
  <div class="home-disclosure" :class="{ 'is-fixed-open': fixedOpen }">
    <div class="disclosure-head">
      <h3 v-if="fixedOpen" class="fixed-heading"><SidebarIcon :name="moduleId" /><span>{{ title }}</span></h3>
      <SidebarModuleHeader v-else
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
    <div :id="panelId" v-show="fixedOpen || !collapsed.includes(moduleKey)" class="disclosure-body">
      <slot :report-summary="reportSummary" />
    </div>
  </div>
</template>

<style scoped>
.fixed-heading { display: flex; align-items: center; gap: 8px; margin: 0; padding: 14px var(--fp-module-inset) 0; font-size: 13px; font-weight: 600; color: var(--fp-muted); }
.fixed-heading :deep(svg) { width: 16px; height: 16px; color: var(--fp-muted); }
.home-disclosure { min-width: 0; }
.disclosure-head { display: flex; align-items: center; gap: 6px; }
.disclosure-body { padding: var(--fp-disclosure-padding, 0); }
.is-fixed-open > .disclosure-body { padding: 0 var(--fp-module-inset) 6px; }
</style>
