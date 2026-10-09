<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { sidebarModule } from './registry'
import { useChatSidebarStore } from '@/stores/chatSidebar'
import { useSettingsDrawerStore } from '@/stores/settingsDrawer'

const { visibleModules } = storeToRefs(useChatSidebarStore())
const drawer = useSettingsDrawerStore()
</script>

<template>
  <aside class="side">
    <header class="toolbar">
      <strong>侧边栏</strong>
      <button type="button" @click="drawer.show('chatSidebar')">配置模块</button>
    </header>

    <section v-for="mod in visibleModules" :key="mod.id" class="card">
      <h3>{{ mod.title }}</h3>
      <component :is="sidebarModule(mod.id)?.component" />
    </section>
  </aside>
</template>

<style scoped>
.side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.toolbar strong {
  font-size: 13px;
  color: var(--fp-head);
}
.toolbar button {
  border: 1px solid var(--fp-border);
  background: var(--fp-card);
  color: var(--fp-text);
  border-radius: 3px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
}
.card {
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  border-radius: 8px;
  padding: 12px 15px;
}
.card h3 {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--fp-head);
  font-weight: 700;
}
</style>
