import { reactive, ref } from 'vue'
import { getAccessToken, onAccessTokenChange } from '@/api/http'
import { fetchV3MembershipStyles, membershipUserId, resolveV3NicknameUser } from '@/api/v3-membership-styles'

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

// Legacy isVip only enables rendering; a missing/empty style is never membership-status evidence.
const ALIAS_TTL = 60_000, MAX_ALIASES = 2000, MAX_PENDING = 1000, FAILURE_COOLDOWN = 30_000
const cache = reactive(new Map<string, VipNameConfig | undefined>())
const aliases = reactive(new Map<string, { id: string; at: number }>())
const freshUntil = ref(0)
export const vipNameRevision = ref(0)
let identity = getAccessToken(), generation = 0, version: string | undefined
let snapshot: Map<string, VipNameConfig | undefined> | undefined
let expiryTimer: ReturnType<typeof setTimeout> | undefined, retryTimer: ReturnType<typeof setTimeout> | undefined
let blockedUntil = 0, failures = 0
interface SnapshotJob { generation: number; promise: Promise<boolean>; resolve: (value: boolean) => void }
let flight: SnapshotJob | undefined
interface NameJob { generation: number; cancelled: boolean; promise: Promise<VipNameConfig> }
const names = new Map<string, NameJob>()
function nameKey(value?: string) { return value && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value.toLowerCase() : '' }
function valid(current: number) { return !import.meta.env.SSR && !!identity && current === generation && identity === getAccessToken() }
function boundedAlias(key: string, id: string) {
  if (!aliases.has(key) && aliases.size >= MAX_ALIASES) aliases.delete(aliases.keys().next().value!)
  aliases.set(key, { id, at: Date.now() })
}
function expire() {
  if (expiryTimer !== undefined) clearTimeout(expiryTimer)
  expiryTimer = undefined
  if (!valid(generation)) return
  expiryTimer = setTimeout(() => {
    expiryTimer = undefined; freshUntil.value = 0; cache.clear()
    for (const [name, alias] of aliases) if (Date.now() - alias.at >= ALIAS_TTL) aliases.delete(name)
    // The retained version is only a conditional-read validator, never permission to show stale CSS.
    vipNameRevision.value++
  }, Math.max(1, freshUntil.value - Date.now()))
}
function reset() {
  generation++; flight?.resolve(false); flight = undefined
  freshUntil.value = 0; cache.clear(); snapshot = undefined; version = undefined; aliases.clear()
  for (const job of names.values()) job.cancelled = true
  names.clear()
  if (expiryTimer !== undefined) clearTimeout(expiryTimer)
  if (retryTimer !== undefined) clearTimeout(retryTimer)
  expiryTimer = undefined; retryTimer = undefined; blockedUntil = 0; failures = 0
  vipNameRevision.value++
}
const unsubscribe = onAccessTokenChange(token => { if (identity !== token) { identity = token; reset() } })
if (import.meta.hot) import.meta.hot.dispose(() => { unsubscribe(); identity = null; reset() })
function readSnapshot(): Promise<boolean> {
  if (!valid(generation)) return Promise.resolve(false)
  if (freshUntil.value > Date.now()) return Promise.resolve(true)
  if (flight) return flight.promise
  if (Date.now() < blockedUntil) return Promise.resolve(false)
  let resolve!: SnapshotJob['resolve']
  const job: SnapshotJob = { generation, promise: new Promise(done => { resolve = done }), resolve }
  flight = job
  const requestedVersion = version
  void (async () => {
    try {
      // A shared server lease can expire in transit. One fresh read crosses that
      // boundary; never turn a near-expiry response into a repeated tight loop.
      let started = Date.now()
      let result = await fetchV3MembershipStyles(requestedVersion)
      if (valid(job.generation) && flight === job && started + result.maxAgeMs <= Date.now()) {
        started = Date.now()
        result = await fetchV3MembershipStyles(requestedVersion)
      }
      if (!valid(job.generation) || flight !== job) return
      const deadline = started + result.maxAgeMs
      if (deadline <= Date.now()) throw new Error('昵称快照在传输期间已过期')
      let next = snapshot
      if (!result.unchanged) next = new Map(result.list.map(row => [row.userId, row.style === null ? undefined : parseVipNameConfig(Object.keys(row.style).length > 0, row.style)]))
      if (!next) throw new Error('缺少昵称快照')
      snapshot = next; version = result.version; failures = 0; blockedUntil = 0
      cache.clear()
      for (const [id, config] of next) cache.set(id, config)
      freshUntil.value = deadline
      expire(); job.resolve(true)
    } catch {
      if (valid(job.generation) && flight === job) {
        freshUntil.value = 0; cache.clear()
        const delay = Math.min(300_000, FAILURE_COOLDOWN * 2 ** Math.min(failures++, 4))
        blockedUntil = Date.now() + delay
        if (retryTimer !== undefined) clearTimeout(retryTimer)
        retryTimer = setTimeout(() => { retryTimer = undefined; if (valid(job.generation)) vipNameRevision.value++ }, delay)
      }
    } finally { job.resolve(false); if (flight === job) flight = undefined }
  })()
  return job.promise
}

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

export function cachedVipName(userId?: string | number, userName?: string) {
  if (!valid(generation) || freshUntil.value <= Date.now()) return undefined
  const explicit = membershipUserId(userId), key = nameKey(userName), alias = !explicit && key ? aliases.get(key) : undefined
  const id = explicit || (alias && Date.now() - alias.at < ALIAS_TTL ? alias.id : '')
  if (!id) return undefined
  // IDs absent from a confirmed full snapshot have no nickname style; do not request them individually.
  return cache.has(id) ? cache.get(id) : EMPTY_CONFIG
}

export async function loadVipName(userId?: string | number, userName?: string): Promise<VipNameConfig> {
  if (!valid(generation)) return { ...EMPTY_CONFIG }
  const cached = cachedVipName(userId, userName)
  if (cached) return cached
  const id = membershipUserId(userId), current = generation
  if (id) { await readSnapshot(); return valid(current) ? cachedVipName(id) || { ...EMPTY_CONFIG } : { ...EMPTY_CONFIG } }
  const key = nameKey(userName)
  if (!key || Date.now() < blockedUntil) return { ...EMPTY_CONFIG }
  const alias = aliases.get(key)
  if (alias && Date.now() - alias.at < ALIAS_TTL) { await readSnapshot(); return valid(current) ? cachedVipName(alias.id) || { ...EMPTY_CONFIG } : { ...EMPTY_CONFIG } }
  const existing = names.get(key)
  if (existing) return existing.promise
  if (names.size >= MAX_PENDING) return { ...EMPTY_CONFIG }
  const job: NameJob = { generation, cancelled: false, promise: Promise.resolve({ ...EMPTY_CONFIG }) }
  job.promise = (async () => {
    try {
      const resolved = await resolveV3NicknameUser(userName!)
      if (!valid(job.generation) || job.cancelled || names.get(key) !== job) return { ...EMPTY_CONFIG }
      await readSnapshot()
      if (valid(job.generation) && !job.cancelled && names.get(key) === job && freshUntil.value > Date.now()) {
        boundedAlias(key, resolved.id)
        return cachedVipName(resolved.id) || { ...EMPTY_CONFIG }
      }
    } catch { /* No legacy profile or raw-config fallback. */ }
    finally { if (names.get(key) === job) names.delete(key) }
    return { ...EMPTY_CONFIG }
  })()
  names.set(key, job); return job.promise
}

export function invalidateVipName(_userId?: string | number, _userName?: string) {
  // A local update invalidates the complete snapshot and all older in-flight versions.
  reset()
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
