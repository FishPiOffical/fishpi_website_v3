export type ApiMode = 'v1' | 'v3'
export const API_MODE_COOKIE = 'fp.apiMode'
export function parseApiMode(cookie: string, fallback: ApiMode = 'v3'): ApiMode {
  const value = cookie.split(';').map(x => x.trim()).find(x => x.startsWith(API_MODE_COOKIE + '='))?.slice(API_MODE_COOKIE.length + 1)
  return value === 'v1' || value === 'v3' ? value : fallback
}
export function defaultApiMode(): ApiMode { return import.meta.env.VITE_API_MODE === 'v1' ? 'v1' : 'v3' }
let serverMode: (() => ApiMode) | undefined
// A fixed AsyncLocalStorage reader is installed by the SSR entry; never store request state here.
export function setServerModeReader(reader: () => ApiMode) { serverMode = reader }
export function getApiMode(): ApiMode {
  return import.meta.env.SSR ? serverMode?.() || defaultApiMode() : parseApiMode(document.cookie, defaultApiMode())
}
export function switchApiMode(mode: ApiMode) {
  if (import.meta.env.SSR || mode === getApiMode()) return
  document.cookie = `${API_MODE_COOKIE}=${mode}; Path=/; SameSite=Lax; Max-Age=31536000${location.protocol === 'https:' ? '; Secure' : ''}`
  if(typeof BroadcastChannel!=='undefined') { const channel=new BroadcastChannel('fp.apiMode');channel.postMessage(mode);channel.close() }
  // Full reload disposes every Pinia store, in-flight operation and WebSocket before the other protocol starts.
  location.reload()
}

/** Other tabs must not keep credentials/connections from a mode whose cookie changed. */
export function installModeSync() {
  if(import.meta.env.SSR) return () => {}
  const initial=getApiMode()
  const check=()=>{if(getApiMode()!==initial) location.reload()}
  const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('fp.apiMode')
  if(channel) channel.onmessage=check
  window.addEventListener('focus',check)
  document.addEventListener('visibilitychange',check)
  return ()=>{channel?.close();window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check)}
}
