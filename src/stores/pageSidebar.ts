import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type PageSidebarModuleId =
  | 'profile'
  | 'checkin'
  | 'download'
  | 'breezemoons'
  | 'income'
  | 'appearance'
  | 'barrage'
  | 'ad'

export interface PageSidebarModuleMeta {
  id: PageSidebarModuleId
  title: string
  defaultOn: boolean
  /** 精简模式下保留的模块 */
  core?: boolean
}

export const PAGE_SIDEBAR_META: PageSidebarModuleMeta[] = [
  { id: 'profile', title: '我的资料', defaultOn: true, core: true },
  { id: 'checkin', title: '今日活跃与签到', defaultOn: true, core: true },
  { id: 'download', title: '客户端下载', defaultOn: true },
  { id: 'breezemoons', title: '清风明月', defaultOn: true, core: true },
  { id: 'income', title: '上下班时间', defaultOn: false },
  { id: 'appearance', title: '外观主题', defaultOn: false },
  { id: 'barrage', title: '弹幕花费', defaultOn: false },
  { id: 'ad', title: '社区赞助', defaultOn: false },
]

const STORAGE = 'fp.pageSidebar.v1'

interface PageSidebarPref {
  order: PageSidebarModuleId[]
  hidden: PageSidebarModuleId[]
  collapsed: PageSidebarModuleId[]
}

function defaults(): PageSidebarPref {
  return {
    order: PAGE_SIDEBAR_META.map((m) => m.id),
    hidden: PAGE_SIDEBAR_META.filter((m) => !m.defaultOn).map((m) => m.id),
    collapsed: [],
  }
}

function read(): PageSidebarPref {
  if (typeof localStorage === 'undefined') return defaults()
  try {
    const raw = localStorage.getItem(STORAGE)
    if (!raw) return defaults()
    const parsed = JSON.parse(raw) as Partial<PageSidebarPref>
    const known = new Set(PAGE_SIDEBAR_META.map((m) => m.id))
    const order = Array.isArray(parsed.order)
      ? parsed.order.filter((id): id is PageSidebarModuleId => known.has(id as PageSidebarModuleId))
      : []
    PAGE_SIDEBAR_META.forEach((m, i) => {
      if (!order.includes(m.id)) order.splice(Math.min(i, order.length), 0, m.id)
    })
    return {
      order,
      hidden: Array.isArray(parsed.hidden)
        ? parsed.hidden.filter((id): id is PageSidebarModuleId => known.has(id as PageSidebarModuleId))
        : defaults().hidden,
      collapsed: Array.isArray(parsed.collapsed)
        ? parsed.collapsed.filter((id): id is PageSidebarModuleId => known.has(id as PageSidebarModuleId))
        : [],
    }
  } catch {
    return defaults()
  }
}

export const usePageSidebarStore = defineStore('pageSidebar', () => {
  const pref = ref<PageSidebarPref>(read())

  const orderedModules = computed(() =>
    pref.value.order
      .map((id) => PAGE_SIDEBAR_META.find((mod) => mod.id === id))
      .filter((mod): mod is PageSidebarModuleMeta => Boolean(mod)),
  )

  const visibleModules = computed(() =>
    orderedModules.value.filter((mod) => !pref.value.hidden.includes(mod.id)),
  )

  function persist() {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE, JSON.stringify(pref.value))
  }

  function isOn(id: PageSidebarModuleId) {
    return !pref.value.hidden.includes(id)
  }

  function isCollapsed(id: PageSidebarModuleId) {
    return pref.value.collapsed.includes(id)
  }

  function toggle(id: PageSidebarModuleId) {
    const hidden = new Set(pref.value.hidden)
    if (hidden.has(id)) hidden.delete(id)
    else hidden.add(id)
    pref.value.hidden = [...hidden]
    persist()
  }

  function toggleCollapsed(id: PageSidebarModuleId) {
    const collapsed = new Set(pref.value.collapsed)
    if (collapsed.has(id)) collapsed.delete(id)
    else collapsed.add(id)
    pref.value.collapsed = [...collapsed]
    persist()
  }

  function move(id: PageSidebarModuleId, dir: -1 | 1) {
    const order = [...pref.value.order]
    const i = order.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    pref.value.order = order
    persist()
  }

  function moveTo(id: PageSidebarModuleId, targetId: PageSidebarModuleId, after = false) {
    if (id === targetId) return
    const order = [...pref.value.order]
    const from = order.indexOf(id)
    const target = order.indexOf(targetId)
    if (from < 0 || target < 0) return
    order.splice(from, 1)
    const targetAfterRemoval = order.indexOf(targetId)
    order.splice(targetAfterRemoval + (after ? 1 : 0), 0, id)
    pref.value.order = order
    persist()
  }

  function applyPreset(mode: 'compact' | 'all') {
    if (mode === 'all') {
      pref.value.hidden = []
    } else {
      pref.value.hidden = PAGE_SIDEBAR_META.filter((m) => !m.core).map((m) => m.id)
    }
    persist()
  }

  function reset() {
    pref.value = defaults()
    persist()
  }

  return {
    pref,
    orderedModules,
    visibleModules,
    isOn,
    isCollapsed,
    toggle,
    toggleCollapsed,
    move,
    moveTo,
    applyPreset,
    reset,
  }
})
