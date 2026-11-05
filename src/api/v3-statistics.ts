import { ApiError, request } from './http'
import {getApiMode} from './mode'

export const statisticFields = [
  ['memberCount', '用户数'], ['articleCount', '文章数'], ['commentCount', '评论数'],
  ['domainCount', '领域数'], ['tagCount', '标签数'], ['linkCount', '链接数'],
  ['onlineVisitorCount', '当前在线总数'], ['onlineMemberCount', '当前在线成员数'],
  ['peakOnlineVisitorCount', '历史最高在线总数'],
] as const
export type CommunityStatistics = Record<typeof statisticFields[number][0], number>

export function decodeStatistics(value: unknown): CommunityStatistics {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('统计响应格式不正确', 502)
  const row = value as Record<string, unknown>
  const result = {} as CommunityStatistics
  for (const [key] of statisticFields) {
    const count = row[key]
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) throw new ApiError('统计响应格式不正确', 502)
    result[key] = count
  }
  return result
}

export async function fetchStatistics(): Promise<CommunityStatistics> {
  if(getApiMode()==='v1')return (await import('./legacy/statistics')).legacyStatistics()
  const envelope = await request<{ code: number; data: unknown }>('/api/v3/statistics', { cache: 'no-store' })
  if (!envelope || envelope.code !== 0) throw new ApiError('统计响应格式不正确', 502)
  return decodeStatistics(envelope.data)
}
