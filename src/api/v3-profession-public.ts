import { ApiError, request } from './http'
export type PublicRarity = { rank: number; totalUsers: number; surpassedPercent: number }
export type PublicJob = { professionId: string; professionCode: string; displayName: string; shortName: string; description: string } & (
  { state: 'SELECTED' } | { state: 'ACTIVE' | 'RETIRED'; levelCode: string; levelName: string; totalExperience?: number; requiredExperience?: number; rarity?: PublicRarity }
)
export type Contribution = { professionId: string; eventCount: number; lastOccurredAt: number; experienceSum?: number }
export type PublicProfessionProfile = {
  primaryProfession?: PublicJob
  professions?: PublicJob[]
  majorContributions?: (Contribution & { actionCode: string })[]
  contributionStats?: Contribution[]
  activityFeed?: { professionId: string; actionCode: string; occurredAt: number; experienceDelta?: number }[]
  levelHistory?: { professionId: string; beforeLevelCode: string; afterLevelCode: string; occurredAt: number }[]
  rewards?: { professionId: string; levelCode: string; rewardCode: string; rewardType: 'POINT' | 'MEDAL'; status: 'PENDING' | 'GRANTED' | 'REVOKED'; grantedAt: number }[]
  ranking?: (PublicRarity & { professionId: string })[]
}
type Row = Record<string, unknown>
const invalid = () => new ApiError('公开职业资料响应格式不正确', 502, 'invalid_response')
const object = (value: unknown): Row => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Row }
const text = (value: unknown, max = 1024): string => { if (typeof value !== 'string' || value.length > max) throw invalid(); return value }
const integer = (value: unknown, signed = false): number => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || !signed && value < 0) throw invalid(); return value }
function id(value: unknown): string { const result = text(value, 19); if (!/^[0-9]{1,19}$/.test(result)) throw invalid(); return result }
function action(value: unknown): string { const result = text(value, 64); if (!/^[a-z][a-z0-9._-]{0,63}$/.test(result)) throw invalid(); return result }
function choice<T extends string>(value: unknown, allowed: readonly T[]): T { if (!allowed.includes(value as T)) throw invalid(); return value as T }
function list<T>(value: unknown, project: (value: unknown) => T, max = 512): T[] { if (!Array.isArray(value) || value.length > max) throw invalid(); return value.map(project) }
function rarity(value: unknown): PublicRarity {
  const row = object(value), rank = integer(row.rank), totalUsers = integer(row.totalUsers), surpassedPercent = row.surpassedPercent
  if (rank < 1 || totalUsers < rank || typeof surpassedPercent !== 'number' || !Number.isFinite(surpassedPercent) || Math.abs(surpassedPercent - (totalUsers - rank) * 100 / totalUsers) > 0.000001) throw invalid()
  return { rank, totalUsers, surpassedPercent }
}
function job(value: unknown, primary: boolean): PublicJob {
  const row = object(value), state = choice(row.state, primary ? ['SELECTED', 'ACTIVE', 'RETIRED'] : ['ACTIVE', 'RETIRED'])
  const base = { professionId: id(row.professionId), professionCode: text(row.professionCode, 64), displayName: text(row.displayName, 64), shortName: text(row.shortName, 32), description: text(row.description) }
  if (state === 'SELECTED') {
    if (['levelCode', 'levelName', 'totalExperience', 'requiredExperience', 'rarity'].some(field => field in row)) throw invalid()
    return { ...base, state }
  }
  if (('totalExperience' in row) !== ('requiredExperience' in row)) throw invalid()
  return { ...base, state, levelCode: text(row.levelCode, 64), levelName: text(row.levelName, 64), ...('totalExperience' in row ? { totalExperience: integer(row.totalExperience), requiredExperience: integer(row.requiredExperience) } : {}), ...('rarity' in row ? { rarity: rarity(row.rarity) } : {}) }
}
function contribution(value: unknown): Contribution {
  const row = object(value)
  return { professionId: id(row.professionId), eventCount: integer(row.eventCount), lastOccurredAt: integer(row.lastOccurredAt), ...('experienceSum' in row ? { experienceSum: integer(row.experienceSum, true) } : {}) }
}
export async function fetchV3PublicProfessions(userName: string): Promise<PublicProfessionProfile> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userName)) throw new ApiError('用户名不合法', 422)
  const response = await request<{ code: number; msg?: string; data?: unknown }>(`/api/v3/users/${encodeURIComponent(userName)}/professions`)
  if (response.code !== 0) throw new ApiError(response.msg || '公开职业资料读取失败', 400)
  const source = object(response.data), output: PublicProfessionProfile = {}
  if ('primaryProfession' in source) output.primaryProfession = job(source.primaryProfession, true)
  if ('professions' in source) output.professions = list(source.professions, value => job(value, false))
  if ('majorContributions' in source) output.majorContributions = list(source.majorContributions, value => ({ ...contribution(value), actionCode: action(object(value).actionCode) }))
  if ('contributionStats' in source) output.contributionStats = list(source.contributionStats, contribution)
  if ('activityFeed' in source) output.activityFeed = list(source.activityFeed, value => { const row = object(value); return { professionId: id(row.professionId), actionCode: action(row.actionCode), occurredAt: integer(row.occurredAt), ...('experienceDelta' in row ? { experienceDelta: integer(row.experienceDelta, true) } : {}) } }, 30)
  if ('levelHistory' in source) output.levelHistory = list(source.levelHistory, value => { const row = object(value); return { professionId: id(row.professionId), beforeLevelCode: text(row.beforeLevelCode, 64), afterLevelCode: text(row.afterLevelCode, 64), occurredAt: integer(row.occurredAt) } }, 30)
  if ('rewards' in source) output.rewards = list(source.rewards, value => { const row = object(value); return { professionId: id(row.professionId), levelCode: text(row.levelCode, 64), rewardCode: text(row.rewardCode, 64), rewardType: choice(row.rewardType, ['POINT', 'MEDAL']), status: choice(row.status, ['PENDING', 'GRANTED', 'REVOKED']), grantedAt: integer(row.grantedAt) } })
  if ('ranking' in source) output.ranking = list(source.ranking, value => ({ professionId: id(object(value).professionId), ...rarity(value) }))
  if (!Object.keys(output).length) throw invalid()
  for (const values of [output.professions, output.contributionStats, output.ranking]) if (values && new Set(values.map(value => value.professionId)).size !== values.length) throw invalid()
  return output
}
