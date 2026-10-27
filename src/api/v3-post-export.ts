import { ApiError, request, requestZip, MAX_PRIVATE_ZIP_BYTES } from './http'
import type { SecurityProof } from './v3-security'
export type ReadyExport = { jobId: string; status: 'ready'; paidPoints: number; createdAt: number; capturedAt: number; expiresAt: number; articleCount: number; commentCount: number; byteLength: number; sha256: string }
export type ExportJob = ReadyExport | { jobId: string; status: 'expired'; paidPoints: number }
type Row = Record<string, unknown>
const invalid = () => new ApiError('内容导出响应格式不正确', 502, 'invalid_response')
function object(value: unknown): Row { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Row }
function count(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid(); return value }
export function exportJobId(value: string): string { if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value)) throw new ApiError('导出任务ID不合法', 422); return value }
function job(value: unknown): ExportJob {
  const row = object(value); if (typeof row.jobId !== 'string' || !/^[1-9][0-9]{0,18}$/.test(row.jobId)) throw invalid()
  const jobId = row.jobId, paidPoints = count(row.paidPoints)
  if (!paidPoints) throw invalid()
  if (row.status === 'expired') return { jobId, status: 'expired', paidPoints }
  if (row.status !== 'ready') throw invalid()
  const createdAt = count(row.createdAt), capturedAt = count(row.capturedAt), expiresAt = count(row.expiresAt), articleCount = count(row.articleCount), commentCount = count(row.commentCount), byteLength = count(row.byteLength)
  if (!capturedAt || createdAt < capturedAt || expiresAt - createdAt !== 86400000 || !Number.isFinite(new Date(expiresAt).getTime()) || !byteLength || byteLength > MAX_PRIVATE_ZIP_BYTES || typeof row.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(row.sha256)) throw invalid()
  return { jobId, status: 'ready', paidPoints, createdAt, capturedAt, expiresAt, articleCount, commentCount, byteLength, sha256: row.sha256 }
}
async function data(path: string, init?: RequestInit): Promise<ExportJob> { const row = object(await request(path, init)); if (row.code !== 0) throw new ApiError(typeof row.msg === 'string' ? row.msg : '导出请求失败', 502); return job(row.data) }
export async function createV3PostExport(proof: SecurityProof, key: string): Promise<ExportJob> {
  if (!/^[a-f0-9]{32}$/.test(proof.currentPassword) || proof.currentTotp !== undefined && !/^[0-9]{6}$/.test(proof.currentTotp) || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new ApiError('当前安全证明或操作标识不合法', 422)
  return data('/api/v3/me/exports/posts', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ currentPassword: proof.currentPassword, ...(proof.currentTotp ? { currentTotp: proof.currentTotp } : {}) }) })
}
export async function fetchV3PostExport(id: string, signal?: AbortSignal): Promise<ReadyExport> {
  const result = await data(`/api/v3/me/exports/posts/${exportJobId(id)}`, { cache: 'no-store', signal })
  if (result.jobId !== id || result.status !== 'ready') throw invalid(); return result
}
export async function downloadV3PostExport(ready: ReadyExport, signal?: AbortSignal): Promise<Blob> {
  const checked = job(ready); if (checked.status !== 'ready') throw invalid()
  const archive = await requestZip(`/api/v3/me/exports/posts/${checked.jobId}/download`, { cache: 'no-store', signal })
  if (archive.size !== checked.byteLength || archive.type !== 'application/zip') throw invalid()
  const bytes = await archive.arrayBuffer(), signature = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength))
  if (signature.length !== 4 || signature[0] !== 0x50 || signature[1] !== 0x4b || !([3,5].includes(signature[2])) || signature[3] !== signature[2] + 1) throw invalid()
  if (!globalThis.crypto?.subtle) throw new ApiError('浏览器无法校验导出文件，请使用HTTPS或localhost访问', 503, 'unavailable')
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('')
  if (hash !== checked.sha256) throw new ApiError('导出文件校验失败，请重新读取任务状态后下载', 502, 'invalid_response')
  return archive
}
/** The browser-only URL never leaves this page and is revoked after delivery or identity change. */
export function savePrivateExport(blob: Blob, jobId: string): () => void {
  const id = exportJobId(jobId), address = URL.createObjectURL(blob), anchor = document.createElement('a')
  let timer: ReturnType<typeof setTimeout> | undefined, disposed = false
  function dispose() { if (disposed) return; disposed = true; if (timer) clearTimeout(timer); URL.revokeObjectURL(address); anchor.remove() }
  try { anchor.href = address; anchor.download = `posts-${id}.zip`; anchor.hidden = true; document.body.appendChild(anchor); anchor.click(); anchor.remove(); timer = setTimeout(dispose, 60000); return dispose }
  catch (e) { dispose(); throw e }
}
