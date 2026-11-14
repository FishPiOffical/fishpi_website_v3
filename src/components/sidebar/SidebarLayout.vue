<script setup lang="ts">
import { computed, onMounted, onScopeDispose, reactive, ref, useId, watch } from 'vue'
import { getAuthContextVersion, onAccessTokenChange } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { provideSidebarDrafts } from '@/composables/sidebarDrafts'
import type { ChatSidebarModuleId } from '@/chat/sidebar/meta'
import { groupSidebarModules, type SidebarPresentation } from '@/utils/sidebarPresentation'
import SidebarTabs from './SidebarTabs.vue'
import SidebarModuleHeader from './SidebarModuleHeader.vue'
import SidebarConfigureButton from './SidebarConfigureButton.vue'

interface SidebarDisplayModule { id: ChatSidebarModuleId | 'checkin' | 'download'; title: string }
const props = defineProps<{
  modules: SidebarDisplayModule[]
  section: 'pageSidebar' | 'chatSidebar'
  ariaLabel: string
  presentationOf: (id: string) => SidebarPresentation
  isCollapsed: (id: string) => boolean
}>()
const emit = defineEmits<{ toggle: [id: SidebarDisplayModule['id']] }>()
const auth = useAuthStore()
const ready = ref(false)
const uid = useId()
const summaries = reactive<Record<string, string>>({})
const authVersion = ref(getAuthContextVersion())
const unsubscribe = onAccessTokenChange(() => { authVersion.value = getAuthContextVersion() })
onScopeDispose(unsubscribe)
const identity = computed(() => `${authVersion.value}:${auth.isLoggedIn ? auth.account?.oId : 'guest'}`)
provideSidebarDrafts(() => identity.value, () => props.modules.map(module => module.id))
const groups = computed(() => groupSidebarModules(props.modules, props.presentationOf))
const moduleClasses = (id: string) => ({
  'tool-module': ['profile', 'income', 'activity', 'checkin'].includes(id),
  'tool-module--profile': id === 'profile',
  'tool-module--income': id === 'income',
  'tool-module--checkin': id === 'checkin' || id === 'activity',
})

watch(identity, () => {
  // 折叠摘要与面板同步清理，换号后不能留下上个账号的签到或资料状态。
  for (const id of Object.keys(summaries)) delete summaries[id]
})
// 本机布局和身份在水合后启用，服务端与客户端首帧统一显示准备态。
onMounted(() => { ready.value = true })
</script>

<template>
  <aside class="sidebar-layout" :aria-label="ariaLabel">
    <p v-if="!ready" class="empty-side" role="status">正在加载侧栏…</p>
    <template v-else>
      <template v-for="(group, index) in groups" :key="group.kind === 'card' ? group.module.id : 'tabs'">
        <section
          v-if="group.kind === 'card'"
          :key="`${identity}:${group.module.id}`"
          class="sidebar-card"
          :class="[moduleClasses(group.module.id), { 'is-collapsed': isCollapsed(group.module.id) }]"
          :data-sidebar-module="group.module.id"
        >
          <header class="sidebar-card-heading">
            <SidebarModuleHeader
              :module-id="group.module.id"
              :title="group.module.title"
              :expanded="!isCollapsed(group.module.id)"
              :controls="`${uid}-${group.module.id}`"
              :summary="summaries[group.module.id]"
              :heading="section === 'pageSidebar' ? 'h2' : 'h3'"
              @toggle="emit('toggle', group.module.id)"
            />
            <div v-if="$slots['header-actions'] && !isCollapsed(group.module.id)" class="card-actions">
              <slot name="header-actions" :module="group.module" />
            </div>
            <SidebarConfigureButton v-if="index === 0" :section="section" />
          </header>
          <div :id="`${uid}-${group.module.id}`" v-show="!isCollapsed(group.module.id)" class="card-body">
            <slot :module="group.module" :on-summary="(text: string) => summaries[group.module.id] = text" />
          </div>
        </section>
        <SidebarTabs
          v-else
          :modules="group.modules"
          :section="section"
          :ariaLabel="ariaLabel"
          :show-configure="index === 0"
        >
          <template #header-actions="{ module }"><slot name="header-actions" :module="module" /></template>
          <template #default="{ module }">
            <div class="sidebar-tab-content" :class="moduleClasses(module.id)">
              <div class="card-body">
                <slot :module="module" :on-summary="(text: string) => summaries[module.id] = text" />
              </div>
            </div>
          </template>
        </SidebarTabs>
      </template>
      <SidebarTabs v-if="!groups.length" :modules="[]" :section="section" :ariaLabel="ariaLabel" />
    </template>
  </aside>
</template>

<style scoped>
.sidebar-layout { display: flex; flex-direction: column; gap: 12px; width: 100%; min-width: 0; }
.sidebar-card, .sidebar-tab-content { min-width: 0; width: 100%; }
.sidebar-card { border: 1px solid var(--fp-border); border-radius: var(--fp-panel-radius, 10px); background: var(--fp-card); box-shadow: var(--fp-card-shadow); }
.sidebar-card-heading { display: flex; align-items: center; min-width: 0; }
.card-actions { display: flex; align-items: center; flex: none; }
.card-actions:empty { display: none; }
.card-actions :deep(a) { margin-right: 12px; color: var(--fp-muted); font-size: 12px; white-space: nowrap; }
.card-body { min-width: 0; padding: 14px 16px; font-size: 12px; line-height: 1.6; }
.sidebar-card > .card-body { padding-top: 0; }
.empty-side { margin: 0; padding: 16px; border: 1px dashed var(--fp-border); border-radius: var(--fp-radius-lg, 10px); color: var(--fp-muted); font-size: 12px; line-height: 1.6; text-align: center; }
</style>

<style scoped src="./tool-module.css"></style>
