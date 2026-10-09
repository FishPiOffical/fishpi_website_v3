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

  // Rhythm BeforeRequestHandler：IP 进入验证码黑名单时 302 → /test
  try {
    const pathname = new URL(res.url).pathname
    if (/^\/test\/?$/.test(pathname)) {
      throw new ApiError('访问过于频繁，请完成人机验证后再试', 302, 'captcha')
    }
  } catch (e) {
    if (e instanceof ApiError) throw e
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
    throw new ApiError(msg || '请求失败', res.status)
  }

  return data
}

export async function request<T = unknown>(path: string, init: RequestInitExtra = {}): Promise<T> {
  try {
    return await requestOnce<T>(path, init)
  } catch (e) {
    if (
      !import.meta.env.SSR &&
      isCaptchaRequired(e) &&
      !init.__captchaRetried &&
      !isRiskCaptchaPath(path)
    ) {
      await ensureRiskCaptcha()
      return requestOnce<T>(path, { ...init, __captchaRetried: true })
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
