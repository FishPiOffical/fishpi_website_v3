import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  HOME_LAYOUT_STORAGE,
  HOME_VARIANTS_STORAGE,
  type HomeVariant,
  HOME_LAYOUT_STORAGE_V1,
  HOME_MAX_CELLS_PER_ROW,
  HOME_MODULES,
  defaultHomeLayout,
  isPreviousDefaultLayout,
  normalizeRows,
  type HomeLayoutState,
  type HomeModuleId,
  type HomeModuleMeta,
  type HomeRow,
} from '@/home/modules'

/**
 * stack：插入锚点所在列，排在锚点上/下
 * side：在锚点所在列的左/右新开一列
 * row：在锚点所在行之前新开一行（anchor 为 null 时放到最后）
 */
export type HomeDropTarget =
  | { kind: 'stack'; anchor: HomeModuleId; after: boolean }
  | { kind: 'side'; anchor: HomeModuleId; after: boolean }
  | { kind: 'row'; anchor: HomeModuleId | null }

export interface HomeCellView {
  key: string
  modules: HomeModuleMeta[]
  narrow: boolean
}

export interface HomeRowView {
  key: string
  cells: HomeCellView[]
  columns: string
}

const HOME_COLLAPSED_STORAGE = 'fishpi.home.collapsed.v1'

function read(): HomeLayoutState {
  const base = defaultHomeLayout()
  if (import.meta.env.SSR) return base
  try {
    if (typeof localStorage === 'undefined') return base
    const raw = localStorage.getItem(HOME_LAYOUT_STORAGE)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HomeLayoutState>
      const rows = normalizeRows(parsed.rows)
      const hidden = { ...base.hidden, ...(parsed.hidden || {}) }
      // The previous shipped default showed income; an absent key meant visible.
      const oldHidden = { ...hidden, 'side:income': parsed.hidden?.['side:income'] ?? false }
      return isPreviousDefaultLayout(rows, oldHidden) ? base : { hidden, rows }
    }
    const v1 = localStorage.getItem(HOME_LAYOUT_STORAGE_V1)
    if (v1) {
      const parsed = JSON.parse(v1) as { hidden?: Record<string, boolean> }
      return { hidden: { ...base.hidden, ...(parsed.hidden || {}) }, rows: base.rows }
    }
  } catch {
    /* fall through */
  }
  return base
}

function locate(rows: HomeRow[], id: HomeModuleId) {
  for (let ri = 0; ri < rows.length; ri++) {
    for (let ci = 0; ci < rows[ri].length; ci++) {
      const mi = rows[ri][ci].indexOf(id)
      if (mi >= 0) return { ri, ci, mi }
    }
  }
  return null
}

export const useHomeLayoutStore = defineStore('homeLayout', () => {
  // The first browser tree must use the same layout as the public SSR tree.
  const state = ref<HomeLayoutState>(defaultHomeLayout())
  const mode = ref<HomeVariant>('classic')
  const editing = ref(false)
  const collapsed = ref<string[]>([])
  const layouts: Partial<Record<HomeVariant, HomeLayoutState>> = {}
  const copy = (value: HomeLayoutState): HomeLayoutState => JSON.parse(JSON.stringify(value))
  let restored = false

  function restore() {
    if (import.meta.env.SSR || restored) return
    restored = true
    state.value = read()
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(HOME_COLLAPSED_STORAGE) || '[]')
      if (Array.isArray(saved)) collapsed.value = saved.filter((id): id is string => typeof id === 'string')
    } catch { /* Local preferences are optional. */ }
    try {
      const raw = localStorage.getItem(HOME_VARIANTS_STORAGE)
      if (raw) {
        const saved = JSON.parse(raw)
        for (const variant of ['compact', 'classic'] as const) {
          const value = saved.layouts?.[variant]
          if (value && Array.isArray(value.rows) && value.hidden && typeof value.hidden === 'object' && !Array.isArray(value.hidden)) layouts[variant] = { rows: normalizeRows(value.rows, variant), hidden: { ...defaultHomeLayout(variant).hidden, ...value.hidden } }
        }
        if (saved.mode === 'classic' || saved.mode === 'compact') mode.value = saved.mode
        state.value = copy(layouts[mode.value] || defaultHomeLayout(mode.value))
      }
    } catch { /* Local preferences are optional. */ }
    layouts[mode.value] = copy(state.value)
  }

  function toggleCollapsed(id: string) {
    if (editing.value) return
    const next = new Set(collapsed.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    saveCollapsed([...next])
  }

  function saveCollapsed(value: string[]) {
    collapsed.value = value
    try { localStorage.setItem(HOME_COLLAPSED_STORAGE, JSON.stringify(value)) } catch { /* Storage is optional. */ }
  }

  watch(
    [state, mode],
    ([v]) => {
      if (import.meta.env.SSR || !restored) return
      try { layouts[mode.value] = copy(v); localStorage.setItem(HOME_LAYOUT_STORAGE, JSON.stringify(v)); localStorage.setItem(HOME_VARIANTS_STORAGE, JSON.stringify({ mode: mode.value, layouts })) } catch { /* Storage is optional. */ }
    },
    { deep: true },
  )

  const metaById = new Map<HomeModuleId, HomeModuleMeta>(HOME_MODULES.map((m) => [m.id, m]))

  /** 布局顺序（自上而下、自左向右）的全部模块，供设置面板列表使用 */
  const orderedModules = computed(() =>
    state.value.rows.flat(2).map((id) => metaById.get(id)!).filter(Boolean),
  )

  const visibleRows = computed<HomeRowView[]>(() =>
    state.value.rows
      .map((row) => {
        const cells = row
          .map((cell) => {
            const modules = cell.filter((id) => !state.value.hidden[id]).map((id) => metaById.get(id)!)
            return { key: cell.join('|'), modules, narrow: modules.every((m) => m.width === 'narrow') }
          })
          .filter((c) => c.modules.length)
        return {
          key: row.flat().join('|'),
          cells,
          // 三列共用等宽网格，不因模块类型或列内堆叠改变跨行对齐；两列保留原比例。
          columns: cells.length === 3 ? 'repeat(3, minmax(0, 1fr))' : cells.map((c) => mode.value === 'classic' ? (c.narrow && cells.length > 1 ? 'minmax(0, 0.95fr)' : 'minmax(0, 1fr)') : (cells.length > 1 && c.modules.some(m => m.id === 'recentA') && c.modules.some(m => m.id === 'recentB') ? 'minmax(0, 1.5fr)' : c.narrow && cells.length > 1 ? 'minmax(0, 0.85fr)' : 'minmax(0, 1fr)')).join(' '),
        }
      })
      .filter((r) => r.cells.length),
  )

  function moveTo(id: HomeModuleId, target: HomeDropTarget) {
    if (target.anchor === id) return
    const rows: HomeRow[] = state.value.rows.map((row) => row.map((cell) => [...cell]))
    const from = locate(rows, id)
    if (!from) return
    rows[from.ri][from.ci].splice(from.mi, 1)
    const cleaned = rows.map((row) => row.filter((cell) => cell.length)).filter((row) => row.length)

    if (target.kind === 'row' && target.anchor == null) {
      cleaned.push([[id]])
    } else {
      const at = locate(cleaned, target.anchor!)
      if (!at) return
      if (target.kind === 'row') {
        cleaned.splice(at.ri, 0, [[id]])
      } else if (target.kind === 'side' && cleaned[at.ri].length < HOME_MAX_CELLS_PER_ROW) {
        cleaned[at.ri].splice(at.ci + (target.after ? 1 : 0), 0, [id])
      } else {
        cleaned[at.ri][at.ci].splice(at.mi + (target.after ? 1 : 0), 0, id)
      }
    }
    state.value.rows = cleaned
  }

  function canAddCell(anchor: HomeModuleId, dragging: HomeModuleId | null) {
    const at = locate(state.value.rows, anchor)
    if (!at) return false
    const row = state.value.rows[at.ri]
    const leaving = dragging ? locate(state.value.rows, dragging) : null
    const freesCell = leaving && leaving.ri === at.ri && row[leaving.ci].length === 1
    return row.length < HOME_MAX_CELLS_PER_ROW || Boolean(freesCell)
  }

  function toggle(id: HomeModuleId) {
    state.value.hidden[id] = !state.value.hidden[id]
  }

  /** 只作用于首页自身模块，侧边栏模块的显隐保持不变 */
  function applyPreset(visibleCount: number) {
    const core = orderedModules.value.filter((m) => !m.sidebarId)
    const hidden = { ...state.value.hidden }
    core.forEach((m, i) => {
      hidden[m.id] = i >= visibleCount
    })
    state.value.hidden = hidden
  }

  function reset() {
    state.value = defaultHomeLayout(mode.value)
    saveCollapsed([])
  }

  function resetPositions() {
    state.value.rows = defaultHomeLayout(mode.value).rows
  }

  function setMode(next: HomeVariant) {
    if ((next !== 'classic' && next !== 'compact') || next === mode.value) return
    layouts[mode.value] = copy(state.value)
    state.value = copy(layouts[next] || defaultHomeLayout(next))
    mode.value = next
    editing.value = false
  }

  function isHidden(id: HomeModuleId) {
    return Boolean(state.value.hidden[id])
  }

  return {
    state,
    mode,
    setMode,
    restore,
    editing,
    collapsed,
    toggleCollapsed,
    orderedModules,
    visibleRows,
    moveTo,
    canAddCell,
    toggle,
    applyPreset,
    reset,
    resetPositions,
    isHidden,
  }
})
