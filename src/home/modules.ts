import { CHAT_SIDEBAR_META, type ChatSidebarModuleId } from '@/chat/sidebar/meta'

export type HomeCoreModuleId = 'recentA' | 'recentB' | 'rank' | 'long' | 'chat' | 'hotQna' | 'community'

/** 聊天室侧边栏模块复用到首页时的 id */
export type HomeSideModuleId = `side:${ChatSidebarModuleId}`

export type HomeModuleId = HomeCoreModuleId | HomeSideModuleId

/** narrow：侧栏类模块，所在列略窄 */
export type HomeModuleWidth = 'wide' | 'narrow'

export interface HomeModuleMeta {
  id: HomeModuleId
  title: string
  width: HomeModuleWidth
  defaultHidden?: boolean
  /** 来自聊天室侧边栏的模块 id */
  sidebarId?: ChatSidebarModuleId
}

const SIDE_MODULES: HomeModuleMeta[] = CHAT_SIDEBAR_META.filter((m) => m.portable).map((m) => ({
  id: `side:${m.id}` as HomeSideModuleId,
  title: m.title,
  width: 'narrow',
  defaultHidden: !m.homeDefaultOn,
  sidebarId: m.id,
}))

export const HOME_MODULES: HomeModuleMeta[] = [
  { id: 'recentA', title: '最新一', width: 'wide' },
  { id: 'recentB', title: '最新二', width: 'wide' },
  { id: 'rank', title: '排行', width: 'narrow' },
  { id: 'long', title: '长篇专区', width: 'wide' },
  { id: 'chat', title: '聊天室', width: 'wide' },
  { id: 'hotQna', title: '热议问答', width: 'wide' },
  { id: 'community', title: '社区', width: 'narrow' },
  ...SIDE_MODULES,
]

export const HOME_MODULE_IDS = new Set<string>(HOME_MODULES.map((m) => m.id))

/** 一列内自上而下堆叠的模块 */
export type HomeCell = HomeModuleId[]
/** 一行内自左向右的列 */
export type HomeRow = HomeCell[]

export const HOME_MAX_CELLS_PER_ROW = 4

export const HOME_LAYOUT_STORAGE = 'fishpi.home.layout.v2'
export const HOME_LAYOUT_STORAGE_V1 = 'fishpi.home.modules.v1'

export interface HomeLayoutState {
  hidden: Record<string, boolean>
  rows: HomeRow[]
}

/** 对齐现网：最新两栏 + 排行 / 长篇专区 / 聊天室 + 热议 + 社区 */
export function defaultHomeRows(): HomeRow[] {
  return [
    [['recentA'], ['recentB'], [...SIDE_MODULES.map((m) => m.id), 'rank']],
    [['long']],
    [['chat'], ['hotQna'], ['community']],
  ]
}

export function defaultHomeLayout(): HomeLayoutState {
  return {
    hidden: Object.fromEntries(HOME_MODULES.filter((m) => m.defaultHidden).map((m) => [m.id, true])),
    rows: defaultHomeRows(),
  }
}

/** 去掉未知/重复 id 与空列空行；新增模块按默认位置补回 */
export function normalizeRows(input: unknown): HomeRow[] {
  const seen = new Set<string>()
  const rows: HomeRow[] = []
  if (Array.isArray(input)) {
    for (const row of input) {
      if (!Array.isArray(row)) continue
      const cells: HomeRow = []
      for (const cell of row) {
        if (!Array.isArray(cell)) continue
        const ids = cell.filter(
          (id): id is HomeModuleId => typeof id === 'string' && HOME_MODULE_IDS.has(id) && !seen.has(id),
        )
        ids.forEach((id) => seen.add(id))
        if (ids.length) cells.push(ids)
      }
      if (cells.length) rows.push(cells)
    }
  }
  if (!rows.length) return defaultHomeRows()

  const defaults = defaultHomeRows()
  for (const m of HOME_MODULES) {
    if (seen.has(m.id)) continue
    const neighbours = defaults.flat().find((cell) => cell.includes(m.id))?.filter((id) => id !== m.id) || []
    const host = rows.flat().find((cell) => cell.some((id) => neighbours.includes(id)))
    if (host) host.unshift(m.id)
    else rows.push([[m.id]])
    seen.add(m.id)
  }
  return rows
}
