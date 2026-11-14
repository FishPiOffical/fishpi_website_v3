export type SidebarPresentation = 'card' | 'tabs'
export type SidebarPresentationMap = Partial<Record<string, SidebarPresentation>>

export type SidebarGroup<T> =
  | { kind: 'card'; module: T }
  | { kind: 'tabs'; modules: T[] }

/** 旧偏好没有展示位置时沿用标签模式；资料卡始终独立展示。 */
export function sidebarPresentationOf(id: string, presentation: SidebarPresentationMap): SidebarPresentation {
  return id === 'profile' || presentation[id] === 'card' ? 'card' : 'tabs'
}

export function normalizeSidebarIds<Id extends string>(value: unknown, knownIds: readonly Id[]): Id[] {
  if (!Array.isArray(value)) return []
  const known = new Set<string>(knownIds)
  return [...new Set(value.filter((id): id is Id => typeof id === 'string' && known.has(id)))]
}

export function normalizeSidebarPresentation(value: unknown, knownIds: readonly string[]): SidebarPresentationMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const known = new Set(knownIds)
  return Object.fromEntries(Object.entries(value).filter(([id, mode]) =>
    known.has(id) && id !== 'profile' && (mode === 'card' || mode === 'tabs'),
  ))
}

/** 标签集中在第一个标签模块的位置，独立卡片之间继续遵循用户排序。 */
export function groupSidebarModules<T extends { id: string }>(
  modules: readonly T[],
  presentationOf: (id: string) => SidebarPresentation,
): SidebarGroup<T>[] {
  const groups: SidebarGroup<T>[] = []
  const profile = modules.find(mod => mod.id === 'profile')
  if (profile) groups.push({ kind: 'card', module: profile })
  const remaining = modules.filter(mod => mod.id !== 'profile')
  const tabs = remaining.filter(mod => presentationOf(mod.id) === 'tabs')
  let insertedTabs = false
  for (const mod of remaining) {
    if (presentationOf(mod.id) === 'card') {
      groups.push({ kind: 'card', module: mod })
    } else if (!insertedTabs) {
      groups.push({ kind: 'tabs', modules: tabs })
      insertedTabs = true
    }
  }
  return groups
}
