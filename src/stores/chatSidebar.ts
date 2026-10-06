import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { CHAT_SIDEBAR_MODULES, type ChatSidebarModule } from '@/chat/sidebar/registry'

const STORAGE = 'fp.chatSidebar'

interface SidebarPref {
  order: string[]
  hidden: string[]
}

function defaults(): SidebarPref {
  return {
    order: CHAT_SIDEBAR_MODULES.map((m) => m.id),
    hidden: CHAT_SIDEBAR_MODULES.filter((m) => !m.defaultOn).map((m) => m.id),
  }
}

function read(): SidebarPref {
  try {
    const raw = localStorage.getItem(STORAGE)
    if (!raw) return defaults()
    const parsed = JSON.parse(raw) as SidebarPref
    const known = new Set(CHAT_SIDEBAR_MODULES.map((m) => m.id))
    const order = parsed.order.filter((id) => known.has(id))
    for (const m of CHAT_SIDEBAR_MODULES) {
      if (!order.includes(m.id)) order.push(m.id)
    }
    return { order, hidden: parsed.hidden.filter((id) => known.has(id)) }
  } catch {
    return defaults()
  }
}

export const useChatSidebarStore = defineStore('chatSidebar', () => {
  const pref = ref(read())
  const configuring = ref(false)

  const visibleModules = computed(() =>
    pref.value.order
      .map((id) => CHAT_SIDEBAR_MODULES.find((mod) => mod.id === id))
      .filter((mod): mod is ChatSidebarModule => {
        if (!mod) return false
        return !pref.value.hidden.includes(mod.id)
      }),
  )

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

  return { pref, configuring, visibleModules, isOn, toggle, move, reset }
})
