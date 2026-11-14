import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { normalizeSidebarIds, normalizeSidebarPresentation, sidebarPresentationOf, type SidebarPresentation, type SidebarPresentationMap } from '@/utils/sidebarPresentation'
import { CHAT_SIDEBAR_META, type ChatSidebarModuleMeta } from '@/chat/sidebar/meta'

const STORAGE = 'fp.chatSidebar'

interface SidebarPref {
  order: string[]
  hidden: string[]
  collapsed: string[]
  presentation: SidebarPresentationMap
}

function defaults(): SidebarPref {
  return {
    order: CHAT_SIDEBAR_META.map((m) => m.id),
    hidden: CHAT_SIDEBAR_META.filter((m) => !m.defaultOn).map((m) => m.id),
    collapsed: [],
    presentation: {},
  }
}

function read(): SidebarPref {
  try {
    if (typeof localStorage === 'undefined') return defaults()
    const raw = localStorage.getItem(STORAGE)
    if (!raw) return defaults()
    const parsed = JSON.parse(raw) as Partial<SidebarPref> | null
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults()
    const known = CHAT_SIDEBAR_META.map(mod => mod.id)
    const order = normalizeSidebarIds(parsed.order, known)
    CHAT_SIDEBAR_META.forEach((m, i) => {
      if (!order.includes(m.id)) order.splice(Math.min(i, order.length), 0, m.id)
    })
    return {
      order,
      hidden: Array.isArray(parsed.hidden) ? normalizeSidebarIds(parsed.hidden, known) : defaults().hidden,
      collapsed: normalizeSidebarIds(parsed.collapsed, known),
      presentation: normalizeSidebarPresentation(parsed.presentation, known),
    }
  } catch {
    return defaults()
  }
}

export const useChatSidebarStore = defineStore('chatSidebar', () => {
  const pref = ref(read())

  const orderedModules = computed(() =>
    pref.value.order
      .map((id) => CHAT_SIDEBAR_META.find((mod) => mod.id === id))
      .filter((mod): mod is ChatSidebarModuleMeta => Boolean(mod)),
  )

  const visibleModules = computed(() => orderedModules.value.filter((mod) => !pref.value.hidden.includes(mod.id)))

  function persist() {
    try {
      if (typeof localStorage === 'undefined') return
      localStorage.setItem(STORAGE, JSON.stringify(pref.value))
    } catch { /* 存储不可用时仍保留本次页面内的调整。 */ }
  }

  function presentationOf(id: string): SidebarPresentation {
    return sidebarPresentationOf(id, pref.value.presentation)
  }

  function setPresentation(id: string, mode: SidebarPresentation) {
    if (id === 'profile' || !CHAT_SIDEBAR_META.some(mod => mod.id === id)) return
    if (mode !== 'card' && mode !== 'tabs') return
    pref.value.presentation = { ...pref.value.presentation, [id]: mode }
    persist()
  }

  function isOn(id: string) {
    return !pref.value.hidden.includes(id)
  }

  function toggle(id: string) {
    const hidden = new Set(pref.value.hidden)
    if (hidden.has(id)) hidden.delete(id)
    else hidden.add(id)
    pref.value.hidden = [...hidden]
    persist()
  }

  function toggleCollapsed(id: string) {
    const collapsed = new Set(pref.value.collapsed)
    if (collapsed.has(id)) collapsed.delete(id)
    else collapsed.add(id)
    pref.value.collapsed = [...collapsed]
    persist()
  }

  function move(id: string, dir: -1 | 1) {
    const order = [...pref.value.order]
    const i = order.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    pref.value.order = order
    persist()
  }

  function moveTo(id: string, targetId: string, after = false) {
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

  function reset() {
    pref.value = defaults()
    persist()
  }

  return { pref, orderedModules, visibleModules, presentationOf, setPresentation, isOn, toggle, toggleCollapsed, move, moveTo, reset }
})
