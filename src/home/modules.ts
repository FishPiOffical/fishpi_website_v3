export type HomeModuleId =
  | 'recentA'
  | 'recentB'
  | 'rank'
  | 'long'
  | 'chat'
  | 'hotQna'
  | 'community'

export type HomeZoneId = 'top' | 'long' | 'middle'

export interface HomeModuleMeta {
  id: HomeModuleId
  title: string
  zone: HomeZoneId
}

/** Live default order / zones (fishpi.cn home-modules). */
export const HOME_MODULES: HomeModuleMeta[] = [
  { id: 'recentA', title: '最新一', zone: 'top' },
  { id: 'recentB', title: '最新二', zone: 'top' },
  { id: 'rank', title: '排行', zone: 'top' },
  { id: 'long', title: '长篇专区', zone: 'long' },
  { id: 'chat', title: '聊天室', zone: 'middle' },
  { id: 'hotQna', title: '热议问答', zone: 'middle' },
  { id: 'community', title: '社区', zone: 'middle' },
]

export const HOME_LAYOUT_STORAGE = 'fishpi.home.modules.v1'

export interface HomeLayoutState {
  hidden: Record<string, boolean>
  order: string[]
  zones: Record<string, HomeZoneId>
}

export const EMPTY_HOME_LAYOUT: HomeLayoutState = {
  hidden: {},
  order: [],
  zones: {},
}

export function defaultHomeLayout(): HomeLayoutState {
  return {
    hidden: {},
    order: HOME_MODULES.map((m) => m.id),
    zones: Object.fromEntries(HOME_MODULES.map((m) => [m.id, m.zone])),
  }
}
