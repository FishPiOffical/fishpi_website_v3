<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, useId, watch } from 'vue'
import { getAuthContextVersion, onAccessTokenChange } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import SidebarIcon from '@/chat/sidebar/SidebarIcon.vue'
import type { ChatSidebarModuleId } from '@/chat/sidebar/meta'
import SidebarConfigureButton from './SidebarConfigureButton.vue'

type ModuleId = ChatSidebarModuleId | 'checkin' | 'download'
interface SidebarModule { id: ModuleId; title: string }
const props = defineProps<{
  modules: SidebarModule[]
  section: 'pageSidebar' | 'chatSidebar'
  ariaLabel: string
}>()
const auth = useAuthStore()
const ready = ref(false)
const activeId = ref<ModuleId | ''>('')
const focusedId = ref<ModuleId | ''>('')
const visited = ref(new Set<ModuleId>())
const tablist = ref<HTMLElement | null>(null)
const uid = useId()
const authVersion = ref(getAuthContextVersion())
const unsubscribe = onAccessTokenChange(() => { authVersion.value = getAuthContextVersion() })
onScopeDispose(unsubscribe)
const identity = computed(() => `${authVersion.value}:${auth.isLoggedIn ? auth.account?.oId : 'guest'}`)
const current = computed(() => props.modules.find(mod => mod.id === activeId.value))
const storageKey = computed(() => `fp.sidebarTab.${props.section}.v1`)
const labels: Partial<Record<ModuleId, string>> = {
  activity: '活跃签到', checkin: '活跃签到', appearance: '外观', download: '客户端下载', ad: '社区赞助',
}

function remember() {
  // 仅保存模块选择，不持久化内容、身份或输入草稿。
  if (!ready.value || !activeId.value) return
  try { localStorage.setItem(storageKey.value, activeId.value) } catch { /* 存储不可用不影响切换。 */ }
}

function reconcile() {
  if (!ready.value) return
  const enabled = new Set(props.modules.map(mod => mod.id))
  if (!enabled.has(activeId.value as ModuleId)) activeId.value = props.modules[0]?.id ?? ''
  if (!enabled.has(focusedId.value as ModuleId)) focusedId.value = activeId.value
  visited.value = new Set([...visited.value].filter(id => enabled.has(id)))
  if (activeId.value) visited.value.add(activeId.value)
  remember()
}

function restore() {
  let saved: string | null = null
  try { saved = localStorage.getItem(storageKey.value) } catch { /* 使用第一个已启用模块。 */ }
  activeId.value = props.modules.find(mod => mod.id === saved)?.id ?? ''
  focusedId.value = activeId.value
  reconcile()
}

function select(id: ModuleId) {
  activeId.value = id
  focusedId.value = id
  visited.value.add(id)
  remember()
}

function navigate(event: KeyboardEvent, id: ModuleId) {
  const index = props.modules.findIndex(mod => mod.id === id)
  const size = props.modules.length
  let next = index
  if (event.key === 'ArrowRight') next = (index + 1) % size
  else if (event.key === 'ArrowLeft') next = (index - 1 + size) % size
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = size - 1
  else return
  event.preventDefault()
  // 方向键只移动焦点，按回车/空格才打开，避免快速浏览标签时触发一串读取。
  const target = props.modules[next]
  if (!target) return
  focusedId.value = target.id
  tablist.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
}

watch(() => props.modules.map(mod => mod.id).join(','), reconcile)
watch(() => props.section, () => { visited.value.clear(); restore() })
watch(identity, () => {
  // 普通令牌轮换不会改变此边界；退出或换号则销毁旧面板和其中的私人草稿。
  visited.value = new Set()
  reconcile()
})
onMounted(() => {
  ready.value = true
  restore()
})
</script>

<template>
  <section class="sidebar-tabs" :aria-label="ariaLabel">
    <div v-if="!ready" class="sidebar-placeholder" aria-busy="true" aria-label="侧栏准备中">
      <span /><span />
    </div>
    <template v-else>
      <header class="sidebar-tabs-heading">
        <h3>
          <SidebarIcon :name="current?.id ?? 'settings'" />
          <span>{{ current?.title ?? '侧栏模块' }}</span>
        </h3>
        <div class="sidebar-tabs-actions">
          <slot v-if="current" name="header-actions" :module="current" />
          <SidebarConfigureButton :section="section" />
        </div>
      </header>
      <div v-if="modules.length" ref="tablist" class="sidebar-tablist" role="tablist" :aria-label="ariaLabel">
        <button
          v-for="mod in modules"
          :id="`${uid}-tab-${mod.id}`"
          :key="mod.id"
          type="button"
          role="tab"
          class="sidebar-tab"
          :aria-selected="activeId === mod.id"
          :aria-controls="`${uid}-panel-${mod.id}`"
          :tabindex="(focusedId || activeId) === mod.id ? 0 : -1"
          :title="mod.title"
          @click="select(mod.id)"
          @focus="focusedId = mod.id"
          @keydown="navigate($event, mod.id)"
        >{{ labels[mod.id] ?? mod.title }}</button>
      </div>
      <div v-if="!modules.length" class="sidebar-tabs-empty">还没有启用模块，点击右上角齿轮添加。</div>
      <!-- 已访问面板只隐藏，保留输入和分页；关闭模块或切换账号时才卸载。 -->
      <div
        v-for="mod in modules"
        v-show="activeId === mod.id"
        :id="`${uid}-panel-${mod.id}`"
        :key="`${identity}:${mod.id}`"
        class="sidebar-panel"
        :class="{ 'is-active': activeId === mod.id }"
        role="tabpanel"
        :aria-labelledby="`${uid}-tab-${mod.id}`"
        tabindex="0"
      >
        <slot v-if="visited.has(mod.id)" :module="mod" :active="activeId === mod.id" />
      </div>
    </template>
  </section>
</template>

<style scoped>
.sidebar-tabs {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  max-height: max(300px, calc(100dvh - var(--fp-nav-h, 64px) - 28px));
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  background: var(--fp-card);
  box-shadow: 0 2px 5px rgb(20 30 45 / 4%);
  container: sidebar-tabs / inline-size;
}
.sidebar-tabs-heading { display: flex; flex: none; align-items: center; gap: 8px; min-height: 54px; padding: 10px 12px 6px 16px; }
.sidebar-tabs-heading h3 { display: flex; flex: 1; align-items: center; gap: 9px; min-width: 0; margin: 0; color: var(--fp-title); font-size: 14px; font-weight: 650; }
.sidebar-tabs-heading h3 svg { flex: none; width: 17px; height: 17px; color: var(--fp-muted); }
.sidebar-tabs-heading h3 span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.sidebar-tabs-actions { display: flex; flex: none; align-items: center; gap: 3px; }
.sidebar-tabs-actions :deep(.sidebar-configure) { margin-inline-end: 0; }
.sidebar-tablist { display: grid; flex: none; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px; margin: 0 12px 10px; padding: 4px; border-radius: 9px; background: var(--fp-bg); }
.sidebar-tab { min-width: 0; min-height: 32px; padding: 6px 4px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--fp-muted); font: inherit; font-size: 12px; line-height: 1.5; white-space: nowrap; cursor: pointer; transition: background .15s, color .15s, box-shadow .15s; }
.sidebar-tab:hover { color: var(--fp-title); background: var(--fp-hover); }
.sidebar-tab[aria-selected='true'] { color: var(--fp-primary); background: var(--fp-card); box-shadow: 0 1px 3px rgb(20 30 45 / 9%); font-weight: 600; }
.sidebar-tab:focus-visible, .sidebar-panel:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: -2px; }
.sidebar-panel { flex: 0 1 auto; min-width: 0; min-height: 0; max-height: 640px; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; border-top: 1px solid var(--fp-border); border-radius: 0 0 12px 12px; }
.sidebar-panel.is-active { animation: sidebar-tab-enter .15s ease-out; }
.sidebar-tabs-empty { padding: 8px 16px 20px; color: var(--fp-muted); font-size: 12px; line-height: 1.8; }
.sidebar-placeholder { display: grid; gap: 14px; padding: 20px 16px; min-height: 134px; }
.sidebar-placeholder span { height: 26px; border-radius: 6px; background: var(--fp-bg); }
.sidebar-placeholder span:first-child { width: 50%; }
@container sidebar-tabs (max-width: 290px) { .sidebar-tablist { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@keyframes sidebar-tab-enter { from { opacity: .6; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .sidebar-panel.is-active { animation: none; } .sidebar-tab { transition: none; } }
</style>
