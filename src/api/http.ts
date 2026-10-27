import { ensureRiskCaptcha } from '@/utils/riskCaptcha'

export const FISHPI_UA =
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'

export class ApiError extends Error {
  status: number
  /** captcha：Rhythm 风控要求人机验证（302 → /test） */
  code?: string
  constructor(message: string, status = 0, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

// Browser-only transport state. SSR requests never read or mutate a shared identity.
let accessToken: string | null = null
let authVersion = 0
let refreshRejected = false
let refreshFlight: { version: number; promise: Promise<boolean> } | null = null
let credentialQueue: Promise<unknown> = Promise.resolve()
const tokenListeners = new Set<(token: string | null) => void>()

function publishToken(token: string | null) {
  if (import.meta.env.SSR) return
  accessToken = token
  for (const listener of tokenListeners) listener(token)
}

/** Start a new identity boundary before login/logout, invalidating older refreshes. */
export function setAccessToken(token: string | null) {
  if (import.meta.env.SSR) return
  authVersion++
  refreshRejected = false
  publishToken(token)
}

/** Stable identity boundary: ordinary access-token refresh does not change this revision. */
export function getAuthContextVersion() { return import.meta.env.SSR ? 0 : authVersion }

export function getAccessToken() {
  return import.meta.env.SSR ? null : accessToken
}

export function wasRefreshRejected() {
  return !import.meta.env.SSR && refreshRejected
}

export function onAccessTokenChange(listener: (token: string | null) => void) {
  if (import.meta.env.SSR) return () => {}
  tokenListeners.add(listener)
  listener(accessToken)
  return () => { tokenListeners.delete(listener) }
}

function isV3Path(path: string) {
  return /^\/api\/v3(?:\/|$)/.test(path)
}

function isCredentialPath(path: string) {
  return /^\/api\/v3\/auth\/(?:login|refresh|logout)(?:\?|$)/.test(path)
}

// Cookie rotations must complete in order, including logout followed immediately by login.
function queueCredentialRequest<T>(run: () => Promise<T>): Promise<T> {
  const next = credentialQueue.then(run, run)
  credentialQueue = next.catch(() => {})
  return next
}

export async function refreshAccessToken(): Promise<boolean> {
  if (import.meta.env.SSR) return false
  const version = authVersion
  if (refreshFlight?.version === version) return refreshFlight.promise
  const promise = request<{ code: number; data?: { accessToken?: string } }>('/api/v3/auth/refresh', {
    method: 'POST', __authVersion: version,
  }).then((body) => {
    if (version !== authVersion) return false
    const token = body.code === 0 && typeof body.data?.accessToken === 'string' ? body.data.accessToken : null
    if (!token) throw new ApiError('刷新响应缺少访问凭据', 502, 'invalid_response')
    publishToken(token)
    return true
  }).catch((error: unknown) => {
    // A temporary transport or captcha failure must not erase a usable identity.
    if (version === authVersion && error instanceof ApiError && error.status === 401) {
      refreshRejected = true
      publishToken(null)
    }
    return false
  }).finally(() => {
    if (refreshFlight?.promise === promise) refreshFlight = null
  })
  refreshFlight = { version, promise }
  return promise
}

export function isCaptchaRequired(e: unknown) {
  return e instanceof ApiError && e.code === 'captcha'
}

export function isOfflineError(e: unknown) {
  return e instanceof ApiError && (e.code === 'offline' || e.status === 0)
}

function notifyOffline() {
  if (import.meta.env.SSR || typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('fp:api-offline'))
}

function asNetworkError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e)
  if (/Failed to fetch|NetworkError|Load failed|network|ECONNREFUSED|ETIMEDOUT|fetch|aborted/i.test(msg)) {
    notifyOffline()
    throw new ApiError('无法连接摸鱼派接口，请检查网络或稍后重试', 0, 'offline')
  }
  throw e instanceof Error ? e : new Error(msg)
}

/** 探测后端是否可达（能拿到任意 HTTP 响应即视为连通，含 4xx）。 */
export async function pingApi(timeoutMs = 8000): Promise<boolean> {
  if (import.meta.env.SSR) return true
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(resolveUrl('/api/articles/recent?p=1&size=1'), {
      method: 'GET',
      credentials: 'include',
      headers: { 'User-Agent': FISHPI_UA },
      signal: ctrl.signal,
    })
    // 连上了就行；5xx 仍算「服务异常」但不是「完全连不上」
    return res.status > 0
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

type RequestInitExtra = RequestInit & {
  /** 内部：人机验证通过后已重试过，避免死循环 */
  __captchaRetried?: boolean
  /** Internal: an expired v3 access token has already been refreshed once. */
  __v3Retried?: boolean
  __authVersion?: number
  __zip?: boolean
}

function apiBase() {
  if (!import.meta.env.SSR) return ''
  const fromProcess =
    typeof globalThis !== 'undefined' &&
    'process' in globalThis &&
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  const fromEnv =
    (fromProcess && (fromProcess.VITE_API_TARGET || fromProcess.API_TARGET)) ||
    import.meta.env.VITE_API_TARGET ||
    'https://fishpi.cn'
  return String(fromEnv).replace(/\/$/, '')
}

function resolveUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path
  const base = apiBase()
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : path
}

function isJsonContentType(value: string | null) {
  return Boolean(value && value.includes('application/json'))
}

function isRiskCaptchaPath(path: string) {
  return path.includes('/validateCaptcha') || /(^|\/)test(\?|$)/.test(path)
}

async function requestOnce<T = unknown>(path: string, init: RequestInitExtra = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('User-Agent')) headers.set('User-Agent', FISHPI_UA)
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (!import.meta.env.SSR && isV3Path(path) && !isCredentialPath(path) && accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const { __captchaRetried: _, __v3Retried: __, __authVersion: ___, __zip: ____, ...fetchInit } = init
  let res: Response
  try {
    res = await fetch(resolveUrl(path), {
      ...fetchInit,
      credentials: init.credentials ?? 'include',
      headers,
    })
  } catch (e) {
    if (init.signal?.aborted) throw new ApiError('请求已取消', 0, 'aborted')
    asNetworkError(e)
  }

  // Rhythm BeforeRequestHandler：IP 进入验证码黑名单时 302 → /test
  try {
    const pathname = new URL(res.url).pathname
    if (/^\/test\/?$/.test(pathname)) {
      throw new ApiError('访问过于频繁，请完成人机验证后再试', 302, 'captcha')
    }
  } catch (e) {
    if (e instanceof ApiError) throw e
  }

  if (init.__zip && res.ok && res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() === 'application/zip') {
    const declared = res.headers.get('content-length')
    if (declared && (!/^[0-9]+$/.test(declared) || Number(declared) > MAX_PRIVATE_ZIP_BYTES)) { await res.body?.cancel(); throw new ApiError('导出文件大小异常', 502, 'invalid_response') }
    const reader = res.body?.getReader()
    if (!reader) throw new ApiError('导出文件为空', 502, 'invalid_response')
    const parts: ArrayBuffer[] = []; let bytes = 0
    try { while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > MAX_PRIVATE_ZIP_BYTES) { await reader.cancel(); throw new ApiError('导出文件大小异常', 502, 'invalid_response') } parts.push(new Uint8Array(value).buffer) } }
    finally { reader.releaseLock() }
    if (!bytes) throw new ApiError('导出文件为空', 502, 'invalid_response')
    return new Blob(parts, { type: 'application/zip' }) as T
  }

  const text = await res.text()
  const looksJson = isJsonContentType(res.headers.get('content-type')) || text.startsWith('{') || text.startsWith('[')
  if (!looksJson) {
    throw new ApiError(res.status === 401 ? '需要登录或完成验证码后才能调用接口' : '接口返回了非 JSON', res.status)
  }

  let data: T
  try {
    data = JSON.parse(text) as T
  } catch {
    throw new ApiError('无法解析接口响应', res.status)
  }

  if (!res.ok) {
    const msg = typeof data === 'object' && data && 'msg' in data ? String((data as { msg?: string }).msg) : res.statusText
    const code = typeof data === 'object' && data && 'code' in data ? String((data as { code?: string | number }).code) : undefined
    throw new ApiError(msg || '请求失败', res.status, code)
  }

  if (init.__zip) throw new ApiError('接口未返回ZIP文件', 502, 'invalid_response')

  return data
}

/** Bound to the current private export service's ZIP budget. */
export const MAX_PRIVATE_ZIP_BYTES = 32 * 1024 * 1024
export function requestZip(path: string, init: RequestInit = {}): Promise<Blob> { return request<Blob>(path, { ...init, __zip: true }) }

export async function request<T = unknown>(path: string, init: RequestInitExtra = {}): Promise<T> {
  const version = authVersion
  const sentToken = getAccessToken()
  const explicitAuthorization = new Headers(init.headers).has('Authorization')
  const run = () => {
    if (init.__authVersion !== undefined && init.__authVersion !== authVersion) {
      throw new ApiError('登录状态已变更', 401, 'stale_session')
    }
    return requestOnce<T>(path, init)
  }
  try {
    return await (!import.meta.env.SSR && isCredentialPath(path) ? queueCredentialRequest(run) : run())
  } catch (e) {
    if (!import.meta.env.SSR && isV3Path(path) && !isCredentialPath(path) && !explicitAuthorization &&
      e instanceof ApiError && e.status === 401 && !init.__v3Retried && version === authVersion) {
      // A late 401 may belong to the token that another request has already rotated.
      const refreshed = getAccessToken() !== sentToken && Boolean(getAccessToken()) || await refreshAccessToken()
      if (refreshed && version === authVersion) return request<T>(path, { ...init, __v3Retried: true })
    }
    if (!import.meta.env.SSR && isV3Path(path) && !isCredentialPath(path) && !explicitAuthorization &&
      init.__v3Retried && version === authVersion && sentToken === getAccessToken() &&
      e instanceof ApiError && e.status === 401) publishToken(null)
    if (!import.meta.env.SSR && isCaptchaRequired(e) && !init.__captchaRetried && !isRiskCaptchaPath(path)) {
      await ensureRiskCaptcha()
      if (version !== authVersion) throw e
      return request<T>(path, { ...init, __captchaRetried: true })
    }
    throw e
  }
}

export async function requestText(path: string, init: RequestInitExtra = {}): Promise<string> {
  try {
    return await requestTextOnce(path, init)
  } catch (e) {
    if (
      !import.meta.env.SSR &&
      isCaptchaRequired(e) &&
      !init.__captchaRetried &&
      !isRiskCaptchaPath(path)
    ) {
      await ensureRiskCaptcha()
      return requestTextOnce(path, { ...init, __captchaRetried: true })
    }
    throw e
  }
}

async function requestTextOnce(path: string, init: RequestInitExtra = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('User-Agent')) headers.set('User-Agent', FISHPI_UA)
  const { __captchaRetried: _, ...fetchInit } = init
  let res: Response
  try {
    res = await fetch(resolveUrl(path), {
      ...fetchInit,
      credentials: init.credentials ?? 'include',
      headers,
    })
  } catch (e) {
    asNetworkError(e)
  }
  try {
    const pathname = new URL(res.url).pathname
    if (/^\/test\/?$/.test(pathname)) {
      throw new ApiError('访问过于频繁，请完成人机验证后再试', 302, 'captcha')
    }
  } catch (e) {
    if (e instanceof ApiError) throw e
  }
  const text = await res.text()
  if (!res.ok) throw new ApiError(text.slice(0, 120) || '请求失败', res.status)
  return text
}

export function withKey(path: string, apiKey?: string | null) {
  if (!apiKey) return path
  const join = path.includes('?') ? '&' : '?'
  return `${path}${join}apiKey=${encodeURIComponent(apiKey)}`
}
