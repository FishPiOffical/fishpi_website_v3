import { ApiError, request, getAuthContextVersion } from './http'
export const MAX_ENTERPRISE_IMAGE_BYTES = 5 * 1024 * 1024
export type IdentityReceipt = { id: string; createdAt: number }
export type IdentityApplication = IdentityReceipt & { type: 'enterprise'; status: 'pending' | 'approved' | 'rejected'; materialReadAt: number; reviewedAt: number; note: string }
export type IdentityPage = { list: IdentityApplication[]; p: number; size: number; total: number; pageCount: number }
type Row = Record<string, unknown>
const invalid = () => new ApiError('认证申请响应格式不正确', 502, 'invalid_response')
function object(value: unknown): Row { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Row }
function count(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid(); return value }
function time(value: unknown): number { const n = count(value); if (!Number.isFinite(new Date(n).getTime())) throw invalid(); return n }
function receipt(value: unknown): IdentityReceipt { const row = object(value); if (typeof row.id !== 'string' || !/^[1-9][0-9]{0,18}$/.test(row.id)) throw invalid(); const createdAt = time(row.createdAt); if (!createdAt) throw invalid(); return { id: row.id, createdAt } }
export function identityApplicationId(value: string): string { if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value)) throw new ApiError('申请ID不合法', 422); return value }
function application(value: unknown): IdentityApplication {
  const row = object(value), base = receipt(row), materialReadAt = time(row.materialReadAt), reviewedAt = time(row.reviewedAt)
  if (row.type !== 'enterprise' || typeof row.status !== 'string' || !['pending','approved','rejected'].includes(row.status) || typeof row.note !== 'string' || row.note.length > 256 || (row.status === 'pending' ? reviewedAt !== 0 : !reviewedAt || !materialReadAt)) throw invalid()
  return { ...base, type: 'enterprise', status: row.status as IdentityApplication['status'], materialReadAt, reviewedAt, note: row.note }
}
async function data(path: string, init?: RequestInit): Promise<unknown> { const row = object(await request(path, init)); if (row.code !== 0) throw new ApiError(typeof row.msg === 'string' ? row.msg : '认证申请失败', 502); return row.data }
/** Material stays local until explicit submission; bytes are frozen, MIME follows the actual signature. */
export async function prepareEnterpriseMaterial(file: Blob): Promise<Blob> {
  if (!(file instanceof Blob) || !file.size) throw new ApiError('请选择一张JPEG或PNG营业执照图片', 422)
  if (file.size > MAX_ENTERPRISE_IMAGE_BYTES) throw new ApiError('营业执照图片最多5MiB', 413)
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.length !== file.size || bytes.length > MAX_ENTERPRISE_IMAGE_BYTES) throw new ApiError('图片读取大小异常，请重新选择', 422)
  const pngHeader = [137,80,78,71,13,10,26,10], pngEnd = [0,0,0,0,73,69,78,68,174,66,96,130]
  const png = bytes.length >= 20 && pngHeader.every((n,i) => bytes[i] === n) && pngEnd.every((n,i) => bytes[bytes.length - pngEnd.length + i] === n)
  const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[bytes.length-2] === 255 && bytes[bytes.length-1] === 217
  if (!png && !jpeg) throw new ApiError('只接受完整JPEG或PNG图片，不能使用网址、PDF、GIF或其他文件', 422)
  return new Blob([bytes], { type: png ? 'image/png' : 'image/jpeg' })
}
export async function createV3EnterpriseApplication(file: Blob, key: string): Promise<IdentityReceipt> {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new ApiError('操作标识不合法', 422)
  const context = getAuthContextVersion(), body = await prepareEnterpriseMaterial(file)
  if (context !== getAuthContextVersion()) throw new ApiError('登录状态已变更，请重新选择材料', 401, 'stale_session')
  return receipt(await data('/api/v3/me/identity-applications/enterprise', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': body.type, 'Idempotency-Key': key }, body }))
}
export async function fetchV3IdentityApplications(p = 1, size = 20): Promise<IdentityPage> {
  if (!Number.isSafeInteger(p) || p < 1 || p > 42949672 || !Number.isSafeInteger(size) || size < 1 || size > 50) throw new ApiError('申请分页参数不合法', 422)
  const source = object(await data(`/api/v3/me/identity-applications?p=${p}&size=${size}`, { cache: 'no-store' })), pagination = object(source.pagination)
  if (!Array.isArray(source.list) || source.list.length > size || pagination.p !== p || pagination.size !== size) throw invalid()
  const total = count(pagination.total), pageCount = count(pagination.pageCount), list = source.list.map(application)
  if (pageCount !== Math.ceil(total / size) || new Set(list.map(item => item.id)).size !== list.length) throw invalid()
  return { list, p, size, total, pageCount }
}
export async function fetchV3IdentityApplication(id: string): Promise<IdentityApplication> { const result = application(await data(`/api/v3/me/identity-applications/${identityApplicationId(id)}`, { cache: 'no-store' })); if (result.id !== id) throw invalid(); return result }
