import { ApiError, request } from './http'

export type AppLoginState = 'waiting' | 'claimed' | 'app_confirmed' | 'web_approved' | 'consumed' | 'denied'
export interface AppLoginStatus { state: AppLoginState; expiresAt: number }
export interface AppLoginRequest extends AppLoginStatus { request: string; qrPayload: string }
const invalid = () => new ApiError('APP扫码响应格式不正确', 502)
export function appLoginHandle(value: string) {
  // 32 bytes in canonical unpadded base64url: only four significant bits in the last character.
  if (typeof value !== 'string' || value.length !== 43 || !/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(value)) throw new ApiError('扫码请求标识不合法', 422)
  return value
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Record<string, unknown> }
export function decodeAppLoginStatus(value: unknown): AppLoginStatus {
  const row = object(value)
  if (!['waiting', 'claimed', 'app_confirmed', 'web_approved', 'consumed', 'denied'].includes(String(row.state)) || typeof row.state !== 'string' || typeof row.expiresAt !== 'number' || !Number.isSafeInteger(row.expiresAt) || row.expiresAt <= 0) throw invalid()
  return { state: row.state as AppLoginState, expiresAt: row.expiresAt }
}
async function post(path: string, body: object) {
  const envelope = object(await request('/api/v3/auth/app-login/' + path, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
  if (envelope.code !== 0) throw invalid()
  return object(envelope.data)
}
export async function createAppLoginRequest(): Promise<AppLoginRequest> {
  const row = await post('requests', {}), status = decodeAppLoginStatus(row)
  let handle: string
  try { handle = appLoginHandle(row.request as string) } catch { throw invalid() }
  if (status.state !== 'waiting' || row.qrPayload !== 'fishpi-login:v3:' + handle) throw invalid()
  return { ...status, request: handle, qrPayload: row.qrPayload }
}
export async function readAppLoginStatus(handle: string) { return decodeAppLoginStatus(await post('status', { request: appLoginHandle(handle) })) }
export async function decideAppLogin(handle: string, decision: 'approve' | 'deny') {
  if (!['approve', 'deny'].includes(decision)) throw new ApiError('扫码决定不合法', 422)
  const result = decodeAppLoginStatus(await post('decision', { request: appLoginHandle(handle), decision }))
  if (result.state !== (decision === 'approve' ? 'web_approved' : 'denied')) throw invalid()
  return result
}
