import type { Router, RouteLocationRaw } from 'vue-router'

export type HomeRedirect = { kind: 'none' } | { kind: 'unsupported' } | { kind: 'target'; path: string }

/** Only configured site origins; loopback aliases support the local IPv4/IPv6 API proxy. */
export function homeRedirectBases(site: string, api: string | undefined, current: string): string[] {
  const bases = [site, current]
  if (api) {
    bases.push(api)
    try {
      const url = new URL(api)
      if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
        for (const host of ['localhost', '127.0.0.1', '[::1]']) {
          const alias = new URL(url); alias.hostname = host; bases.push(alias.toString())
        }
      }
    } catch { /* An invalid configuration never authorizes an origin. */ }
  }
  return [...new Set(bases)]
}

/** Resolve through the existing router, including aliases, without navigating to a classic/external site. */
export function homeRedirectDestination(value: string, router: Pick<Router, 'resolve' | 'currentRoute'>, bases: string[]): HomeRedirect {
  if (!value) return { kind: 'none' }
  if (value.length > 255 || /[\s\u0000-\u001f\u007f\\]/.test(value)) return { kind: 'unsupported' }
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return { kind: 'unsupported' }
    const base = bases.map(source => { try { return new URL(source) } catch { return null } })
      .filter((candidate): candidate is URL => !!candidate && candidate.origin === url.origin && !candidate.username && !candidate.password)
      .map(candidate => candidate.pathname.replace(/\/+$/, '')).sort((a, b) => b.length - a.length)
      .find(prefix => !prefix || url.pathname === prefix || url.pathname.startsWith(prefix + '/'))
    if (base === undefined) return { kind: 'unsupported' }
    let path = url.pathname.slice(base.length) || '/'
    for (let round = 0; round <= value.length; round++) {
      if (path.startsWith('//') || /[\u0000-\u001f\u007f\\]/.test(path)) return { kind: 'unsupported' }
      const decoded = decodeURIComponent(path)
      if (decoded === path) break
      path = decoded
    }
    let target: RouteLocationRaw = (url.pathname.slice(base.length) || '/') + url.search + url.hash
    const visited = new Set<string>()
    for (let i = 0; i < 12; i++) {
      const resolved: ReturnType<Router['resolve']> = router.resolve(target)
      if (!resolved.matched.length || resolved.matched.some(record => record.name === 'not-found' || record.path.includes(':pathMatch'))) return { kind: 'unsupported' }
      if (visited.has(resolved.fullPath)) return { kind: 'unsupported' }
      visited.add(resolved.fullPath)
      const redirect = resolved.matched.at(-1)?.redirect
      if (redirect) {
        const next: RouteLocationRaw = typeof redirect === 'function' ? redirect(resolved, router.currentRoute.value) : redirect
        if (typeof next === 'string') {
          const location = router.resolve(next)
          target = { path: location.path, query: next.includes('?') ? location.query : resolved.query, hash: next.includes('#') ? location.hash : resolved.hash }
        } else target = { query: resolved.query, hash: resolved.hash, ...next }
        continue
      }
      return resolved.fullPath === '/' ? { kind: 'none' } : { kind: 'target', path: resolved.fullPath }
    }
  } catch { /* Malformed and unsupported stored values leave the home page available. */ }
  return { kind: 'unsupported' }
}
