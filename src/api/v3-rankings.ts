import {getApiMode} from './mode'
import { ApiError, request } from './http'
import { decodeV3ContentPage } from './v3-content'
import { decodeV3RelationUser, type RelationUser } from './v3-user-relations'

export const rankingTitles = {
  checkin: '连签排行', online: '在线时间排行', balance: '积分财富排行', consumption: '积分支出排行',
  donate: '鱼排续命师', perfect: '优选排行', invite: '邀请成员排行', links: '链接点击排行',
  xiaoice: '小冰修仙排行', evolve: '进化 Evolve 排行', adr: '小黑屋 ADR 排行', mofish: '摸鱼大闯关排行',
  smallmofish: '摸鱼小闯关排行', lifeRestart: '人生重开排行', emoji: '真假小黄脸排行',
} as const
export type RankingType = keyof typeof rankingTitles
export interface RankingEntry { rank: number; score: number; metrics: Record<string, number | string>; user?: RelationUser; link?: { id: string; title: string; url: string } }
export interface RankingPage { type: RankingType; subType: string; list: RankingEntry[]; p: number; size: number; total: number; pageCount: number; summary?: { amount: number; supportedDays: number } }
export const rankingSubTypes = { evolve: [['achievement', '成就'], ['know', '知识'], ['reset', '重置'], ['days', '天数']], xiaoice: [['0', '经验'], ['1', '死亡次数'], ['2', '历练次数'], ['3', '吐纳次数']] } as const
const bad = () => new ApiError('排行榜响应格式不正确', 502)
export function rankingType(value: string): RankingType { if (!Object.hasOwn(rankingTitles, value)) throw new ApiError('榜单类型不合法', 422); return value as RankingType }
export function rankingSubType(type: RankingType, value?: string) {
  const list = type === 'evolve' ? rankingSubTypes.evolve : type === 'xiaoice' ? rankingSubTypes.xiaoice : null
  const sub = value ?? list?.[0][0] ?? ''
  if (list ? !list.some(([key]) => key === sub) : sub !== '') throw new ApiError('子榜单不合法', 422)
  return sub
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw bad(); return value as Record<string, unknown> }
function number(value: unknown, decimal = false) { if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER || !decimal && !Number.isSafeInteger(value)) throw bad(); return value }
function string(value: unknown) { if (typeof value !== 'string' || value.length > 65536) throw bad(); return value }
function url(value: string) { if (/[\\\u0000-\u0020\u007f]/u.test(value)) return ''; try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? value : '' } catch { return value.startsWith('/') && !value.startsWith('//') && !/[\\\u0000-\u0020]/u.test(value) ? value : '' } }
export function rankingMetricFields(type: RankingType, sub: string) {
  switch (type) {
    case 'checkin': return ['streak']; case 'online': return ['minutes']; case 'links': return ['clickCount'];
    case 'invite': case 'perfect': return ['count']; case 'donate': return ['amount', 'count'];
    case 'lifeRestart': return ['times', 'achievement']; case 'evolve': return ['achievement', 'know', 'reset', 'days', 'currentKnow', 'currentDays'];
    case 'xiaoice': return sub === '0' ? ['exp', 'ancestry', 'gongfa'] : [sub === '1' ? 'dieTimes' : sub === '2' ? 'allExTimes' : 'allBsTimes'];
    default: return ['points'];
  }
}
export function decodeRanking(value: unknown, type: RankingType, sub = rankingSubType(type), p = 1, size = 20): RankingPage {
  const row = object(value), page = decodeV3ContentPage(row)
  if (row.type !== type || row.subType !== sub || page.pagination.p !== p || page.pagination.size !== size || page.list.length !== Math.max(0, Math.min(size, page.pagination.total - (p - 1) * size))) throw bad()
  const fields = rankingMetricFields(type, sub), primary = type === 'evolve' ? sub : fields[0]!
  const list = page.list.map((entry, index): RankingEntry => {
    const rank = number(entry.rank), score = number(entry.score, type === 'donate'), source = object(entry.metrics), metrics: Record<string, number | string> = {}
    if (rank !== (p - 1) * size + index + 1) throw bad()
    for (const field of fields) metrics[field] = field === 'ancestry' || field === 'gongfa' ? string(source[field]) : number(source[field], field === 'amount')
    if (score !== metrics[primary]) throw bad()
    if (type === 'links') { const link = object(entry.link), id = string(link.id); if (!id || id.length > 32 || id[0] === '0' || /[^0-9]/.test(id)) throw bad(); return { rank, score, metrics, link: { id, title: string(link.title), url: url(string(link.url)) } } }
    return { rank, score, metrics, user: decodeV3RelationUser(entry.user) }
  })
  const result: RankingPage = { type, subType: sub, ...page.pagination, list }
  if (type === 'donate') { const summary = object(row.summary); result.summary = { amount: number(summary.amount, true), supportedDays: number(summary.supportedDays, true) } }
  return result
}
/** SSR stores the already projected page, whereas HTTP carries nested pagination. */
export function decodeInitialRanking(value: unknown, type: RankingType, sub: string, size: number) {
  const row = object(value)
  return decodeRanking({ ...row, pagination: { p: row.p, size: row.size, total: row.total, pageCount: row.pageCount } }, type, sub, 1, size)
}
export async function fetchRanking(type: RankingType, p = 1, sub?: string, size = 20): Promise<RankingPage> {
  rankingType(type); const normalized = rankingSubType(type, sub)
  if (!Number.isSafeInteger(p) || p < 1 || p > 42949672 || !Number.isInteger(size) || size < 1 || size > 50) throw new ApiError('排行榜分页不合法', 422)
  if(getApiMode()==='v1') {const r=await (await import('./legacy/discovery')).legacyRanking(type,p,size);return decodeRanking({...r,pagination:{p,size,total:r.total,pageCount:r.pageCount}},type,normalized,p,size)}
  const query = new URLSearchParams({ p: String(p), size: String(size) }); if (normalized) query.set('subType', normalized)
  const envelope = object(await request(`/api/v3/rankings/${type}?${query}`, { cache: 'no-store' }))
  if (envelope.code !== 0) throw bad()
  return decodeRanking(envelope.data, type, normalized, p, size)
}
