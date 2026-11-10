import { ApiError, requestSvg } from './http'
let active = 0
const waiting: Array<() => void> = []
export async function fetchMedalImage(id: string, userName = '', mini = false, signal?: AbortSignal): Promise<Blob | null> {
  if (typeof id !== 'string' || !id.trim() || id.length > 128 || /[\u0000-\u001f\u007f-\u009f\p{Surrogate}]/u.test(id) || userName && !/^[A-Za-z0-9_-]{1,64}$/.test(userName) || typeof mini !== 'boolean') throw new ApiError('勋章图片参数不合法', 422)
  if (active >= 2) await new Promise<void>(resolve => waiting.push(resolve))
  else active++
  try {
    if (signal?.aborted) throw new ApiError('请求已取消', 0, 'aborted')
    const image = await requestSvg(`/api/v3/${userName ? `users/${encodeURIComponent(userName)}` : 'me'}/medals/image?medalId=${encodeURIComponent(id)}&size=${mini ? 'mini' : 'full'}`, { signal })
    // 渲染服务可能返回 HTTP 200，但 SVG 只剩空画布。
    if (/^\s*<svg\b[^>]*(?:\/\s*>|>\s*<\/svg\s*>)\s*$/i.test(await image.text())) return null
    return image
  } finally { const next = waiting.shift(); if (next) next(); else active-- }
}
