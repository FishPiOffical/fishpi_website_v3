import { ApiError, getAuthContextVersion, request } from '../http'
import { getLegacyKey } from './auth'
import { legacyObject, legacyDate } from './home'
import type { AnonymousKind, AnonymousPage } from '../v3-anonymous-content'
export interface AnonymousOwner { id: string; userName: string }
const invalid = () => new ApiError('旧匿名内容响应格式不正确', 502)
function id(value: unknown): string { if (typeof value !== 'string' || !/^[1-9][0-9]{0,31}$/.test(value)) throw invalid(); return value }
function count(value: unknown) { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid(); return value }
function text(value: unknown) { if (typeof value !== 'string' || value.length > 65536) throw invalid(); return value }
function time(value: unknown) { const result = legacyDate(value); if (result < 0 || !Number.isSafeInteger(result) || !Number.isFinite(new Date(result).getTime())) throw invalid(); return result }
export async function legacyAnonymousContent(kind: AnonymousKind, p: number, size: number, owner?: AnonymousOwner): Promise<AnonymousPage> {
  const key = getLegacyKey(), context = getAuthContextVersion()
  if (!key) throw new ApiError('请先登录查看本人匿名内容', 401)
  if (!owner || !/^[A-Za-z0-9_-]{1,64}$/.test(owner.userName) || !/^[1-9][0-9]{0,31}$/.test(owner.id)) throw new ApiError('当前本人身份不完整', 401)
  if (!['articles','comments'].includes(kind) || !Number.isSafeInteger(p) || p < 1 || p > 42949672 || !Number.isSafeInteger(size) || size < 1 || size > 50) throw new ApiError('匿名内容分页参数不合法', 422)
  const ownerId = owner.id, ownerName = owner.userName
  // The local mode cookie still selects the proxy; that proxy strips page Cookies upstream.
  const result = legacyObject(await request(`/api/user/${encodeURIComponent(ownerName)}/${kind}/anonymous?` + new URLSearchParams({p: String(p), size: String(size), apiKey: key}), {cache:'no-store', redirect:'error'}))
  if (getLegacyKey() !== key || getAuthContextVersion() !== context) throw new ApiError('登录状态已变化', 409)
  if (result.code !== 0) throw new ApiError(typeof result.msg === 'string' ? result.msg : '本人匿名内容读取失败', result.msg === '无权访问' ? 403 : 400)
  const data = legacyObject(result.data), meta = legacyObject(data.pagination), total = count(meta.paginationRecordCount), pageCount = count(meta.paginationPageCount), rows = data[kind]
  if (!Array.isArray(rows) || rows.length > size || pageCount !== Math.ceil(total / size)) throw invalid()
  // Classic renderers lose total metadata on empty out-of-range pages. Do not erase a real collection.
  if (p > 1 && !rows.length && total === 0) throw new ApiError('旧接口未保留此空页的总数，请返回第一页重读', 409)
  if (rows.length !== Math.max(0, Math.min(size, total - (p - 1) * size))) throw invalid()
  if (meta.paginationCurrentPageNum !== undefined && meta.paginationCurrentPageNum !== p || meta.paginationPageSize !== undefined && meta.paginationPageSize !== size) throw invalid()
  const list = rows.map(value => {
    const row = legacyObject(value), target = id(row.oId)
    if (kind === 'articles') {
      if (row.articleAnonymous !== 1 || row.articleAuthorId !== ownerId) throw invalid()
      const type = count(row.articleType)
      if (type > 6) throw invalid()
      return {id: target, title: text(row.articleTitle), type, createdAt: time(row.articleCreateTimeStr ?? row.articleCreateTime), updatedAt: time(row.articleUpdateTimeStr ?? row.articleUpdateTime)}
    }
    if (row.commentAnonymous !== 1 || row.commentAuthorId !== ownerId || row.commentVisible !== 0 && row.commentVisible !== 1) throw invalid()
    return {id: target, articleId: id(row.commentOnArticleId), articleTitle: text(row.commentArticleTitle), createdAt: time(row.commentCreateTime), visibility: row.commentVisible as 0 | 1}
  })
  if (new Set(list.map(value => value.id)).size !== list.length) throw invalid()
  return {list, p, size, total, pageCount}
}
