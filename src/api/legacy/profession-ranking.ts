import { ApiError, request } from '../http'
import { getLegacyKey } from './auth'
import { legacyObject } from './home'
import type { Profession } from '../v3-professions'
export type LegacyProfessionRank = { rank: number; userName: string; userNickname: string; userAvatarURL: string; professionName: string; levelName: string; totalExperience?: number }
export type LegacyProfessionRanking = { professions: Profession[]; selected: Profession; entries: LegacyProfessionRank[] }
const invalid = () => new ApiError('旧职业排行响应格式不正确', 502)
function text(value: unknown, max = 1024): string { if (typeof value !== 'string' || value.length > max) throw invalid(); return value }
function id(value: unknown) { const result = text(value, 19); if (!/^[0-9]{1,19}$/.test(result)) throw invalid(); return result }
function number(value: unknown) { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid(); return value }
function profession(value: unknown): Profession {
  const row = legacyObject(value)
  return { professionId: id(row.professionId), professionCode: text(row.professionCode, 64), displayName: text(row.displayName, 64), shortName: text(row.shortName, 32), description: text(row.description) }
}
function avatar(value: unknown): string {
  const raw = text(value, 8192)
  if (!raw) return ''
  if (/\s|[\u0000-\u001f\u007f]/.test(raw)) throw invalid()
  let parsed: URL
  try { parsed = new URL(raw, 'https://fishpi.cn') } catch { throw invalid() }
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw invalid()
  if (raw.startsWith('/') && !raw.startsWith('//')) return parsed.href
  if (!/^https?:\/\//.test(raw)) throw invalid()
  return raw
}
export async function fetchLegacyProfessionRanking(professionId = ''): Promise<LegacyProfessionRanking> {
  const apiKey = getLegacyKey()
  if (!apiKey) throw new ApiError('请先登录查看职业排行', 401)
  if (professionId) id(professionId)
  const query = new URLSearchParams({ apiKey })
  if (professionId) query.set('professionId', professionId)
  const envelope = legacyObject(await request(`/api/profession/ranking?${query}`, { cache: 'no-store' }))
  if (apiKey !== getLegacyKey()) throw new ApiError('登录状态已变化', 409)
  if (envelope.code !== 0) throw new ApiError(typeof envelope.msg === 'string' ? envelope.msg : '职业排行读取失败', 502)
  const source = legacyObject(envelope.data)
  if (!Array.isArray(source.professions) || source.professions.length > 512 || !Array.isArray(source.entries) || source.entries.length > 20) throw invalid()
  const professions = source.professions.map(profession), selected = profession(source.selectedProfession)
  if (!professions.length || new Set(professions.map(job => job.professionId)).size !== professions.length || !professions.some(job => JSON.stringify(job) === JSON.stringify(selected)) || professionId && selected.professionId !== professionId) throw invalid()
  let previous = 0
  const entries = source.entries.map(value => {
    const row = legacyObject(value), rank = number(row.rank), userName = text(row.userName, 64)
    if (rank <= previous || rank > 20 || !/^[A-Za-z0-9_-]{1,64}$/.test(userName)) throw invalid()
    previous = rank
    return { rank, userName, userNickname: text(row.userNickname, 128), userAvatarURL: avatar(row.userAvatarURL48), professionName: text(row.professionName, 64), levelName: text(row.levelName, 64), ...('totalExperience' in row ? { totalExperience: number(row.totalExperience) } : {}) }
  })
  if (new Set(entries.map(row => row.userName)).size !== entries.length) throw invalid()
  return { professions, selected, entries }
}
