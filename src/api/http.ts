export const FISHPI_UA =
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.status = status
  }
}

function isJsonContentType(value: string | null) {
  return Boolean(value && value.includes('application/json'))
}

export async function request<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('User-Agent')) headers.set('User-Agent', FISHPI_UA)
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(path, {
    ...init,
    credentials: init.credentials ?? 'include',
    headers,
  })

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

export async function requestText(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('User-Agent')) headers.set('User-Agent', FISHPI_UA)
  const res = await fetch(path, {
    ...init,
    credentials: init.credentials ?? 'include',
    headers,
  })
  const text = await res.text()
  if (!res.ok) throw new ApiError(text.slice(0, 120) || '请求失败', res.status)
  return text
}

export function withKey(path: string, apiKey?: string | null) {
  if (!apiKey) return path
  const join = path.includes('?') ? '&' : '?'
  return `${path}${join}apiKey=${encodeURIComponent(apiKey)}`
}
