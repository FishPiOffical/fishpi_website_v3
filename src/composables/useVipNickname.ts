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

// Legacy isVip means style rendering is enabled here; it is never an account membership claim.
const CACHE_TTL = 60_000, MAX_CACHE = 2000, MAX_PENDING = 1000
const cache = reactive(new Map<string, { value: VipNameConfig; at: number }>())
const aliases = reactive(new Map<string, { id: string; at: number }>())
export const vipNameRevision = ref(0)
let identity = getAccessToken(), generation = 0, scheduled: ReturnType<typeof setTimeout> | undefined
let activeRun: object | null = null
interface StyleJob { id: string; generation: number; cancelled: boolean; promise: Promise<VipNameConfig | undefined>; resolve: (value: VipNameConfig | undefined) => void }
const jobs = new Map<string, StyleJob>(), queue = new Map<string, StyleJob>()
interface NameJob { generation: number; cancelled: boolean; id?: string; promise: Promise<VipNameConfig> }
const names = new Map<string, NameJob>()
function nameKey(value?: string) { return value && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value.toLowerCase() : '' }
function valid(current: number) { return !import.meta.env.SSR && !!identity && current === generation && identity === getAccessToken() }
function boundedSet<K, V>(map: Map<K,V>, key: K, value: V) { if (!map.has(key) && map.size >= MAX_CACHE) map.delete(map.keys().next().value!); map.set(key, value) }
function reset() {
  generation++; cache.clear(); aliases.clear()
  for (const job of jobs.values()) { job.cancelled = true; job.resolve(undefined) }
  for (const job of names.values()) job.cancelled = true
  jobs.clear(); queue.clear(); names.clear(); activeRun = null
  if (scheduled !== undefined) clearTimeout(scheduled)
  scheduled = undefined; vipNameRevision.value++
}
const unsubscribe = onAccessTokenChange(token => { if (identity !== token) { identity = token; reset() } })
if (import.meta.hot) import.meta.hot.dispose(() => { unsubscribe(); reset() })
function schedule() { if (scheduled === undefined && !activeRun && queue.size) scheduled = setTimeout(() => { scheduled = undefined; void flush() }, 0) }
async function flush() {
  if (activeRun || !identity || !queue.size) return
  const run = {}, current = generation, batch = [...queue.values()].slice(0, 100)
  activeRun = run
  for (const job of batch) queue.delete(job.id)
  try {
    const results = await fetchV3MembershipStyles(batch.map(job => job.id))
    for (let index = 0; index < batch.length; index++) {
      const job = batch[index]!, row = results[index]!
      if (valid(current) && !job.cancelled && jobs.get(job.id) === job) {
        const value = parseVipNameConfig(Object.keys(row.style).length > 0, row.style)
        boundedSet(cache, job.id, { value, at: Date.now() }); job.resolve(value)
      }
    }
  } catch { /* Decorative read failures remain plain text and are never cached as inactive accounts. */ }
  finally {
    for (const job of batch) { job.resolve(undefined); if (jobs.get(job.id) === job) jobs.delete(job.id) }
    if (activeRun === run) { activeRun = null; schedule() }
  }
}
function queued(id: string): Promise<VipNameConfig | undefined> {
  const cached = cachedVipName(id)
  if (cached) return Promise.resolve(cached)
  const existing = jobs.get(id)
  if (existing) return existing.promise
  if (!valid(generation) || jobs.size >= MAX_PENDING) return Promise.resolve(undefined)
  let resolve!: StyleJob['resolve']
  const promise = new Promise<VipNameConfig | undefined>(done => { resolve = done })
  const job: StyleJob = { id, generation, cancelled: false, promise, resolve }
  jobs.set(id, job); queue.set(id, job); schedule(); return promise
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
  if (import.meta.env.SSR || !identity || identity !== getAccessToken()) return undefined
  const explicit = membershipUserId(userId), name = nameKey(userName), alias = !explicit && name ? aliases.get(name) : undefined
  const id = explicit || (alias && Date.now() - alias.at < CACHE_TTL ? alias.id : '')
  const entry = id ? cache.get(id) : undefined
  return entry && Date.now() - entry.at < CACHE_TTL ? entry.value : undefined
}

export async function loadVipName(userId?: string | number, userName?: string): Promise<VipNameConfig> {
  if (!valid(generation)) return { ...EMPTY_CONFIG }
  const cached = cachedVipName(userId, userName)
  if (cached) return cached
  const id = membershipUserId(userId)
  if (id) return (await queued(id)) || { ...EMPTY_CONFIG }
  const key = nameKey(userName)
  if (!key) return { ...EMPTY_CONFIG }
  const existing = names.get(key)
  if (existing) return existing.promise
  if (names.size >= MAX_PENDING) return { ...EMPTY_CONFIG }
  const job: NameJob = { generation, cancelled: false, promise: Promise.resolve({ ...EMPTY_CONFIG }) }
  job.promise = (async () => {
    try {
      const resolved = await resolveV3NicknameUser(userName!)
      if (!valid(job.generation) || job.cancelled || names.get(key) !== job) return { ...EMPTY_CONFIG }
      job.id = resolved.id
      const value = await queued(resolved.id)
      if (value && valid(job.generation) && !job.cancelled && names.get(key) === job) {
        boundedSet(aliases, key, { id: resolved.id, at: Date.now() }); return value
      }
    } catch { /* Never fall back to raw membership details or persist a failed lookup. */ }
    finally { if (names.get(key) === job) names.delete(key) }
    return { ...EMPTY_CONFIG }
  })()
  names.set(key, job); return job.promise
}

export function invalidateVipName(userId?: string | number, userName?: string) {
  const key = nameKey(userName), id = membershipUserId(userId) || (key ? aliases.get(key)?.id : '')
  if (id) {
    cache.delete(id)
    const job = jobs.get(id)
    if (job) { job.cancelled = true; job.resolve(undefined); jobs.delete(id); queue.delete(id) }
  }
  for (const [name, entry] of aliases) if (name === key || entry.id === id) aliases.delete(name)
  for (const [name, job] of names) if (name === key || !!id && job.id === id) { job.cancelled = true; names.delete(name) }
  vipNameRevision.value++
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
