/** 跳转到独立「连不上后端」页，并带上当前路径便于恢复。 */
export function goOfflinePage(from?: string) {
  if (import.meta.env.SSR || typeof window === 'undefined') return
  const path = window.location.pathname + window.location.search
  if (path === '/offline' || path.startsWith('/error/offline')) return
  const q = new URLSearchParams()
  q.set('from', from || path || '/')
  window.location.assign(`/offline?${q.toString()}`)
}
