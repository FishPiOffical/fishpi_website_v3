import { ApiError, request } from './http'
import type { EmojiGroup, EmojiItem } from './fishpi'
type Row = Record<string, unknown>
const base = '/api/v3/me/settings'
const invalid = () => new ApiError('表情接口响应格式不正确', 502, 'invalid_response')
function row(value: unknown): Row { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Row }
function text(value: unknown): string { if (typeof value !== 'string') throw invalid(); return value }
function int(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw invalid(); return value }
function count(value: unknown): number { const n = int(value); if (n < 0) throw invalid(); return n }
function id(value: unknown): string { const s = text(value); if (!/^[1-9][0-9]{0,31}$/.test(s)) throw invalid(); return s }
function pathId(value: string): string { if (!/^[1-9][0-9]{0,31}$/.test(value)) throw new ApiError('表情ID不合法', 422); return encodeURIComponent(value) }
async function data(path: string, init?: RequestInit): Promise<Row> {
  const envelope = row(await request(path, init))
  if (envelope.code !== 0) throw new ApiError(typeof envelope.msg === 'string' ? envelope.msg : '表情请求失败', 502)
  return row(envelope.data)
}
export interface EmojiPage<T> { list: T[]; p: number; size: number; total: number; pageCount: number }
function page<T>(source: Row, p: number, size: number, project: (v: unknown) => T): EmojiPage<T> {
  const meta = row(source.pagination)
  if (!Array.isArray(source.list) || source.list.length > size || int(meta.p) !== p || int(meta.size) !== size) throw invalid()
  return { list: source.list.map(project), p, size, total: count(meta.total), pageCount: count(meta.pageCount) }
}
function pageParams(p: number, size: number): string {
  if (!Number.isSafeInteger(p) || p < 1 || !Number.isSafeInteger(size) || size < 1 || size > 50) throw new ApiError('分页参数不合法', 422)
  return `p=${p}&size=${size}`
}
function group(value: unknown): EmojiGroup { const s = row(value); return { oId: id(s.id), name: text(s.name), type: int(s.type), sort: int(s.sort) } }
function image(value: unknown): string {
  const raw = text(value)
  if (!raw || /[\u0000-\u0020\u007f<>\\]/.test(raw) || raw.startsWith('//')) return ''
  try { const url = new URL(raw, 'https://fishpi.cn'); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? raw : '' } catch { return '' }
}
function item(value: unknown): EmojiItem { const s = row(value); return { oId: id(s.id), emojiId: id(s.emojiId), name: text(s.name), sort: int(s.sort), url: image(s.url) } }
function aliases(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(v => typeof v !== 'string' || !v || v.length > 64 || /[\u0000-\u001f\u007f]/.test(v))) throw invalid()
  return value as string[]
}
export async function fetchV3FrequentAliases(): Promise<string[]> { return aliases((await data(`${base}/emotions`)).emotions) }
export async function fetchV3FrequentEmotions(): Promise<EmojiItem[]> { return (await fetchV3FrequentAliases()).map(name => ({ name, text: `:${name}:` })) }
export async function fetchV3EmotionOptions(): Promise<{ groups: string[][]; defaults: string[] }> {
  const source = await data(`${base}/emotion-options`)
  if (!Array.isArray(source.groups)) throw invalid()
  const groups = source.groups.map(aliases), defaults = aliases(source.defaults), catalog = new Set(groups.flat())
  if (defaults.some(alias => !catalog.has(alias))) throw invalid()
  return { groups, defaults }
}
export async function fetchV3EmojiGroups(p = 1, size = 50): Promise<EmojiPage<EmojiGroup>> {
  return page(await data(`${base}/emoji-groups?${pageParams(p, size)}`), p, size, group)
}
export async function fetchV3GroupEmojis(groupId: string, p = 1, size = 50): Promise<EmojiPage<EmojiItem>> {
  return page(await data(`${base}/emoji-groups/${pathId(groupId)}/emojis?${pageParams(p, size)}`), p, size, item)
}
export function emojiOperationKey(): string {
  return `emojis:${Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('')}`
}
async function mutate(path: string, method: string, body: Row, key: string): Promise<Row> {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new ApiError('操作标识不合法', 422)
  return data(path, { method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) })
}
export async function saveV3FrequentEmotions(emotions: string[], key: string): Promise<string[]> {
  return aliases((await mutate(`${base}/emotions`, 'PUT', { emotions }, key)).emotions)
}
export async function createV3EmojiGroup(name: string, sort: number, key: string): Promise<EmojiGroup> {
  return group(await mutate(`${base}/emoji-groups`, 'POST', { name, sort }, key))
}
export async function updateV3EmojiGroup(groupId: string, name: string, sort: number, key: string): Promise<EmojiGroup> {
  return group(await mutate(`${base}/emoji-groups/${pathId(groupId)}`, 'PUT', { name, sort }, key))
}
export async function deleteV3EmojiGroup(groupId: string, key: string): Promise<void> {
  const source = await mutate(`${base}/emoji-groups/${pathId(groupId)}`, 'DELETE', {}, key)
  if (source.id !== groupId || source.deleted !== true) throw invalid()
}
export async function addV3EmojiURL(groupId: string, url: string, sort: number, name: string, key: string): Promise<EmojiItem & { groupId: string }> {
  const path = groupId ? `${base}/emoji-groups/${pathId(groupId)}/emojis` : `${base}/emojis`
  const source = await mutate(path, 'POST', { url, sort, name }, key)
  const target = id(source.groupId)
  if (groupId && target !== groupId) throw invalid()
  const member = item(source)
  if (member.url !== url) throw invalid()
  return { ...member, groupId: target }
}
export async function removeV3GroupEmoji(groupId: string, itemId: string, key: string): Promise<void> {
  const source = await mutate(`${base}/emoji-groups/${pathId(groupId)}/emojis/${pathId(itemId)}`, 'DELETE', {}, key)
  if (source.id !== itemId || source.groupId !== groupId || source.deleted !== true) throw invalid()
}

export async function updateV3EmojiItem(groupId: string, itemId: string, name: string, sort: number, key: string): Promise<EmojiItem> {
  const source = await mutate(`${base}/emoji-groups/${pathId(groupId)}/emojis/${pathId(itemId)}`, 'PUT', { name, sort }, key)
  if (source.id !== itemId || source.groupId !== groupId) throw invalid()
  return item(source)
}
export interface EmojiShare { shareCode: string; groupName: string; emojiCount: number; createdTime: number }
export async function shareV3EmojiGroup(groupId: string, key: string): Promise<EmojiShare> {
  const source = await mutate(`${base}/emoji-groups/${pathId(groupId)}/shares`, 'POST', {}, key)
  const shareCode = text(source.shareCode)
  if (!/^[A-Z0-9]{12}$/.test(shareCode)) throw invalid()
  return { shareCode, groupName: text(source.groupName), emojiCount: count(source.emojiCount), createdTime: count(source.createdTime) }
}
export async function importV3EmojiGroup(shareCode: string, key: string): Promise<{ groupId: string; groupName: string; emojiCount: number; sourceGroupName: string }> {
  const code = shareCode.trim().toUpperCase()
  if (!/^[A-Z0-9]{8,16}$/.test(code)) throw new ApiError('分享码应为8至16位字母或数字', 422)
  const source = await mutate(`${base}/emoji-group-imports`, 'POST', { shareCode: code }, key)
  return { groupId: id(source.groupId), groupName: text(source.groupName), emojiCount: count(source.emojiCount), sourceGroupName: text(source.sourceGroupName) }
}
export async function migrateV3LegacyEmojis(key: string): Promise<{ groupId: string; processedCount: number; addedCount: number }> {
  const source = await mutate(`${base}/emoji-migrations`, 'POST', {}, key)
  const processedCount = count(source.processedCount), addedCount = count(source.addedCount)
  if (addedCount > processedCount) throw invalid()
  return { groupId: id(source.groupId), processedCount, addedCount }
}
