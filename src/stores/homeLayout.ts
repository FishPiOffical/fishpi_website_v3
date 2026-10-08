import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  HOME_LAYOUT_STORAGE,
  HOME_MODULES,
  defaultHomeLayout,
  type HomeLayoutState,
  type HomeModuleId,
  type HomeModuleMeta,
  type HomeZoneId,
} from '@/home/modules'

function read(): HomeLayoutState {
  const base = defaultHomeLayout()
  if (import.meta.env.SSR || typeof localStorage === 'undefined') return base
  try {
    const raw = localStorage.getItem(HOME_LAYOUT_STORAGE)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<HomeLayoutState>
    return {
      hidden: { ...base.hidden, ...(parsed.hidden || {}) },
      order: Array.isArray(parsed.order) && parsed.order.length ? parsed.order : base.order,
      zones: { ...base.zones, ...(parsed.zones || {}) },
    }
  } catch {
    return base
  }
}

export const useHomeLayoutStore = defineStore('homeLayout', () => {
  const state = ref<HomeLayoutState>(read())
  const panelOpen = ref(false)

  watch(
    state,
    (v) => {
      if (import.meta.env.SSR || typeof localStorage === 'undefined') return
      localStorage.setItem(HOME_LAYOUT_STORAGE, JSON.stringify(v))
    },
    { deep: true },
  )

  const metaById = computed(() => {
    const map = new Map<HomeModuleId, HomeModuleMeta>()
    for (const m of HOME_MODULES) map.set(m.id, m)
    return map
  })

  const orderedVisible = computed(() => {
    const known = new Set(HOME_MODULES.map((m) => m.id))
    const order = (state.value.order.length ? state.value.order : HOME_MODULES.map((m) => m.id)).filter(
      (id): id is HomeModuleId => known.has(id as HomeModuleId),
    )
    for (const m of HOME_MODULES) {
      if (!order.includes(m.id)) order.push(m.id)
    }
    return order
      .filter((id) => !state.value.hidden[id])
      .map((id) => {
        const meta = metaById.value.get(id)!
        const zone = (state.value.zones[id] as HomeZoneId) || meta.zone
        return { ...meta, zone }
      })
  })

  function modulesIn(zone: HomeZoneId) {
    return orderedVisible.value.filter((m) => m.zone === zone)
  }

  function toggle(id: HomeModuleId) {
    state.value.hidden[id] = !state.value.hidden[id]
  }

  function move(id: HomeModuleId, dir: -1 | 1) {
    const order = [...(state.value.order.length ? state.value.order : HOME_MODULES.map((m) => m.id))]
    const i = order.indexOf(id)
    if (i < 0) return
    const j = i + dir
    if (j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    state.value.order = order
  }

  function setZone(id: HomeModuleId, zone: HomeZoneId) {
    state.value.zones[id] = zone
  }

  function applyPreset(visibleCount: number) {
    const order = state.value.order.length ? state.value.order : HOME_MODULES.map((m) => m.id)
    const hidden: Record<string, boolean> = {}
    order.forEach((id, i) => {
      hidden[id] = i >= visibleCount
    })
    // Keep unknown modules visible by default.
    for (const m of HOME_MODULES) {
      if (!(m.id in hidden)) hidden[m.id] = false
    }
    state.value.hidden = hidden
  }

  function reset() {
    state.value = defaultHomeLayout()
  }

  function isHidden(id: HomeModuleId) {
    return Boolean(state.value.hidden[id])
  }

  return {
    state,
    panelOpen,
    orderedVisible,
    modulesIn,
    toggle,
    move,
    setZone,
    applyPreset,
    reset,
    isHidden,
  }
})
