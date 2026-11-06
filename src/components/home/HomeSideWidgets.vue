<script setup lang="ts">
import { sidebarModule } from '@/chat/sidebar/registry'
import type { HomeModuleMeta } from '@/home/modules'

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
    <div class="head">
      <b>{{ m.title }}</b>
    </div>
    <component :is="m.sidebarId ? sidebarModule(m.sidebarId)?.component : undefined" />
  </div>
</template>

<style scoped>
.home-side-widget {
  padding: 10px 12px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
}
.home-side-widget + .home-side-widget {
  margin-top: 10px;
}
.head {
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--fp-head);
}
.head b {
  font-size: 14px;
  font-weight: 600;
  color: var(--fp-title);
}
</style>
