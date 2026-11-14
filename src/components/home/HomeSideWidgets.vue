<script setup lang="ts">
import { sidebarModule } from '@/chat/sidebar/registry'
import type { HomeModuleMeta } from '@/home/modules'
import HomeModuleDisclosure from './HomeModuleDisclosure.vue'

defineProps<{ modules: HomeModuleMeta[] }>()
</script>

<template>
  <div
    v-for="m in modules"
    :key="m.id"
    class="home-side-widget"
    :data-home-module="m.id"
    :data-home-title="m.title"
  >
    <HomeModuleDisclosure v-if="m.sidebarId" :module-key="m.id" :module-id="m.sidebarId" :title="m.title" :fixed-open="m.sidebarId === 'profile' || m.sidebarId === 'income'">
      <template #default="{ reportSummary }">
        <component :is="sidebarModule(m.sidebarId)?.component" @summary="reportSummary" />
      </template>
    </HomeModuleDisclosure>
  </div>
</template>

<style scoped>
.home-side-widget {
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
}
.home-side-widget + .home-side-widget {
  margin-top: 10px;
}
.home-side-widget :deep(.disclosure-body) { padding: 0 12px 10px; }
</style>
