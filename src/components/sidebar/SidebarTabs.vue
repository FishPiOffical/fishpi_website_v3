<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, ref, useId, watch } from 'vue'
import { getAuthContextVersion, onAccessTokenChange } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import SidebarIcon from '@/chat/sidebar/SidebarIcon.vue'
import type { ChatSidebarModuleId } from '@/chat/sidebar/meta'
import SidebarConfigureButton from './SidebarConfigureButton.vue'

type ModuleId = ChatSidebarModuleId | 'checkin' | 'download'
interface SidebarModule { id: ModuleId; title: string }
const props = withDefaults(defineProps<{
  modules: SidebarModule[]
  section: 'pageSidebar' | 'chatSidebar'
  ariaLabel: string
  showConfigure?: boolean
}>(), { showConfigure: true })
const auth = useAuthStore()
const ready = ref(false)
const activeId = ref<ModuleId | ''>('')
const focusedId = ref<ModuleId | ''>('')
const visited = ref(new Set<ModuleId>())
const tablist = ref<HTMLElement | null>(null)
const overflow = ref(false)
const canScrollBack = ref(false)
const canScrollForward = ref(false)
let resizeObserver: ResizeObserver | undefined
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

function updateOverflow() {
  const list = tablist.value
  if (!list) {
    overflow.value = false
    canScrollBack.value = false
    canScrollForward.value = false
    return
  }
  overflow.value = list.scrollWidth > list.clientWidth + 1
  canScrollBack.value = list.scrollLeft > 1
  canScrollForward.value = list.scrollLeft + list.clientWidth < list.scrollWidth - 1
}

function revealTab(id: ModuleId | '') {
  const list = tablist.value
  const index = props.modules.findIndex(mod => mod.id === id)
  const button = list?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]
  if (!list || !button) return
  // 只调整标签条的水平位置，避免切换标签时带动页面上下滚动。
  const area = list.getBoundingClientRect()
  const item = button.getBoundingClientRect()
  if (item.left < area.left) list.scrollLeft -= area.left - item.left
  else if (item.right > area.right) list.scrollLeft += item.right - area.right
  updateOverflow()
}

function scrollTabs(direction: -1 | 1) {
  const list = tablist.value
  if (!list) return
  list.scrollBy({ left: direction * list.clientWidth * .7, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
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
  revealTab(id)
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
  tablist.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus({ preventScroll: true })
  revealTab(target.id)
}

watch(() => props.modules.map(mod => mod.id).join(','), () => {
  reconcile()
  void nextTick(() => { updateOverflow(); revealTab(activeId.value) })
})
watch(tablist, (list) => {
  resizeObserver?.disconnect()
  if (list && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      updateOverflow()
      revealTab(focusedId.value || activeId.value)
    })
    resizeObserver.observe(list)
  }
  updateOverflow()
}, { flush: 'post' })
watch(overflow, () => { void nextTick(updateOverflow) })
onScopeDispose(() => resizeObserver?.disconnect())
watch(() => props.section, () => { visited.value.clear(); restore() })
watch(identity, () => {
  // 普通令牌轮换不会改变此边界；退出或换号则销毁旧面板和其中的私人草稿。
  visited.value = new Set()
  reconcile()
})
onMounted(() => {
  ready.value = true
  restore()
  void nextTick(() => { updateOverflow(); revealTab(activeId.value) })
})
</script>

<template>
  <section class="sidebar-tabs" :aria-label="ariaLabel">
    <div v-if="!ready" class="sidebar-placeholder" aria-busy="true" aria-label="侧栏准备中">
      <span /><span />
    </div>
    <template v-else>
      <header class="sidebar-tabs-heading">
        <button v-if="overflow" type="button" class="tab-scroll tab-scroll-back" aria-label="向前滚动标签" :disabled="!canScrollBack" @click="scrollTabs(-1)"><SidebarIcon name="chevron" /></button>
        <div v-if="modules.length" ref="tablist" class="sidebar-tablist" role="tablist" :aria-label="ariaLabel" @scroll.passive="updateOverflow">
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
        <span v-else class="sidebar-tabs-empty-title">侧栏模块</span>
        <button v-if="overflow" type="button" class="tab-scroll tab-scroll-forward" aria-label="向后滚动标签" :disabled="!canScrollForward" @click="scrollTabs(1)"><SidebarIcon name="chevron" /></button>
        <SidebarConfigureButton v-if="showConfigure" :section="section" />
      </header>
      <div v-if="current" class="sidebar-panel-actions"><slot name="header-actions" :module="current" /></div>
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
.sidebar-tabs-heading { display: flex; flex: none; align-items: center; gap: 2px; min-height: 50px; padding: 0 10px; border-bottom: 1px solid var(--fp-border); }
.sidebar-tablist { display: flex; flex: 1; align-self: stretch; min-width: 0; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; }
.sidebar-tablist::-webkit-scrollbar { display: none; }
.sidebar-tab { position: relative; flex: none; min-height: 49px; padding: 0 12px; border: 0; border-radius: 0; background: transparent; color: var(--fp-muted); font: inherit; font-size: 13px; line-height: 1.5; white-space: nowrap; cursor: pointer; transition: color .15s; }
.sidebar-tab::after { content: ''; position: absolute; inset-inline: 12px; bottom: 0; height: 2px; border-radius: 2px; background: var(--fp-primary); transform: scaleX(0); transition: transform .15s; }
.sidebar-tab:hover { color: var(--fp-title); }
.sidebar-tab[aria-selected='true'] { color: var(--fp-title); font-weight: 650; }
.sidebar-tab[aria-selected='true']::after { transform: scaleX(1); }
.sidebar-tab:focus-visible, .sidebar-panel:focus-visible, .tab-scroll:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: -3px; }
.tab-scroll { display: grid; flex: none; place-items: center; width: 24px; height: 36px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--fp-muted); cursor: pointer; transition: background .15s, color .15s; }
.tab-scroll:hover:not(:disabled) { background: var(--fp-hover); color: var(--fp-title); }
.tab-scroll:disabled { opacity: .25; cursor: default; }
.tab-scroll svg { width: 14px; height: 14px; }
.tab-scroll-back svg { transform: rotate(90deg); }
.tab-scroll-forward svg { transform: rotate(-90deg); }
.sidebar-tabs-heading :deep(.sidebar-configure) { margin-inline-end: 0; }
.sidebar-panel-actions { display: none; }
.sidebar-panel-actions:has(> *) { display: flex; flex: none; justify-content: flex-end; padding: 8px 16px 0; }
.sidebar-tabs-empty-title { flex: 1; padding: 0 6px; color: var(--fp-title); font-size: 13px; font-weight: 600; }
.sidebar-panel { flex: 0 1 auto; min-width: 0; min-height: 0; max-height: 640px; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; border-radius: 0 0 12px 12px; }
.sidebar-panel.is-active { animation: sidebar-tab-enter .15s ease-out; }
.sidebar-tabs-empty { padding: 8px 16px 20px; color: var(--fp-muted); font-size: 12px; line-height: 1.8; }
.sidebar-placeholder { display: grid; gap: 14px; padding: 20px 16px; min-height: 134px; }
.sidebar-placeholder span { height: 26px; border-radius: 6px; background: var(--fp-bg); }
.sidebar-placeholder span:first-child { width: 50%; }
@media (pointer: coarse) { .tab-scroll { width: 32px; height: 44px; } }
@keyframes sidebar-tab-enter { from { opacity: .6; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .sidebar-panel.is-active { animation: none; } .sidebar-tab, .sidebar-tab::after, .tab-scroll { transition: none; } }
</style>
