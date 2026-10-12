<script setup lang="ts">
import { useId } from 'vue'
import { storeToRefs } from 'pinia'
import { sidebarModule } from './registry'
import SidebarIcon from './SidebarIcon.vue'
import { useChatSidebarStore } from '@/stores/chatSidebar'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { useSettingsDrawerStore } from '@/stores/settingsDrawer'

const sidebar = useChatSidebarStore()
const { visibleModules, pref } = storeToRefs(sidebar)
const { connected, connecting } = storeToRefs(useChatStore())
const { isLoggedIn } = storeToRefs(useAuthStore())
const drawer = useSettingsDrawerStore()
const id = useId()
</script>

<template>
  <aside class="chat-sidebar" aria-label="聊天室侧栏">
    <header class="toolbar">
      <span class="connection" :class="{ live: connected }" role="status">
        <i aria-hidden="true" />
        {{ connected ? '实时连接' : connecting ? '连接中' : isLoggedIn ? '未连接' : '游客模式' }}
      </span>
      <button class="configure" type="button" @click="drawer.show('chatSidebar')">
        <SidebarIcon name="settings" />配置模块
      </button>
    </header>

    <section v-for="mod in visibleModules" :key="mod.id" class="card">
      <h3>
        <button
          class="card-toggle"
          type="button"
          :aria-expanded="!pref.collapsed.includes(mod.id)"
          :aria-controls="`${id}-${mod.id}`"
          @click="sidebar.toggleCollapsed(mod.id)"
        >
          <SidebarIcon class="module-icon" :name="mod.id" />
          <span>{{ mod.title }}</span>
          <SidebarIcon class="chevron" name="chevron" />
        </button>
      </h3>
      <div :id="`${id}-${mod.id}`" v-show="!pref.collapsed.includes(mod.id)" class="card-body">
        <component :is="sidebarModule(mod.id)?.component" />
      </div>
    </section>
    <p v-if="!visibleModules.length" class="empty">暂未开启模块，点击「配置模块」添加。</p>
  </aside>
</template>

<style scoped>
.chat-sidebar { display: flex; flex-direction: column; gap: 10px; width: 100%; min-width: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 28px; padding: 0 2px 2px; }
.connection { display: inline-flex; align-items: center; gap: 6px; color: var(--fp-muted); font-size: 11px; }
.connection i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.connection.live i { color: var(--fp-primary); }
.configure { display: inline-flex; align-items: center; gap: 5px; padding: 4px 6px; border: 0; border-radius: 5px; background: transparent; color: var(--fp-muted); font-size: 11px; cursor: pointer; }
.configure svg { width: 14px; height: 14px; }
.configure:hover { background: var(--fp-hover); color: var(--fp-text); }
.card { min-width: 0; border: 1px solid var(--fp-border); background: var(--fp-card); box-shadow: var(--fp-card-shadow); border-radius: 8px; }
h3 { margin: 0; font-size: 12px; }
.card-toggle { display: flex; align-items: center; gap: 8px; width: 100%; padding: 12px 14px; border: 0; border-radius: 8px; background: transparent; color: var(--fp-head); font: inherit; font-weight: 600; text-align: left; cursor: pointer; }
.card-toggle:hover { color: var(--fp-title); background: var(--fp-hover); }
.module-icon { flex: none; width: 15px; height: 15px; color: var(--fp-muted); }
.chevron { width: 14px; height: 14px; margin-left: auto; color: var(--fp-muted); transition: transform 160ms ease; }
.card-toggle[aria-expanded='false'] .chevron { transform: rotate(-90deg); }
.card-body { padding: 0 14px 14px; font-size: 12px; line-height: 1.6; }
.configure:focus-visible, .card-toggle:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 2px; }
.empty { margin: 0; padding: 16px; border: 1px dashed var(--fp-border); border-radius: 8px; color: var(--fp-muted); font-size: 12px; line-height: 1.6; }
@media (prefers-reduced-motion: reduce) { .chevron { transition: none; } }
</style>
