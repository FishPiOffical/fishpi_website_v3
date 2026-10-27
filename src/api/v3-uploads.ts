import { ApiError, request } from './http'
type Row = Record<string, unknown>
export type UploadResult = { name: string; url: string | null; image: boolean }
const invalid = () => new ApiError('上传服务响应不正确', 502)
function row(v: unknown): Row { if (!v || typeof v !== 'object' || Array.isArray(v)) throw invalid(); return v as Row }
function outputURL(v: unknown): string {
  if (typeof v !== 'string' || !v || /[\u0000-\u0020\u007f<>\\]/u.test(v)) throw invalid()
  try { const u = new URL(v); if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) throw invalid() } catch { throw invalid() }
  return v
}
const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'application/zip': 'zip' }
function filename(file: File, index: number) {
  const extension = /\.([a-zA-Z0-9]{1,16})$/.exec(file.name || '')?.[1]?.toLowerCase() || extensions[file.type]
  if (!extension) throw new ApiError('文件需要扩展名，请选择带文件名的文件', 422)
  // Stable unique multipart names keep duplicate user filenames distinguishable in succMap.
  return `upload-${index + 1}.${extension}`
}
export async function uploadV3Files(files: File[], signal: AbortSignal): Promise<UploadResult[]> {
  if (!files.length) return []
  const names = files.map(filename); signal.throwIfAborted()
  const envelope = row(await request('/api/v3/uploads/tickets', { method: 'POST', body: '{}', signal, cache: 'no-store' }))
  if (envelope.code !== 0) throw invalid()
  const ticket = row(envelope.data), credential = ticket.ticket, uploadURL = ticket.uploadURL
  if (typeof credential !== 'string' || !credential || credential.length > 16384 || /\s/u.test(credential) || typeof uploadURL !== 'string' || ticket.tokenType !== 'Bearer' || ticket.fieldName !== 'file') throw invalid()
  let target: URL
  try { target = new URL(uploadURL) } catch { throw invalid() }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  if (target.username || target.password || target.search || target.hash || /[\u0000-\u0020\\]/u.test(uploadURL) || !target.pathname.endsWith('/api/v1/files') || !(target.protocol === 'https:' || target.protocol === 'http:' && loopback)) throw invalid()
  signal.throwIfAborted()
  const form = new FormData(); files.forEach((file, i) => form.append('file', file, names[i]))
  const endpoint = target.href === 'https://pic.fishpi.cn/api/v1/files' ? '/rhypic-upload/api/v1/files' : uploadURL
  let response: Response
  try { response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${credential}` }, body: form, credentials: 'omit', redirect: 'error', signal }) }
  catch (error) { if (signal.aborted) throw error; throw new ApiError('上传结果未确认，请检查网络后再选择文件', 0) }
  signal.throwIfAborted()
  let result: Row
  try { result = row(await response.json()) } catch { throw new ApiError('图床响应无法解析，上传结果未确认', response.status) }
  signal.throwIfAborted()
  if (!response.ok || result.code !== 0) throw new ApiError('图床上传失败，请检查文件后重试', response.status)
  const data = row(result.data), successes = row(data.succMap), failures = data.errFiles
  if (!Array.isArray(failures) || failures.some(name => typeof name !== 'string' || !names.includes(name)) || new Set(failures).size !== failures.length || Object.keys(successes).some(name => !names.includes(name) || failures.includes(name))) throw invalid()
  return files.map((file, i) => ({ name: file.name || names[i]!, url: Object.hasOwn(successes, names[i]!) ? outputURL(successes[names[i]!]) : null, image: file.type.startsWith('image/') }))
}
export function uploadedMarkdown(result: UploadResult): string {
  if (!result.url) return ''
  const name = result.name.replace(/[\r\n\u0000-\u001f\u007f]/gu, ' ').replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/[\\[\]]/gu, '\\$&')
  const destination = result.url.replace(/[()]/gu, '\\$&')
  return `${result.image ? '!' : ''}[${name}](${destination})`
}
