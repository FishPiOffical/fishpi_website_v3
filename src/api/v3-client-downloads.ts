import { ApiError, request } from './http'

export type ClientGroup = 'desktop' | 'mobile' | 'tools' | 'terminal' | 'more'
type ClientStatus = 'active' | 'retired' | 'comingSoon'

export interface ClientDownload {
  id: string
  name: string
  icon: string
  group: ClientGroup
  status: ClientStatus
  authors: { name: string; userName: string }[]
  links: { label: string; href: string }[]
  recommended: boolean
}

const invalid = () => new ApiError('客户端下载目录响应不正确', 502, 'invalid_response')
const groups = new Set(['desktop', 'mobile', 'tools', 'terminal', 'more'])
const statuses = new Set(['active', 'retired', 'comingSoon'])
const imageHosts = new Set(['fishpi.cn', 'file.fishpi.cn', 'pic.fishpi.cn'])

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Record<string, unknown>
}

function text(value: unknown, maximum: number, empty = false) {
  if (typeof value !== 'string' || value.length > maximum || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(value)
      || !empty && (!value || !value.trim())) throw invalid()
  return value
}

function safeUrl(href: string, image = false) {
  if (image && !href || !image && /^\/article\/[0-9]{1,19}$/.test(href)) return href
  if (!href.startsWith('https://') || /[\s\\]/u.test(href)) throw invalid()
  let url: URL
  try { url = new URL(href) } catch { throw invalid() }
  if (url.username || url.password || url.port || !url.hostname) throw invalid()
  if (image && (!imageHosts.has(url.hostname) || url.search || url.hash
      || !/^\/[A-Za-z0-9/_-][A-Za-z0-9/_.-]*\.(png|jpg|jpeg|webp|avif|ico)$/.test(url.pathname)
      || (url.hostname === 'fishpi.cn' && !url.pathname.startsWith('/images/clients/')))) throw invalid()
  return href
}

export function decodeClientDownloads(value: unknown): ClientDownload[] {
  const response = record(value)
  const { list } = record(response.data)
  if (response.code !== 0 || !Array.isArray(list)) throw invalid()
  const ids = new Set<string>()
  return list.map((value) => {
    const item = record(value)
    const id = text(item.id, 48), group = text(item.group, 16), status = text(item.status, 16)
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || ids.has(id) || !groups.has(group) || !statuses.has(status)
        || typeof item.recommended !== 'boolean' || !Array.isArray(item.authors) || item.authors.length > 4) throw invalid()
    ids.add(id)
    const authors = item.authors.map((value) => {
      const author = record(value)
      const userName = text(author.userName, 64)
      if (!/^[a-zA-Z0-9_-]+$/.test(userName)) throw invalid()
      return { name: text(author.name, 64), userName }
    })
    const links: ClientDownload['links'] = []
    if (status === 'active') {
      if (!Array.isArray(item.links) || item.links.length < 1 || item.links.length > 5) throw invalid()
      for (const value of item.links) {
        const link = record(value)
        links.push({ label: text(link.label, 64), href: safeUrl(text(link.href, 512)) })
      }
    }
    return {
      id, group: group as ClientGroup, status: status as ClientStatus,
      name: text(item.name, 80), icon: safeUrl(text(item.icon, 512, true), true),
      recommended: status === 'active' && item.recommended, authors, links,
    }
  })
}

export async function fetchClientDownloads(signal: AbortSignal) {
  return decodeClientDownloads(await request('/api/v3/client-downloads', { cache: 'no-store', signal }))
}
