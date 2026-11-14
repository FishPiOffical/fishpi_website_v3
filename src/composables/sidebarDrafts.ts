import { inject, onScopeDispose, provide, watch, type InjectionKey } from 'vue'

interface SidebarDraftEntry<T = unknown> {
  state: T
  clear: () => void
}

interface SidebarDraftScope {
  obtain: <T>(moduleId: string, create: () => SidebarDraftEntry<T>) => T | undefined
}

const sidebarDraftKey: InjectionKey<SidebarDraftScope> = Symbol('sidebar-drafts')

/** 草稿只属于当前侧栏实例；模块在卡片和标签之间移动时复用，不持久化私人文本。 */
export function provideSidebarDrafts(identity: () => string, enabledModuleIds: () => readonly string[]) {
  const entries = new Map<string, SidebarDraftEntry>()
  function clear(moduleId: string) {
    const entry = entries.get(moduleId)
    entries.delete(moduleId)
    entry?.clear()
  }
  function clearAll() {
    for (const moduleId of entries.keys()) clear(moduleId)
  }

  watch(identity, clearAll, { flush: 'sync' })
  watch(() => [...enabledModuleIds()], enabled => {
    const allowed = new Set(enabled)
    for (const moduleId of entries.keys()) if (!allowed.has(moduleId)) clear(moduleId)
  }, { flush: 'sync' })
  onScopeDispose(clearAll)

  provide(sidebarDraftKey, {
    obtain<T>(moduleId: string, create: () => SidebarDraftEntry<T>) {
      if (!enabledModuleIds().includes(moduleId)) return undefined
      let entry = entries.get(moduleId)
      if (!entry) {
        entry = create()
        entries.set(moduleId, entry)
      }
      return entry.state as T
    },
  })
}

/** 没有侧栏上下文时不接管原组件的草稿生命周期。 */
export function useSidebarDraftState<T>(moduleId: string, create: () => SidebarDraftEntry<T>): T | undefined {
  return inject(sidebarDraftKey, undefined)?.obtain(moduleId, create)
}
