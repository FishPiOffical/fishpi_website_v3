import { reactive } from 'vue'
import { fetchMembershipDetail, fetchUserProfile } from '@/api/fishpi'

export const VIP_NAME_EFFECTS = [
  'rainbow',
  'neon',
  'fire',
  'ocean',
  'forest',
  'sunset',
  'metal',
  'galaxy',
] as const

export type VipNameEffect = (typeof VIP_NAME_EFFECTS)[number]

export interface VipNameConfig {
  isVip: boolean
  bold: boolean
  underline: boolean
  color: string
  effect: VipNameEffect | ''
}

const EMPTY_CONFIG: VipNameConfig = {
  isVip: false,
  bold: false,
  underline: false,
  color: '',
  effect: '',
}

const cache = reactive(new Map<string, VipNameConfig>())
const userIds = new Map<string, string>()
const pending = new Map<string, Promise<VipNameConfig>>()

function normalizeColor(value: unknown) {
  if (typeof value !== 'string') return ''
  const color = value.trim()
  return /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(color) ? color : ''
}

export function parseVipNameConfig(isVip: boolean, configJson?: string | Record<string, unknown>): VipNameConfig {
  if (!isVip) return { ...EMPTY_CONFIG }
  let raw: Record<string, unknown> = {}
  try {
    const parsed = typeof configJson === 'string' ? JSON.parse(configJson || '{}') : configJson
    raw = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    raw = {}
  }
  const selected = typeof raw.color === 'string' ? raw.color.trim() : ''
  const effect = VIP_NAME_EFFECTS.includes(selected as VipNameEffect) ? (selected as VipNameEffect) : ''
  return {
    isVip: true,
    bold: Boolean(raw.bold),
    underline: Boolean(raw.underline),
    color: effect ? '' : normalizeColor(selected),
    effect,
  }
}

function keys(userId?: string | number, userName?: string) {
  const out: string[] = []
  if (userId != null && String(userId)) out.push(`id:${String(userId)}`)
  if (userName) out.push(`name:${userName.toLowerCase()}`)
  return out
}

function write(config: VipNameConfig, userId?: string | number, userName?: string) {
  for (const key of keys(userId, userName)) cache.set(key, config)
  if (userId != null && userName) userIds.set(userName.toLowerCase(), String(userId))
  return config
}

export function cachedVipName(userId?: string | number, userName?: string) {
  for (const key of keys(userId, userName)) {
    const value = cache.get(key)
    if (value) return value
  }
  return undefined
}

export async function loadVipName(userId?: string | number, userName?: string): Promise<VipNameConfig> {
  const cached = cachedVipName(userId, userName)
  if (cached) return cached

  let resolvedId = userId != null && String(userId) ? String(userId) : ''
  if (!resolvedId && userName) resolvedId = userIds.get(userName.toLowerCase()) || ''
  const requestKey = resolvedId ? `id:${resolvedId}` : userName ? `name:${userName.toLowerCase()}` : ''
  if (!requestKey) return { ...EMPTY_CONFIG }

  const existing = pending.get(requestKey)
  if (existing) return existing

  const request = (async () => {
    try {
      if (!resolvedId && userName) {
        const profile = await fetchUserProfile(userName)
        resolvedId = profile.oId
        if (resolvedId) userIds.set(userName.toLowerCase(), resolvedId)
      }
      if (!resolvedId) return write({ ...EMPTY_CONFIG }, userId, userName)
      const status = await fetchMembershipDetail(resolvedId)
      return write(parseVipNameConfig(status.isVip, status.configJson), resolvedId, userName)
    } catch {
      // 网络错误不缓存为非会员，后续展示时允许重新加载。
      return { ...EMPTY_CONFIG }
    } finally {
      pending.delete(requestKey)
    }
  })()
  pending.set(requestKey, request)
  return request
}

export function invalidateVipName(userId?: string | number, userName?: string) {
  for (const key of keys(userId, userName)) cache.delete(key)
}

export function vipNameClass(config: VipNameConfig | undefined) {
  return {
    'vip-nickname': Boolean(config?.isVip),
    'vip-nickname--effect': Boolean(config?.effect),
    [`vip-nickname--${config?.effect}`]: Boolean(config?.effect),
  }
}

export function vipNameStyle(config: VipNameConfig | undefined) {
  if (!config?.isVip) return undefined
  return {
    '--vip-color': config.color || undefined,
    '--vip-weight': config.bold ? '700' : undefined,
    '--vip-decoration-line': config.underline ? 'underline' : undefined,
  }
}
