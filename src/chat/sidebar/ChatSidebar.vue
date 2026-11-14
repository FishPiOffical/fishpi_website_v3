<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, useId } from 'vue'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion, onAccessTokenChange } from '@/api/http'
import { sidebarModule } from './registry'
import SidebarConfigureButton from '@/components/sidebar/SidebarConfigureButton.vue'
import SidebarModuleHeader from '@/components/sidebar/SidebarModuleHeader.vue'
import SidebarTabs from '@/components/sidebar/SidebarTabs.vue'
import { useAuthStore } from '@/stores/auth'
import { useChatSidebarStore } from '@/stores/chatSidebar'

const sidebar = useChatSidebarStore()
const { visibleModules, pref } = storeToRefs(sidebar)
const { isLoggedIn, account } = storeToRefs(useAuthStore())
const profileModule = computed(() => visibleModules.value.find(mod => mod.id === 'profile'))
const tabModules = computed(() => visibleModules.value.filter(mod => mod.id !== 'profile'))
const id = useId()
const ready = ref(false)
const authVersion = ref(getAuthContextVersion())
const unsubscribe = onAccessTokenChange(() => { authVersion.value = getAuthContextVersion() })
onScopeDispose(unsubscribe)
const identity = computed(() => `${authVersion.value}:${isLoggedIn.value ? account.value?.oId : 'guest'}`)
onMounted(() => { ready.value = true })
</script>

<template>
  <aside class="chat-sidebar" aria-label="聊天室侧栏">
    <p v-if="!ready" class="empty-side" role="status">正在加载侧栏…</p>
    <template v-else>
      <section v-if="profileModule" :key="identity" class="card tool-module tool-module--profile">
        <header class="card-header">
          <SidebarModuleHeader
            module-id="profile"
            :title="profileModule.title"
            :expanded="!pref.collapsed.includes('profile')"
            :controls="`${id}-profile`"
            @toggle="sidebar.toggleCollapsed('profile')"
          />
          <SidebarConfigureButton section="chatSidebar" />
        </header>
        <div :id="`${id}-profile`" v-show="!pref.collapsed.includes('profile')" class="card-body">
          <component :is="sidebarModule('profile')?.component" />
        </div>
      </section>
      <SidebarTabs
        v-if="tabModules.length || !profileModule"
        :modules="tabModules"
        :show-configure="!profileModule"
        section="chatSidebar"
        ariaLabel="聊天室侧栏模块"
      >
        <template #default="{ module: mod }">
          <div class="chat-tab-module" :class="{ 'tool-module': ['income', 'activity'].includes(mod.id), 'tool-module--income': mod.id === 'income', 'tool-module--checkin': mod.id === 'activity' }">
            <div class="card-body">
              <component :is="sidebarModule(mod.id)?.component" />
            </div>
          </div>
        </template>
      </SidebarTabs>
    </template>
  </aside>
</template>

<style scoped>
.chat-sidebar, .chat-tab-module { width: 100%; min-width: 0; }
.chat-sidebar { display: flex; flex-direction: column; gap: 10px; }
.card-header { display: flex; align-items: center; }
.card { min-width: 0; border: 1px solid var(--fp-border); background: var(--fp-card); box-shadow: var(--fp-card-shadow); border-radius: 8px; }
.card > .card-body { padding: 0 14px 14px; }
.card-body { padding: 14px 16px; font-size: 12px; line-height: 1.6; }
.empty-side { margin: 0; padding: 16px; border: 1px dashed var(--fp-border); border-radius: var(--fp-radius-lg, 10px); color: var(--fp-muted); font-size: 12px; line-height: 1.6; text-align: center; }
</style>

<style scoped src="../../components/sidebar/tool-module.css"></style>
