import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { CHAT_SIDEBAR_META, type ChatSidebarModuleMeta } from '@/chat/sidebar/meta'

const STORAGE = 'fp.chatSidebar'

interface SidebarPref {
  order: string[]
  hidden: string[]
}

function defaults(): SidebarPref {
  return {
    order: CHAT_SIDEBAR_META.map((m) => m.id),
    hidden: CHAT_SIDEBAR_META.filter((m) => !m.defaultOn).map((m) => m.id),
  }
}

function read(): SidebarPref {
  if (typeof localStorage === 'undefined') return defaults()
  try {
    const raw = localStorage.getItem(STORAGE)
    if (!raw) return defaults()
    const parsed = JSON.parse(raw) as SidebarPref
    const known = new Set(CHAT_SIDEBAR_META.map((m) => m.id))
    const order = parsed.order.filter((id) => known.has(id as ChatSidebarModuleMeta['id']))
    CHAT_SIDEBAR_META.forEach((m, i) => {
      if (!order.includes(m.id)) order.splice(Math.min(i, order.length), 0, m.id)
    })
    return { order, hidden: parsed.hidden.filter((id) => known.has(id as ChatSidebarModuleMeta['id'])) }
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
    localStorage.setItem(STORAGE, JSON.stringify(pref.value))
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

  function move(id: string, dir: -1 | 1) {
    const order = [...pref.value.order]
    const i = order.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    pref.value.order = order
    persist()
  }

  function reset() {
    pref.value = defaults()
    persist()
  }

  return { pref, orderedModules, visibleModules, isOn, toggle, move, reset }
})
