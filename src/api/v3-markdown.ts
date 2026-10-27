import { ApiError, request } from './http'

export async function markdownPreview(content: string, signal?: AbortSignal): Promise<string> {
  if (typeof content !== 'string' || content.length > 1024000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(content)) throw new ApiError('预览正文不合法', 422)
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff) { const low = content.charCodeAt(++i); if (!(low >= 0xdc00 && low <= 0xdfff)) throw new ApiError('预览正文不合法', 422) }
    else if (c >= 0xdc00 && c <= 0xdfff) throw new ApiError('预览正文不合法', 422)
  }
  const raw = await request<unknown>('/api/v3/markdown/preview', { method: 'POST', body: JSON.stringify({ content }), signal, cache: 'no-store' })
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ApiError('预览响应不正确', 502)
  const r = raw as Record<string, unknown>, d = r.data
  if (r.code !== 0 || !d || typeof d !== 'object' || Array.isArray(d) || typeof (d as Record<string, unknown>).html !== 'string') throw new ApiError('预览响应不正确', 502)
  return (d as { html: string }).html
}
