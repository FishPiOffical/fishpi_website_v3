import { ApiError, request } from '../http'
import { getLegacyKey } from './auth'
import { legacyObject } from './home'
import { professionPresets, visibility, type Profession, type Visibility, type Preset, type ExperienceRecord, type Detail } from '../v3-professions'
export type LegacyJobSnapshot = Profession & { levelCode: string; levelName: string; totalExperience: number; requiredExperience: number }
export type LegacyOwnerProfessions = {
  onboardingState: 'UNDECIDED' | 'SKIPPED' | 'SELECTED'; primaryProfessionId: string; primaryProfessionState: 'NONE' | 'ACTIVE' | 'RETIRED' | 'DELETED'; privacyPreset: Preset; moduleVisibility: Visibility
  catalog: Profession[]; snapshots: LegacyJobSnapshot[]; growthGuides: Record<string, string[]>; rewardGuides: Record<string, ({ rewardType: 'POINT'; amount: number } | { rewardType: 'MEDAL' })[]>
}
export type LegacyProfessionCursor = { beforeOccurredAt: number; beforeEffectId: string }
export type LegacyProfessionRecords = { list: (ExperienceRecord & { sourceLabel?: string })[]; next: LegacyProfessionCursor | null }
const bad = () => new ApiError('旧本人职业响应格式不正确', 502)
function text(v: unknown, max = 8192): string { if (typeof v !== 'string' || v.length > max) throw bad(); return v }
function id(v: unknown): string { const result = text(v, 19); if (!/^[0-9]{1,19}$/.test(result)) throw bad(); return result }
function number(v: unknown, signed = false) { if (typeof v !== 'number' || !Number.isSafeInteger(v) || !signed && v < 0) throw bad(); return v }
function choice<T extends string>(v: unknown, options: readonly T[]): T { if (!options.includes(v as T)) throw bad(); return v as T }
function array<T>(v: unknown, decode: (value: unknown) => T, max = 512): T[] { if (!Array.isArray(v) || v.length > max) throw bad(); return v.map(decode) }
function definition(v: unknown): Profession { const r = legacyObject(v); return { professionId: id(r.professionId), professionCode: text(r.professionCode, 64), displayName: text(r.displayName, 64), shortName: text(r.shortName, 32), description: text(r.description) } }
function snapshot(v: unknown): LegacyJobSnapshot { const r = legacyObject(v); return { ...definition(r), levelCode: text(r.levelCode, 64), levelName: text(r.levelName, 64), totalExperience: number(r.totalExperience), requiredExperience: number(r.requiredExperience) } }
function action(v: unknown) { const result = text(v, 64); if (!/^[a-z][a-z0-9._-]{0,63}$/.test(result)) throw bad(); return result }
function dictionary<T>(v: unknown, decode: (value: unknown) => T): Record<string, T> { const source = legacyObject(v), result: Record<string, T> = {}; if (Object.keys(source).length > 512) throw bad(); for (const [key, value] of Object.entries(source)) result[id(key)] = decode(value); return result }
async function read(path: string, query = new URLSearchParams()) {
  const apiKey = getLegacyKey()
  if (!apiKey) throw new ApiError('请先登录查看本人职业', 401)
  query.set('apiKey', apiKey)
  const envelope = legacyObject(await request(path + '?' + query, { cache: 'no-store' }))
  if (apiKey !== getLegacyKey()) throw new ApiError('登录状态已变化', 409)
  if (envelope.code !== 0) throw new ApiError(typeof envelope.msg === 'string' ? envelope.msg : '本人职业读取失败', 502)
  return legacyObject(envelope.data)
}
export async function fetchLegacyOwnerProfessions(ownerId: string): Promise<LegacyOwnerProfessions> {
  id(ownerId)
  const r = await read('/api/profession/me')
  if (id(r.userId) !== ownerId) throw bad()
  const primaryProfessionId = r.primaryProfessionId === '' ? '' : id(r.primaryProfessionId)
  let moduleVisibility: unknown
  try { moduleVisibility = JSON.parse(text(r.moduleVisibilityJson, 4096)) } catch { throw bad() }
  const catalog = array(r.availableProfessions, definition)
  if (new Set(catalog.map(job => job.professionId)).size !== catalog.length) throw bad()
  const primaryProfessionState = choice(r.primaryProfessionState, ['NONE', 'ACTIVE', 'RETIRED', 'DELETED'])
  if ((primaryProfessionId === '') !== (primaryProfessionState === 'NONE')) throw bad()
  return { onboardingState: choice(r.onboardingState, ['UNDECIDED', 'SKIPPED', 'SELECTED']), primaryProfessionId, primaryProfessionState, privacyPreset: choice(r.privacyPreset, Object.keys(professionPresets) as Preset[]), moduleVisibility: visibility(moduleVisibility), catalog, snapshots: array(r.progress, snapshot), growthGuides: dictionary(r.growthGuides, v => array(v, action)), rewardGuides: dictionary(r.rewardGuides, v => array(v, value => { const row = legacyObject(value), rewardType = choice(row.rewardType, ['POINT', 'MEDAL']); if (rewardType === 'MEDAL') return { rewardType }; const amount = number(row.amount); if (amount < 1 || amount > 2147483647) throw bad(); return { rewardType, amount } })) }
}
export async function fetchLegacyProfessionDetail(professionId: string): Promise<Omit<Detail, 'profession'> & { profession: LegacyJobSnapshot }> {
  const r = await read(`/api/profession/me/${id(professionId)}/detail`), profession = snapshot(r.profession)
  if (profession.professionId !== professionId) throw bad()
  const levels = array(r.levels, value => { const row = legacyObject(value); if (typeof row.topLevel !== 'boolean') throw bad(); return { levelCode: text(row.levelCode, 64), sortOrder: number(row.sortOrder), requiredExperience: number(row.requiredExperience), displayName: text(row.displayName, 64), shortName: text(row.shortName, 32), description: text(row.description), achievementDescription: text(row.achievementDescription), topLevel: row.topLevel } })
  if (new Set(levels.map(v => v.levelCode)).size !== levels.length) throw bad()
  const contributions = array(r.contributions, value => { const row = legacyObject(value); return { actionCode: action(row.actionCode), experienceSum: number(row.experienceSum, true), eventCount: number(row.eventCount), lastOccurredAt: number(row.lastOccurredAt) } })
  return { profession, levels, contributions }
}
export async function fetchLegacyProfessionRecords(professionId: string, cursor: LegacyProfessionCursor | null = null): Promise<LegacyProfessionRecords> {
  const query = new URLSearchParams({ limit: '20' })
  if (cursor) { query.set('beforeOccurredAt', String(number(cursor.beforeOccurredAt))); query.set('beforeEffectId', id(cursor.beforeEffectId)) }
  const r = await read(`/api/profession/me/${id(professionId)}/records`, query)
  let previous = cursor?.beforeOccurredAt ?? Number.MAX_SAFE_INTEGER
  const list = array(r.records, value => { const row = legacyObject(value), occurredAt = number(row.occurredAt); if (occurredAt > previous) throw bad(); previous = occurredAt; return { actionCode: action(row.actionCode), experienceDelta: number(row.experienceDelta, true), beforeExperience: number(row.beforeExperience), afterExperience: number(row.afterExperience), beforeLevelCode: text(row.beforeLevelCode, 64), afterLevelCode: text(row.afterLevelCode, 64), occurredAt, ...(row.sourceLabel !== undefined ? { sourceLabel: text(row.sourceLabel, 512) } : {}) } }, 20)
  let next: LegacyProfessionCursor | null = null
  if ('nextCursor' in r) { const row = legacyObject(r.nextCursor); next = { beforeOccurredAt: number(row.beforeOccurredAt), beforeEffectId: id(row.beforeEffectId) }; if (list.length !== 20 || next.beforeOccurredAt !== list.at(-1)?.occurredAt || cursor && next.beforeOccurredAt === cursor.beforeOccurredAt && next.beforeEffectId === cursor.beforeEffectId) throw bad() }
  return { list, next }
}
