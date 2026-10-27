import { ApiError, request } from './http'

type Row = Record<string, unknown>
const root = '/api/v3/me/settings'
const invalid = () => new ApiError('设置接口响应格式不正确', 502, 'invalid_response')
function row(value: unknown): Row { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Row }
function text(value: unknown): string { if (typeof value !== 'string') throw invalid(); return value }
async function data(path: string, init?: RequestInit): Promise<Row> {
  const envelope = row(await request(path, init))
  if (envelope.code !== 0) throw invalid()
  return row(envelope.data)
}
export interface OwnerProfile { userNickname: string; userIntro: string; userURL: string }
function profile(value: Row): OwnerProfile { return { userNickname: text(value.userNickname), userIntro: text(value.userIntro), userURL: text(value.userURL) } }
function personality(value: Row): string {
  const mbti = text(value.mbti)
  if (mbti && !/^[IE][NS][TF][JP](?:-[AT])?$/.test(mbti)) throw invalid()
  return mbti
}
export function profileOperationKey(): string { return `settings:${Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('')}` }
async function put(resource: string, body: Row, key: string): Promise<Row> {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new ApiError('操作标识不合法', 422)
  return data(`${root}/${resource}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) })
}
export async function fetchV3Profile(): Promise<OwnerProfile> { return profile(await data(`${root}/profile`)) }
export async function saveV3Profile(value: OwnerProfile, key: string): Promise<OwnerProfile> {
  return profile(await put('profile', { userNickname: value.userNickname, userIntro: value.userIntro, userURL: value.userURL }, key))
}
export async function fetchV3Personality(): Promise<string> { return personality(await data(`${root}/personality`)) }
export async function fetchV3PersonalityOptions(): Promise<{ types: string[]; variants: string[] }> {
  const value = await data(`${root}/personality-options`)
  if (!Array.isArray(value.types) || !Array.isArray(value.variants) || value.types.some(t => typeof t !== 'string' || !/^[IE][NS][TF][JP]$/.test(t)) || value.variants.some(v => v !== 'A' && v !== 'T')) throw invalid()
  return { types: value.types as string[], variants: value.variants as string[] }
}
export async function saveV3Personality(mbti: string, key: string): Promise<string> { return personality(await put('personality', { mbti }, key)) }
export async function fetchV3Qq(): Promise<string> { return text((await data(`${root}/qq`)).qq) }
export async function saveV3Qq(qq: string, key: string): Promise<string> {
  const saved = text((await put('qq', { qq }, key)).qq)
  if (saved && !/^[0-9]{1,12}$/.test(saved)) throw invalid()
  return saved
}
function profileTags(source: Row): string { const value = text(source.tags); if (value.length > 128) throw invalid(); return value }
export async function fetchV3ProfileTags(): Promise<string> { return profileTags(await data(`${root}/tags`)) }
export async function saveV3ProfileTags(tags: string, key: string): Promise<string> { return profileTags(await put('tags', { tags }, key)) }
/** Read may contain a legacy HTTP address. New saves still require HTTPS on the server. */
export function displayAvatar(raw: string): string {
  if (!raw || /[\u0000-\u0020\\]/.test(raw) || raw.startsWith('//')) return ''
  try { const url = new URL(raw, 'https://fishpi.cn'); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? raw : '' } catch { return '' }
}
export async function fetchV3Avatar(): Promise<string> { return displayAvatar(text((await data(`${root}/avatar`)).avatarURL)) }
export async function saveV3Avatar(avatarURL: string, key: string): Promise<string> {
  const value = text((await put('avatar', { avatarURL }, key)).avatarURL)
  if (value !== avatarURL) throw invalid()
  return value
}

export async function uploadV3Avatar(file: File, signal: AbortSignal): Promise<string> {
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const png = [137,80,78,71,13,10,26,10].every((b, i) => header[i] === b)
  const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255
  const gif = header[0] === 71 && header[1] === 73 && header[2] === 70 && header[3] === 56 && [55,57].includes(header[4]!) && header[5] === 97
  if (!png && !jpeg && !gif) throw new ApiError('头像请选择 JPEG、PNG 或 GIF 图片，暂不支持 WebP', 422)
  signal.throwIfAborted()
  const ticket = await data('/api/v3/uploads/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal })
  const credential = text(ticket.ticket), uploadURL = text(ticket.uploadURL)
  let target: URL
  try { target = new URL(uploadURL) } catch { throw invalid() }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)
  if (!credential || /\s/.test(credential) || credential.length > 16384 || ticket.tokenType !== 'Bearer' || ticket.fieldName !== 'file'
    || target.username || target.password || target.search || target.hash || !target.pathname.endsWith('/api/v1/files')
    || !(target.protocol === 'https:' || target.protocol === 'http:' && loopback)) throw invalid()
  signal.throwIfAborted()
  const form = new FormData(), name = `avatar.${png ? 'png' : jpeg ? 'jpg' : 'gif'}`
  form.append('file', new Blob([file], { type: png ? 'image/png' : jpeg ? 'image/jpeg' : 'image/gif' }), name)
  // The existing proxy has one fixed destination; other configured targets use their exact URL.
  const endpoint = target.href === 'https://pic.fishpi.cn/api/v1/files' ? '/rhypic-upload/api/v1/files' : uploadURL
  let response: Response
  try { response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${credential}` }, body: form, credentials: 'omit', redirect: 'error', signal }) }
  catch (error) { if (signal.aborted) throw error; throw new ApiError('头像上传失败，请检查网络后重试', 0) }
  signal.throwIfAborted()
  let result: Row
  try { result = row(await response.json()) } catch { throw new ApiError('图床响应无法解析', response.status) }
  if (!response.ok || result.code !== 0) throw new ApiError('头像上传失败，请重试', response.status)
  const body = row(result.data), failures = body.errFiles, urls = row(body.succMap)
  if (!Array.isArray(failures) || failures.length) throw new ApiError('头像上传失败，请重试', 502)
  const url = text(urls[name])
  if (displayAvatar(url) !== url) throw invalid()
  try { if (new URL(url).protocol !== 'https:') throw invalid() } catch { throw invalid() }
  return url
}
