import { ApiError, request } from './http'
import { decodeV3RelationUser, type RelationUser } from './v3-user-relations'
import { adaptV3Article, decodeV3ContentPage } from './v3-content'
import type { ArticleSummary } from './fishpi'
export const publicLogCategories = ['增加积分', '扣除积分', '发送系统通知', '调整用户背包', '移除勋章', '移除勋章(使用UserId)', '添加勋章', '解封IP', '封禁IP', '发放工资', '上传摸鱼大闯关数据', '上传摸鱼小闯关数据', '发送弹幕', '发帖并标记为有奖励积分', '应用发放积分', '应用扣除积分'] as const
export type PublicLogMetadata = { id: string; time: string; category: typeof publicLogCategories[number] }
export type DiscoveryExtra = { kind: 'recent'; list: RelationUser[] } | { kind: 'random'; list: ArticleSummary[] } | { kind: 'logs'; list: PublicLogMetadata[]; p: number; size: number; total: number; pageCount: number }
const invalid = () => new ApiError('发现接口响应格式不正确', 502)
function row(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Record<string, unknown> }
async function data(path: string) { const result = row(await request(path, { cache: 'no-store' })); if (result.code !== 0) throw invalid(); return row(result.data) }
export function decodeRecentMembers(value: unknown): RelationUser[] {
  if (!Array.isArray(value) || value.length > 20) throw invalid()
  const list = value.map(decodeV3RelationUser)
  if (list.some(u => /[^A-Za-z0-9_-]/.test(u.userName)) || new Set(list.map(u => u.id)).size !== list.length) throw invalid()
  return list
}
export async function fetchRecentMembers() { return decodeRecentMembers((await data('/api/v3/recent-members')).list) }
export async function fetchRandomDiscovery(size = 8, excludeId = ''): Promise<ArticleSummary[]> {
  if (!Number.isSafeInteger(size) || size < 1 || size > 20 || typeof excludeId !== 'string' || excludeId && !/^[0-9]{1,32}$/.test(excludeId)) throw new ApiError('随机发现参数不合法', 422)
  const result = await data(`/api/v3/articles/random?size=${size}${excludeId ? `&excludeId=${encodeURIComponent(excludeId)}` : ''}`)
  if (!Array.isArray(result.list) || result.list.length > size) throw invalid()
  const list = result.list.map(adaptV3Article)
  if (new Set(list.map(a => a.oId)).size !== list.length || list.some(a => a.oId === excludeId)) throw invalid()
  return list
}
function logTime(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) throw invalid()
  const parsed = new Date(value.replace(' ', 'T') + 'Z')
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 19).replace('T', ' ') !== value) throw invalid()
  return value
}
export async function fetchPublicLogMetadata(p = 1) {
  if (!Number.isSafeInteger(p) || p < 1 || p > 42949672) throw new ApiError('日志页码不合法', 422)
  const result = decodeV3ContentPage(await data(`/api/v3/logs?p=${p}&size=20`))
  if (result.pagination.p !== p || result.pagination.size !== 20) throw invalid()
  const list = result.list.map(v => { if (typeof v.id !== 'string' || !/^[1-9][0-9]{0,18}$/.test(v.id) || !publicLogCategories.includes(v.category as PublicLogMetadata['category'])) throw invalid(); return { id: v.id, time: logTime(v.time), category: v.category as PublicLogMetadata['category'] } })
  if (new Set(list.map(v => v.id)).size !== list.length) throw invalid()
  return { ...result.pagination, list }
}
