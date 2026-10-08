/** Public content routes worth data prefetch + indexable HTML. */
export function shouldPrefetchSsr(path: string) {
  const p = path.split('?')[0] || '/'
  if (p === '/') return true
  if (/^\/article\/[^/]+$/.test(p)) return true
  if (/^\/member\/[^/]+$/.test(p)) return true
  if (
    p === '/hot' ||
    p === '/recent' ||
    p === '/recent/long' ||
    p === '/column' ||
    p === '/qna' ||
    p === '/perfect' ||
    p === '/good' ||
    p === '/domains' ||
    p === '/tags' ||
    p === '/breezemoons' ||
    p === '/top' ||
    p === '/top/checkin' ||
    p === '/top/online' ||
    p === '/top/balance' ||
    p === '/top/consumption' ||
    p === '/repeater' ||
    p === '/download' ||
    p === '/activity' ||
    p === '/following' ||
    p === '/agreement' ||
    p === '/privacy'
  ) {
    return true
  }
  if (/^\/domain\/[^/]+$/.test(p)) return true
  if (/^\/tags\/[^/]+$/.test(p)) return true
  return false
}

export function isNoIndexPath(path: string) {
  const p = path.split('?')[0] || '/'
  if (p === '/search') return true
  if (
    p === '/login' ||
    p === '/register' ||
    p === '/settings' ||
    p === '/notifications' ||
    p === '/chat' ||
    p.startsWith('/chat/') ||
    p === '/cr' ||
    p === '/stars' ||
    p === '/points' ||
    p === '/logs' ||
    p === '/post' ||
    p.startsWith('/post/')
  ) {
    return true
  }
  return false
}
