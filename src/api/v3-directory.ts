import { ApiError, request } from './http'
import { adaptV3Domain, adaptV3Tag, decodeV3ContentPage } from './v3-content'
import type { DomainItem, TagItem } from './fishpi'
export type DirectoryKind = 'domains' | 'tags'
export type DirectoryPage = { kind: DirectoryKind; p: number; size: number; total: number; pageCount: number; list: (DomainItem | TagItem)[] }
const invalid = () => new ApiError('目录响应格式不正确', 502)
function icon(raw: string): string {
  if (/[\u0000-\u0020\u007f\\]/.test(raw)) return ''
  try { const u = new URL(raw); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? raw : '' }
  catch { return raw.startsWith('/') && !raw.startsWith('//') ? raw : '' }
}
function project(kind: DirectoryKind, value: unknown) {
  if (kind === 'domains') { const v = adaptV3Domain(value); return { ...v, domainIconPath: icon(v.domainIconPath || '') } }
  const v = adaptV3Tag(value); return { ...v, tagIconPath: icon(v.tagIconPath || '') }
}
export function decodeDirectoryPage(value: unknown, kind: DirectoryKind, p = 1): DirectoryPage {
  if (kind !== 'domains' && kind !== 'tags') throw invalid()
  const raw = value as DirectoryPage
  if (!raw || raw.kind !== kind || raw.p !== p || raw.size !== 50 || !Array.isArray(raw.list)) throw invalid()
  const data = decodeV3ContentPage({ list: raw.list.map(item => {
    if (!item || typeof item !== 'object') throw invalid()
    if (kind === 'domains') { const v = item as DomainItem; return { id: v.uri, uri: v.domainURI, title: v.domainTitle, description: v.domainDescription, iconURL: v.domainIconPath } }
    const v = item as TagItem; return { id: v.tagURI, title: v.tagTitle, description: v.tagDescription, iconURL: v.tagIconPath, articleCount: v.tagReferenceCount }
  }), pagination: raw })
  const list = data.list.map(item => project(kind, item)), ids = list.map(item => 'uri' in item ? item.uri : item.tagURI)
  if (new Set(ids).size !== ids.length || (p > raw.pageCount && list.length !== 0)) throw invalid()
  return { kind, ...data.pagination, list }
}
export async function fetchDirectoryPage(kind: DirectoryKind, p = 1): Promise<DirectoryPage> {
  if (!['domains', 'tags'].includes(kind) || !Number.isSafeInteger(p) || p < 1 || p > 42949672) throw new ApiError('目录分页参数不合法', 422)
  const raw = await request<{ code: number; msg?: string; data?: unknown }>(`/api/v3/${kind}?p=${p}&size=50`, { cache: 'no-store', credentials: 'omit' })
  if (raw.code !== 0) throw new ApiError(raw.msg || '目录读取失败', 400)
  const data = decodeV3ContentPage(raw.data)
  if (data.pagination.p !== p || data.pagination.size !== 50) throw invalid()
  return decodeDirectoryPage({ kind, ...data.pagination, list: data.list.map(item => project(kind, item)) }, kind, p)
}
