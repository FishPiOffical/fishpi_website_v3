import { ensureRiskCaptcha } from '@/utils/riskCaptcha'

export const FISHPI_UA =
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'

export class ApiError extends Error {
  status: number
  /** captcha：Rhythm 风控要求人机验证（302 → /test） */
  code?: string
  retryAfter?: string
  readonly diagnosticMessage?: string
  constructor(message: string, status = 0, code?: string) {
    const invalidResponse = code === 'invalid_response' || status === 502 && !code
    super(invalidResponse ? '服务暂不可用，请稍后重试' : message)
    if (invalidResponse) this.diagnosticMessage = message
    this.status = status
    this.code = code
  }
}

type SsrReadGate = <T>(load: () => Promise<T>) => Promise<T>
let ssrReadGate: SsrReadGate | undefined
export function setSsrReadGate(gate: SsrReadGate) {
  if (import.meta.env.SSR) ssrReadGate = gate
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
  publicListFlights.clear()
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

let homeReadsActive = false
let homeReadGeneration = 0
let homeReadQueue: Promise<unknown> = Promise.resolve()
let nextHomeReadAt = 0
let homeReadInFlight: Promise<unknown> | null = null
let homePriorityRead: Promise<unknown> | null = null
let homeSessionRestore: Promise<unknown> | null = null
let homeReadPause: { until: number; message: string } | null = null
const HOME_READ_PAUSE_KEY = 'fp.home-read-pause-until'

export function setHomeReadsActive(active: boolean) {
  if (homeReadsActive === active) return
  homeReadsActive = active
  homeReadGeneration++
  if (active && !homeReadPause) {
    try {
      const until = Number(window.sessionStorage.getItem(HOME_READ_PAUSE_KEY))
      if (Number.isFinite(until) && until > Date.now()) {
        homeReadPause = { until, message: '首页读取仍在暂停中。' }
      }
    } catch { /* Storage may be disabled. */ }
  }
}

export function getHomeReadPause() { return homeReadPause }

/** Keep the homepage queue behind the cookie refresh and account read as one operation. */
export function withHomeSessionPriority<T>(restore: () => Promise<T>): Promise<T> {
  if (!homeReadsActive) return restore()
  const flight = Promise.resolve().then(restore)
  const barrier = flight.catch(() => {}).finally(() => {
    if (homeSessionRestore === barrier) homeSessionRestore = null
  })
  homeSessionRestore = barrier
  return flight
}

export function resumeHomeReads() {
  if (!homeReadPause || Date.now() < homeReadPause.until) return false
  homeReadPause = null
  homeReadGeneration++
  try { window.sessionStorage.removeItem(HOME_READ_PAUSE_KEY) } catch { /* Storage may be disabled. */ }
  window.dispatchEvent(new Event('fp:home-reads-paused'))
  return true
}

function queueHomeRead<T>(path: string, init: RequestInitExtra, run: () => Promise<T>, priority: boolean): Promise<T> {
  const generation = homeReadGeneration, version = authVersion
  const sessionRead = priority || path === '/api/v3/me/membership'
  const check = () => {
    if ((!sessionRead && generation !== homeReadGeneration) || (init.credentials !== 'omit' && version !== authVersion) || init.signal?.aborted) {
      throw new ApiError('请求已取消', 0, 'aborted')
    }
    if (homeReadPause) throw new ApiError(homeReadPause.message, 0, 'home_reads_paused')
  }
  const execute = async () => {
    while (true) {
      check()
      const blocker = (!priority && (homeSessionRestore || homePriorityRead)) || homeReadInFlight
      if (blocker) {
        await blocker
        continue
      }
      const wait = nextHomeReadAt - Date.now()
      if (wait <= 0) break
      await new Promise(resolve => setTimeout(resolve, wait))
    }
    nextHomeReadAt = Date.now() + 250
    const request = Promise.resolve().then(run)
    const inFlight = request.catch(() => {})
    homeReadInFlight = inFlight
    try {
      return await request
    } catch (error) {
      // Rhythm uses structured unauthorized when a visitor has no refresh cookie.
      const guestRefresh = path === '/api/v3/auth/refresh' && !accessToken &&
        error instanceof ApiError && error.status === 401 && error.code === 'unauthorized'
      if (generation === homeReadGeneration && version === authVersion && !guestRefresh &&
        error instanceof ApiError && (error.status === 401 || error.status === 429 || error.code === 'offline' || isCaptchaRequired(error))) {
        const now = Date.now()
        const header = error.retryAfter
        const retryAt = header && /^\d+$/.test(header) ? now + Number(header) * 1000 : Date.parse(header ?? '')
        homeReadPause = {
          until: Math.max(now + (error.status === 429 ? 60_000 : 15_000), Number.isFinite(retryAt) ? retryAt : 0),
          message: error.status === 429 ? '请求过于频繁，首页已暂停读取。'
            : error.code === 'offline' ? '连接暂不可用，首页已暂停读取。' : '访问暂时受限，首页已暂停读取。',
        }
        try { window.sessionStorage.setItem(HOME_READ_PAUSE_KEY, String(homeReadPause.until)) } catch { /* Storage may be disabled. */ }
        window.dispatchEvent(new Event('fp:home-reads-paused'))
        throw new ApiError(homeReadPause.message, 0, 'home_reads_paused')
      }
      throw error
    } finally {
      if (homeReadInFlight === inFlight) homeReadInFlight = null
    }
  }
  if (priority) {
    const next = (homePriorityRead ?? Promise.resolve()).then(execute)
    const barrier = next.catch(() => {}).finally(() => {
      if (homePriorityRead === barrier) homePriorityRead = null
    })
    homePriorityRead = barrier
    return next
  }
  const next = homeReadQueue.then(() => execute())
  homeReadQueue = next.catch(() => {})
  return next
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
  return e instanceof ApiError && (e.code === 'offline' || (e.status === 0 && e.code !== 'aborted'))
}

type RequestIdentity = { version: number; authenticated: boolean }
function requestIdentity(): RequestIdentity {
  return { version: getAuthContextVersion(), authenticated: Boolean(getAccessToken()) }
}
function notifyOffline(identity: RequestIdentity) {
  if (import.meta.env.SSR || typeof window === 'undefined' || identity.version !== authVersion ||
    identity.authenticated !== Boolean(accessToken)) return
  window.dispatchEvent(new CustomEvent('fp:api-offline'))
}

function asNetworkError(e: unknown, identity: RequestIdentity): never {
  const msg = e instanceof Error ? e.message : String(e)
  if (/Failed to fetch|NetworkError|Load failed|network|ECONNREFUSED|ETIMEDOUT|fetch|aborted/i.test(msg)) {
    notifyOffline(identity)
    throw new ApiError('无法连接摸鱼派，请检查网络或稍后重试', 0, 'offline')
  }
  throw e instanceof Error ? e : new Error(msg)
}

/** 仅完整、成功的 v3 JSON 响应表示服务恢复；代理自身的 HTTP 响应不算。 */
export async function pingApi(timeoutMs = 8000): Promise<boolean> {
  if (import.meta.env.SSR) return true
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(resolveUrl('/api/v3/auth/captcha-options'), {
      method: 'GET',
      credentials: 'include',
      signal: ctrl.signal,
    })
    if (!res.ok || res.redirected || !isJsonContentType(res.headers.get('content-type'))) return false
    const body = await res.json()
    return body?.code === 0 && body?.data?.provider === 'geetest4' &&
      typeof body.data.captchaId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(body.data.captchaId)
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
  __svg?: boolean
  __zip?: boolean
}

function apiBase() {
  if (!import.meta.env.SSR) return String(import.meta.env?.VITE_BROWSER_API_ORIGIN || '').replace(/\/$/, '')
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

/** Headers may arrive before the connection fails; never accept a partial response body. */
async function readNetworkBody<T>(read: () => Promise<T>, signal: AbortSignal | null | undefined, identity: RequestIdentity): Promise<T> {
  try {
    return await read()
  } catch {
    if (signal?.aborted) throw new ApiError('请求已取消', 0, 'aborted')
    notifyOffline(identity)
    throw new ApiError('连接中断，请检查网络或稍后重试', 0, 'offline')
  }
}

function isJsonContentType(value: string | null) {
  return Boolean(value && value.includes('application/json'))
}

function checkGateway(res: Response, identity: RequestIdentity) {
  // JSON 503 may be a resource-specific budget/business failure; retain that error locally.
  if (res.status === 502 || res.status === 504 ||
    (res.status === 503 && !isJsonContentType(res.headers.get('content-type')))) {
    notifyOffline(identity)
    throw new ApiError('摸鱼派服务暂不可用，请稍后重新连接', res.status, 'offline')
  }
}

function isRiskCaptchaPath(path: string) {
  return path.includes('/validateCaptcha') || /(^|\/)test(\?|$)/.test(path)
}

async function requestOnce<T = unknown>(path: string, init: RequestInitExtra, identity: RequestIdentity): Promise<T> {
  const headers = new Headers(init.headers)
  if (import.meta.env.SSR && !headers.has('User-Agent')) headers.set('User-Agent', FISHPI_UA)
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (!import.meta.env.SSR && isV3Path(path) && !isCredentialPath(path) && init.credentials !== 'omit' && accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const { __captchaRetried: _, __v3Retried: __, __authVersion: ___, __zip: ____, __svg: _____, ...fetchInit } = init
  const ssrRead = import.meta.env.SSR && ssrReadGate && (init.method || 'GET').toUpperCase() === 'GET'
  let res: Response
  try {
    res = await fetch(resolveUrl(path), {
      ...fetchInit,
      ...(ssrRead ? { redirect: 'manual' as const } : {}),
      credentials: init.credentials ?? 'include',
      headers,
    })
  } catch (e) {
    if (init.signal?.aborted) throw new ApiError('请求已取消', 0, 'aborted')
    asNetworkError(e, identity)
  }

  if (res.status === 429) {
    void res.body?.cancel().catch(() => {})
    const error = new ApiError('操作过于频繁，请稍后重试', 429)
    error.retryAfter = res.headers.get('Retry-After') ?? undefined
    throw error
  }

  checkGateway(res, identity)

  // Rhythm BeforeRequestHandler：IP 进入验证码黑名单时 302 → /test
  try {
    const redirect = ssrRead && res.status >= 300 && res.status < 400 ? res.headers.get('Location') : null
    const pathname = (redirect ? new URL(redirect, resolveUrl(path)) : new URL(res.url)).pathname
    if (/^\/test\/?$/.test(pathname)) {
      if (ssrRead) void res.body?.cancel().catch(() => {})
      throw new ApiError('访问过于频繁，请完成人机验证后再试', 302, 'captcha')
    }
  } catch (e) {
    if (e instanceof ApiError) throw e
  }

  const binaryType = init.__svg ? 'image/svg+xml' : 'application/zip'
  const binaryLimit = init.__svg ? 512 * 1024 : MAX_PRIVATE_ZIP_BYTES
  if ((init.__zip || init.__svg) && res.ok && res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() === binaryType) {
    const declared = res.headers.get('content-length')
    if (declared && (!/^[0-9]+$/.test(declared) || Number(declared) > binaryLimit)) { await res.body?.cancel(); throw new ApiError('文件大小异常', 502, 'invalid_response') }
    const reader = res.body?.getReader()
    if (!reader) throw new ApiError('文件为空', 502, 'invalid_response')
    const parts: ArrayBuffer[] = []; let bytes = 0
    try { while (true) { const { done, value } = await readNetworkBody(() => reader.read(), init.signal, identity); if (done) break; bytes += value.byteLength; if (bytes > binaryLimit) { await reader.cancel(); throw new ApiError('文件大小异常', 502, 'invalid_response') } parts.push(new Uint8Array(value).buffer) } }
    finally { reader.releaseLock() }
    if (!bytes) throw new ApiError('文件为空', 502, 'invalid_response')
    return new Blob(parts, { type: binaryType }) as T
  }

  const text = await readNetworkBody(() => res.text(), init.signal, identity)
  const looksJson = isJsonContentType(res.headers.get('content-type')) || text.startsWith('{') || text.startsWith('[')
  if (!looksJson) {
    if (res.status === 401) throw new ApiError('请登录后重试', res.status)
    throw new ApiError('接口返回了非 JSON', res.status, 'invalid_response')
  }

  let data: T
  try {
    data = JSON.parse(text) as T
  } catch {
    throw new ApiError('无法解析接口响应', res.status, 'invalid_response')
  }

  if (!res.ok) {
    const msg = typeof data === 'object' && data && 'msg' in data ? String((data as { msg?: string }).msg) : res.statusText
    const code = typeof data === 'object' && data && 'code' in data ? String((data as { code?: string | number }).code) : undefined
    throw new ApiError(msg || '请求失败', res.status, code)
  }

  if (init.__zip || init.__svg) throw new ApiError('接口未返回预期文件', 502, 'invalid_response')

  return data
}

/** Bound to the current private export service's ZIP budget. */
export const MAX_PRIVATE_ZIP_BYTES = 32 * 1024 * 1024
export function requestSvg(path: string, init: RequestInit = {}): Promise<Blob> { return request<Blob>(path, { ...init, __svg: true, cache: 'no-store' }) }
export function requestZip(path: string, init: RequestInit = {}): Promise<Blob> { return request<Blob>(path, { ...init, __zip: true }) }

// Browser-only, concurrent public-list GETs. No response cache, private reads, signals or writes.
const publicListFlights = new Map<string, Promise<unknown>>()
export async function request<T = unknown>(path: string, init: RequestInitExtra = {}): Promise<T> {
  const share = !import.meta.env.SSR && (init.method || 'GET').toUpperCase() === 'GET' &&
    Object.keys(init).every(key=>['method','cache','credentials','signal','headers','body'].includes(key)) &&
    !init.signal && !init.headers && !init.body && !init.__v3Retried && !init.__captchaRetried && !init.__zip && !init.__svg &&
    /^\/api\/v3\/(?:articles|columns(?:\/hot)?|tags|domains|breezemoons|repeater\/items)(?:\?|$)/.test(path)
  if (!share) return requestWithRetry<T>(path, init)
  const key = JSON.stringify([getAuthContextVersion(), init.credentials === 'omit' ? null : getAccessToken(), homeReadsActive ? homeReadGeneration : null, path, init.credentials || 'include', init.cache || 'default'])
  let flight = publicListFlights.get(key)
  if (!flight) { flight = requestWithRetry(path, init); publicListFlights.set(key, flight) }
  try { return structuredClone(await flight) as T }
  finally { if (publicListFlights.get(key) === flight) publicListFlights.delete(key) }
}
async function requestWithRetry<T = unknown>(path: string, init: RequestInitExtra = {}): Promise<T> {
  // Bound SSR reads, including body consumption; a slow upstream must not hang HTML forever.
  const timeout = import.meta.env.SSR && (init.method || 'GET').toUpperCase() === 'GET'
    ? AbortSignal.timeout(8000)
    : undefined
  if (timeout) init = { ...init, signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout }
  const identity = requestIdentity()
  const version = identity.version
  const sentToken = getAccessToken()
  const explicitAuthorization = new Headers(init.headers).has('Authorization')
  const run = () => {
    if (init.__authVersion !== undefined && init.__authVersion !== authVersion) {
      throw new ApiError('登录状态已变更', 401, 'stale_session')
    }
    return requestOnce<T>(path, init, identity)
  }
  if (!import.meta.env.SSR && homeReadsActive && isV3Path(path)) {
    const method = (init.method || 'GET').toUpperCase()
    const refresh = path === '/api/v3/auth/refresh'
    const ticket = /\/(?:realtime-ticket|realtime\/tickets)$/.test(path)
    if (method === 'GET' || refresh || ticket) {
      return queueHomeRead(path, init, refresh ? () => queueCredentialRequest(run) : run, refresh || (method === 'GET' && path === '/api/v3/me'))
    }
  }
  try {
    if (timeout && ssrReadGate) {
      return await ssrReadGate(async () => {
        try { return await run() }
        catch (error) {
          if (timeout.aborted) throw new ApiError('SSR 上游请求超时', 0, 'ssr_timeout')
          throw error
        }
      })
    }
    return await (!import.meta.env.SSR && isCredentialPath(path) ? queueCredentialRequest(run) : run())
  } catch (e) {
    if (!import.meta.env.SSR && isCaptchaRequired(e)) {
      if (init.__captchaRetried || isRiskCaptchaPath(path) || version !== authVersion || init.signal?.aborted) throw e
      await ensureRiskCaptcha()
      if (version !== authVersion || init.signal?.aborted) throw e
      return request<T>(path, { ...init, __captchaRetried: true })
    }
    // A guest 401 can come from the anonymous shield. Session restore owns refresh-cookie probing.
    if (!import.meta.env.SSR && isV3Path(path) && !isCredentialPath(path) && init.credentials !== 'omit' && !explicitAuthorization &&
      (sentToken || getAccessToken()) && e instanceof ApiError && e.status === 401 && !init.__v3Retried && version === authVersion) {
      // A late 401 may belong to the token that another request has already rotated.
      const refreshed = getAccessToken() !== sentToken && Boolean(getAccessToken()) || await refreshAccessToken()
      if (refreshed && version === authVersion) return request<T>(path, { ...init, __v3Retried: true })
    }
    if (!import.meta.env.SSR && isV3Path(path) && !isCredentialPath(path) && init.credentials !== 'omit' && !explicitAuthorization &&
      init.__v3Retried && version === authVersion && sentToken === getAccessToken() &&
      e instanceof ApiError && e.status === 401) publishToken(null)
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
  const identity = requestIdentity()
  const headers = new Headers(init.headers)
  if (import.meta.env.SSR && !headers.has('User-Agent')) headers.set('User-Agent', FISHPI_UA)
  const { __captchaRetried: _, ...fetchInit } = init
  let res: Response
  try {
    res = await fetch(resolveUrl(path), {
      ...fetchInit,
      credentials: init.credentials ?? 'include',
      headers,
    })
  } catch (e) {
    asNetworkError(e, identity)
  }
  try {
    const pathname = new URL(res.url).pathname
    if (/^\/test\/?$/.test(pathname)) {
      throw new ApiError('访问过于频繁，请完成人机验证后再试', 302, 'captcha')
    }
  } catch (e) {
    if (e instanceof ApiError) throw e
  }
  checkGateway(res, identity)
  const text = await readNetworkBody(() => res.text(), init.signal, identity)
  if (!res.ok) throw new ApiError('读取失败，请稍后重试', res.status)
  return text
}
