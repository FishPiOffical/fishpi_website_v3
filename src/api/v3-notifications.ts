import { ApiError, request } from './http'
import type { NoticeItem, NoticeType, UnreadCount } from './fishpi'

type Row = Record<string, unknown>
const categories = ['commented', 'reply', 'at', 'following', 'point', 'broadcast', 'sys-announce', 'other'] as const
const keys: Record<NoticeType, keyof UnreadCount> = {
  commented: 'unreadCommentedNotificationCnt', reply: 'unreadReplyNotificationCnt', at: 'unreadAtNotificationCnt',
  following: 'unreadFollowingNotificationCnt', point: 'unreadPointNotificationCnt', broadcast: 'unreadBroadcastNotificationCnt',
  'sys-announce': 'unreadSysAnnounceNotificationCnt', other: 'unreadOtherNotificationCnt',
}
const invalid = () => new ApiError('通知接口响应格式不正确', 502, 'invalid_response')
function row(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Row
}
function text(value: unknown): string { if (typeof value !== 'string') throw invalid(); return value }
function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw invalid()
  return value
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid()
  return value
}
async function data(path: string, init?: RequestInit): Promise<unknown> {
  const envelope = row(await request(path, init))
  if (envelope.code !== 0) throw new ApiError(typeof envelope.msg === 'string' ? envelope.msg : '通知请求失败', 502)
  return envelope.data
}
function safeImage(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\u0000-\u0020\\]/.test(value)) return ''
  try {
    const url = new URL(value, 'https://fishpi.cn')
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? value : ''
  } catch { return '' }
}
export function notificationLink(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 4096 || /[\u0000-\u0020\\]/.test(value) || value.startsWith('//')) return ''
  try {
    const url = new URL(value, 'https://fishpi.cn')
    const allowed = new Set(['https://fishpi.cn', 'http://fishpi.cn'])
    if (import.meta.env.VITE_API_TARGET) allowed.add(new URL(import.meta.env.VITE_API_TARGET).origin)
    if (!import.meta.env.SSR) allowed.add(window.location.origin)
    if (!allowed.has(url.origin) || url.username || url.password) return ''
    return url.pathname + url.search + url.hash
  } catch { return '' }
}
export function adaptNotification(value: unknown): NoticeItem {
  const source = row(value), id = text(source.id), category = text(source.category)
  if (!/^\d{1,32}$/.test(id) || !categories.includes(category as NoticeType) || typeof source.hasRead !== 'boolean'
    || typeof source.contentAvailable !== 'boolean') throw invalid()
  const created = new Date(count(source.createdAt)); if (!Number.isFinite(created.getTime())) throw invalid()
  const available = source.contentAvailable
  const result: NoticeItem = {
    oId: id, hasRead: source.hasRead, createTime: created.toISOString(), dataType: integer(source.type),
    notificationTitle: text(source.title), contentAvailable: available,
    description: available ? text(source.descriptionHtml) : '相关内容不存在或不可访问',
    url: available ? notificationLink(source.url) : '',
  }
  if (!available) return result
  const article = source.article === undefined ? null : row(source.article)
  if (article) result.articleTitle = text(article.title)
  const comment = source.comment === undefined ? null : row(source.comment)
  const actor = source.actor === undefined ? null : row(source.actor)
  const author = actor ?? (comment && comment.anonymous !== true ? row(comment.author) : null)
    ?? (!comment && article && article.anonymous !== true ? row(article.author) : null)
  if (author && typeof author.id === 'string' && author.id && typeof author.userName === 'string' && author.userName) {
    result.authorName = author.userName
    result.userAvatarURL = safeImage(author.userAvatarURL)
  }
  return result
}
export interface NotificationPage { items: NoticeItem[]; p: number; size: number; total: number; pageCount: number }
export async function fetchNotificationPage(type: NoticeType, page = 1, size = 10): Promise<NotificationPage> {
  if (!categories.includes(type) || !Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(size) || size < 1 || size > 50) {
    throw new ApiError('通知分页参数不合法', 422)
  }
  const source = row(await data(`/api/v3/me/notifications?type=${encodeURIComponent(type)}&p=${page}&size=${size}`))
  if (!Array.isArray(source.list)) throw invalid()
  const pagination = row(source.pagination), p = count(pagination.p), actualSize = count(pagination.size)
  if (p !== page || actualSize !== size || source.list.length > size) throw invalid()
  return { items: source.list.map(adaptNotification), p, size: actualSize, total: count(pagination.total), pageCount: count(pagination.pageCount) }
}
export async function fetchV3UnreadCount(): Promise<UnreadCount> {
  const source = row(await data('/api/v3/me/notifications/unread-count')), groups = row(source.categories)
  const result: UnreadCount = { unreadNotificationCnt: count(source.total) }
  let sum = 0
  for (const category of categories) { const value = count(groups[category]); sum += value; result[keys[category]] = value }
  if (!Number.isSafeInteger(sum) || sum !== result.unreadNotificationCnt) throw invalid()
  return result
}
export function notificationReadKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return `notifications:read:${Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')}`
}
export async function markV3NotificationsRead(type: NoticeType | 'all', key: string): Promise<void> {
  if (type !== 'all' && !categories.includes(type) || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new ApiError('通知请求参数不合法', 422)
  const source = row(await data('/api/v3/me/notifications/read', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ type }),
  }))
  count(source.changed)
}
