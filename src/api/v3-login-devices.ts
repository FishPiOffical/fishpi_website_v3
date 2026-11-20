import { ApiError, request } from './http'

const deviceFlag = import.meta.env.VITE_LOGIN_DEVICES_ENABLED
export const loginDevicesEnabled = deviceFlag === 'true' || (deviceFlag === undefined && import.meta.env.DEV)

export interface LoginDevice {
  id: string
  label: string
  lastActiveAt: number
  current: boolean
}

const path = '/api/v3/me/security/devices'
const deviceId = /^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/
const invalid = () => new ApiError('登录设备响应格式错误', 502, 'invalid_response')

function requireLoginDevices() {
  if (!loginDevicesEnabled) throw new ApiError('登录设备暂未开放', 404, 'feature_unavailable')
}

export async function fetchLoginDevices(signal: AbortSignal): Promise<LoginDevice[]> {
  requireLoginDevices()
  const response = await request<{code: number; data: {list: LoginDevice[]}}>(path, { signal, cache: 'no-store' })
  if (response?.code !== 0 || !Array.isArray(response.data?.list)) throw invalid()
  const seen = new Set<string>()
  return response.data.list.map(row => {
    if (!row || typeof row.id !== 'string' || !deviceId.test(row.id) || seen.has(row.id)
      || typeof row.label !== 'string' || !row.label.trim() || typeof row.current !== 'boolean'
      || !Number.isSafeInteger(row.lastActiveAt) || row.lastActiveAt <= 0) throw invalid()
    seen.add(row.id)
    return { id: row.id, label: row.label, lastActiveAt: row.lastActiveAt, current: row.current }
  })
}

export async function revokeLoginDevice(id: string, signal: AbortSignal): Promise<void> {
  requireLoginDevices()
  if (!deviceId.test(id)) throw invalid()
  const response = await request<{code: number; data: {revoked: boolean}}>(`${path}/${id}`, {
    method: 'DELETE', cache: 'no-store', signal,
  })
  if (response?.code !== 0 || response.data?.revoked !== true) throw invalid()
}
