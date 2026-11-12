<script setup lang="ts">
import SidebarIcon from '@/chat/sidebar/SidebarIcon.vue'
import { useSettingsDrawerStore } from '@/stores/settingsDrawer'

defineProps<{ section: 'chatSidebar' | 'pageSidebar' }>()
const drawer = useSettingsDrawerStore()
</script>

<template>
  <button
    type="button"
    class="sidebar-configure"
    aria-label="配置模块"
    title="配置模块"
    aria-haspopup="dialog"
    @click="drawer.show(section)"
  >
    <SidebarIcon name="settings" />
  </button>
</template>

<style scoped>
.sidebar-configure {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  margin-inline-end: 6px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--fp-muted);
  cursor: pointer;
}
.sidebar-configure svg { width: 15px; height: 15px; }
.sidebar-configure:hover { background: var(--fp-hover); color: var(--fp-title); }
.sidebar-configure:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: -2px; }
</style>
