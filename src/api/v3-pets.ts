import { ApiError, request } from './http'

export type PetSpeciesId = 'momota' | 'hexiaotun' | 'yubingmiao' | 'paixiaoyu'
export type PetAction = 'feed' | 'water' | 'pet' | 'play' | 'rest' | 'wake'
export type PetActivityKind = 'outing' | 'course' | 'work'
export type PetHistoryKind = PetActivityKind | 'care' | 'craft' | 'purchase' | 'story' | 'readoption' | 'all'
export interface PetRequirement { skillId: PetSkillId; experience: number }
export interface PetItemAmount { itemId: string; quantity: number }
export interface PetItem {
  id: string
  name: string
  description: string
  category: 'food' | 'drink' | 'material'
  price: number | null
  hunger: number
  effects: { hunger: number; water: number; mood: number; energy: number }
}
export interface PetRecipe {
  id: string
  name: string
  description: string
  requirements: PetRequirement[]
  ingredients: PetItemAmount[]
  coins: number
  collectionId: string
}
export interface PetStory {
  id: string
  name: string
  description: string
  steps: { id: string; description: string }[]
  rewards: { items: PetItemAmount[] }
}
export interface PetStoryProgress {
  id: string
  completedSteps: number
  status: 'active' | 'claimable' | 'claimed'
  completedAt: number | null
  claimedAt: number | null
}
export type PetJobId = 'delivery-assistant' | 'trail-assistant' | 'library-assistant' | 'broadcast-assistant' | 'craft-assistant' | 'care-assistant'
export type PetSkillId = 'vitality' | 'exploration' | 'knowledge' | 'expression' | 'crafting' | 'kindness'
export interface PetActivityCost { coins: number; energy: number; hunger: number; water: number }
export interface PetActivityRewards {
  coins: number
  proficiency: number
  experience: number
  food: number
  mood: number
  skills: { id: PetSkillId; experience: number }[]
  items: PetItemAmount[]
}
export interface PetActivityEntry {
  id: string
  name: string
  description: string
  durationMs: number
  cost: PetActivityCost
  rewards: PetActivityRewards
  requirements: PetRequirement[]
}
export interface PetJobEntry extends PetActivityEntry {
  id: PetJobId
  requirement: { skillId: PetSkillId; experience: number }
}
export interface PetActivityRecord extends Omit<PetTimedActivity, 'status'> {
  petId: string
  status: 'running' | 'claimable' | 'claimed'
  claimedAt: number | null
  actualRewards: PetActivityRewards | null
}
export interface PetActivityHistory {
  serverNow: number
  list: PetActivityRecord[]
  pagination: { page: number; pageSize: number; total: number; pageCount: number }
}
export interface PetJournalEvent {
  recordType: 'event'
  id: string
  petId: string
  kind: 'care' | 'craft' | 'purchase' | 'story' | 'readoption'
  action: string
  name: string
  occurredAt: number
  itemChanges: PetItemAmount[]
  coinsDelta: number
  effects: PetItem['effects'] & { experience: number; friendship: number }
  collectionId: string | null
}
export type PetJournalRecord = (PetActivityRecord & { recordType: 'activity' }) | PetJournalEvent
export interface PetJournal extends Omit<PetActivityHistory, 'list'> { list: PetJournalRecord[] }
export interface PetTimedActivity {
  id: string
  kind: PetActivityKind
  entryId: string
  name: string
  startedAt: number
  endsAt: number
  status: 'running' | 'claimable'
  cost: PetActivityCost
  rewards: PetActivityRewards
}
export interface PetCatalog {
  version: number
  activityVersion: number
  species: { id: PetSpeciesId; name: string; description: string }[]
  items: PetItem[]
  recipes: PetRecipe[]
  collections: { id: string; name: string; description: string }[]
  stories: PetStory[]
  readoptionRules: { coins: number }
  skills: { id: PetSkillId; name: string; description: string }[]
  places: PetActivityEntry[]
  courses: PetActivityEntry[]
  jobs: PetJobEntry[]
  incomeRules: { dailyLimit: number }
  growthRules?: { experiencePerLevel: number; maxLevel: number; careExperience: number; careFriendship: number }
  rules: {
    maxNameLength: number; initialCoins: number; initialFood: number
    dailyCoins: number; dailyFood: number; restDurationMs: number
    restEnergyPerHour: number; growthDailyLimit: number
  }
}
export interface Pet {
  id: string
  speciesId: PetSpeciesId
  name: string
  hunger: number
  water: number
  mood: number
  energy: number
  experience: number
  level: number
  friendship: number
  adoptedAt: number
  activity: null | { kind: 'rest'; startedAt: number; endsAt: number } | PetTimedActivity
  skills: { id: PetSkillId; experience: number; level: number }[]
  jobs: { id: PetJobId; experience: number; level: number; completed: number }[]
  cooldowns: { pet: number; play: number }
  growthToday: { used: number; limit: number }
}
export interface PetState {
  serverNow: number
  today: string
  catalogVersion: number
  wallet: { coins: number }
  income: { date: string; earned: number; limit: number; remaining: number }
  inventory: { itemId: string; quantity: number }[]
  collections: { id: string; unlockedAt: number }[]
  stories: PetStoryProgress[]
  dailySupply: { claimed: boolean; coins: number; food: number }
  pet: Pet | null
}
export type PetCommand = (
  | { kind: 'adoption'; speciesId: PetSpeciesId; name: string }
  | { kind: 'name'; petId: string; name: string }
  | { kind: 'actions'; petId: string; action: PetAction; itemId?: string }
  | { kind: 'supplies'; expectedDate: string }
  | { kind: 'purchases'; petId: string; itemId: string; quantity: number; catalogVersion: number }
  | { kind: 'activities'; petId: string; activityKind: PetActivityKind; entryId: string; activityVersion: number }
  | { kind: 'activities/claim'; petId: string; activityId: string }
  | { kind: 'crafts'; petId: string; recipeId: string; catalogVersion: number }
  | { kind: 'stories/claim'; petId: string; storyId: string; catalogVersion: number }
  | { kind: 'readoption'; petId: string; speciesId: PetSpeciesId; name: string; catalogVersion: number; resetAccepted: true }
) & { key: string }

const speciesIds = new Set(['momota', 'hexiaotun', 'yubingmiao', 'paixiaoyu'])
const skillIds = new Set(['vitality', 'exploration', 'knowledge', 'expression', 'crafting', 'kindness'])
const jobIds = new Set(['delivery-assistant', 'trail-assistant', 'library-assistant', 'broadcast-assistant', 'craft-assistant', 'care-assistant'])
const invalid = () => new ApiError('宠物数据格式不正确', 502)
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Record<string, unknown>
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw invalid()
  return value
}
function text(value: unknown, max = 256): string {
  if (typeof value !== 'string' || !value || value.length > max) throw invalid()
  return value
}
function flag(value: unknown): boolean {
  if (typeof value !== 'boolean') throw invalid()
  return value
}
function species(value: unknown): PetSpeciesId {
  if (typeof value !== 'string' || !speciesIds.has(value)) throw invalid()
  return value as PetSpeciesId
}
function skill(value: unknown): PetSkillId {
  if (typeof value !== 'string' || !skillIds.has(value)) throw invalid()
  return value as PetSkillId
}
function job(value: unknown): PetJobId {
  if (typeof value !== 'string' || !jobIds.has(value)) throw invalid()
  return value as PetJobId
}
function activityKind(value: unknown): PetActivityKind {
  if (value !== 'outing' && value !== 'course' && value !== 'work') throw invalid()
  return value
}
function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid()
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw invalid()
  return value
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw invalid()
  return value
}
function unique<T>(values: T[], key: (value: T) => string): T[] {
  if (new Set(values.map(key)).size !== values.length) throw invalid()
  return values
}

function activityCost(value: unknown): PetActivityCost {
  const row = object(value)
  return { coins: integer(row.coins), energy: integer(row.energy, 0, 100),
    hunger: integer(row.hunger, 0, 100), water: integer(row.water, 0, 100) }
}
function requirements(value: unknown): PetRequirement[] {
  return unique(list(value, 6).map(value => {
    const row = object(value)
    return { skillId: skill(row.skillId), experience: integer(row.experience, 1) }
  }), row => row.skillId)
}
function itemAmounts(value: unknown, signed = false): PetItemAmount[] {
  return unique(list(value, 100).map(value => {
    const row = object(value)
    const quantity = integer(row.quantity, signed ? -Number.MAX_SAFE_INTEGER : 1)
    if (quantity === 0) throw invalid()
    return { itemId: text(row.itemId, 64), quantity }
  }), row => row.itemId)
}
function effects(value: unknown, signed = false): PetItem['effects'] {
  const row = object(value)
  const gain = (key: string) => {
    const value = row[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < (signed ? -100 : 0) || value > 100) throw invalid()
    return value
  }
  return { hunger: gain('hunger'), water: gain('water'), mood: gain('mood'), energy: gain('energy') }
}
function activityRewards(value: unknown, actual = false): PetActivityRewards {
  const row = object(value)
  // 心情按服务端原始状态封顶，实际增量可能是小数，不能取整后冒充真实结算。
  if (typeof row.mood !== 'number' || !Number.isFinite(row.mood) || row.mood < 0 || row.mood > 100) throw invalid()
  return {
    coins: integer(row.coins), proficiency: integer(row.proficiency),
    experience: integer(row.experience), food: integer(row.food), mood: actual ? row.mood : integer(row.mood, 0, 100),
    skills: unique(list(row.skills, 6).map(value => {
      const entry = object(value)
      return { id: skill(entry.id), experience: integer(entry.experience, 1) }
    }), entry => entry.id),
    items: itemAmounts(row.items),
  }
}
function activityEntry(value: unknown): PetActivityEntry {
  const row = object(value)
  return { id: text(row.id, 64), name: text(row.name, 80), description: text(row.description, 500),
    durationMs: integer(row.durationMs, 1), cost: activityCost(row.cost), rewards: activityRewards(row.rewards),
    requirements: requirements(row.requirements) }
}
function activityEntries(value: unknown): PetActivityEntry[] {
  return unique(list(value, 50).map(activityEntry), entry => entry.id)
}

export function petNameLength(value: string): number {
  return typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(value)).length
    : Array.from(value).length
}

/** 前端用于输入提示；最终名字及 Unicode 字素校验由服务端裁定。 */
export function normalizePetName(value: string): string {
  if (typeof value !== 'string' || value.length > 256
      || /[<>\p{Cc}\u2028\u2029]/u.test(value)
      || Array.from(value).some(character => /\p{Cf}/u.test(character) && character !== '\u200d')
      || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) {
    throw new ApiError('名字请使用单行文字或表情，不包含特殊控制符', 422)
  }
  const normalized = value.trim()
  if (!normalized || petNameLength(normalized) > 12) throw new ApiError('宠物名字需要 1～12 个字', 422)
  return normalized
}

export function decodePetCatalog(value: unknown): PetCatalog {
  const row = object(value), rules = object(row.rules)
  const catalog: PetCatalog = {
    version: integer(row.version, 1),
    activityVersion: integer(row.activityVersion, 1),
    skills: unique(list(row.skills, 6).map(value => {
      const entry = object(value)
      return { id: skill(entry.id), name: text(entry.name, 40), description: text(entry.description, 500) }
    }), entry => entry.id),
    places: activityEntries(row.places),
    courses: activityEntries(row.courses),
    jobs: unique(list(row.jobs, 6).map(value => {
      const entry = object(value), requirement = object(entry.requirement)
      return { ...activityEntry(value), id: job(entry.id),
        requirement: { skillId: skill(requirement.skillId), experience: integer(requirement.experience, 1) } }
    }), entry => entry.id),
    incomeRules: { dailyLimit: integer(object(row.incomeRules).dailyLimit, 1) },
    species: unique(list(row.species, 4).map(value => {
      const entry = object(value)
      return { id: species(entry.id), name: text(entry.name, 40), description: text(entry.description, 500) }
    }), entry => entry.id),
    items: unique(list(row.items, 50).map(value => {
      const entry = object(value)
      if (entry.category !== 'food' && entry.category !== 'drink' && entry.category !== 'material') throw invalid()
      return { id: text(entry.id, 64), name: text(entry.name, 80), description: text(entry.description, 500),
        category: entry.category, price: entry.price === null ? null : integer(entry.price, 1),
        hunger: integer(entry.hunger, 0, 100), effects: effects(entry.effects) } as PetItem
    }), entry => entry.id),
    recipes: unique(list(row.recipes, 100).map(value => {
      const entry = object(value)
      return { id: text(entry.id, 64), name: text(entry.name, 80), description: text(entry.description, 500),
        requirements: requirements(entry.requirements), ingredients: itemAmounts(entry.ingredients),
        coins: integer(entry.coins), collectionId: text(entry.collectionId, 64) }
    }), entry => entry.id),
    collections: unique(list(row.collections, 100).map(value => {
      const entry = object(value)
      return { id: text(entry.id, 64), name: text(entry.name, 80), description: text(entry.description, 500) }
    }), entry => entry.id),
    stories: unique(list(row.stories, 20).map(value => {
      const entry = object(value)
      const steps = unique(list(entry.steps, 20).map(value => {
        const step = object(value)
        return { id: text(step.id, 64), description: text(step.description, 500) }
      }), step => step.id)
      if (!steps.length) throw invalid()
      return { id: text(entry.id, 64), name: text(entry.name, 80), description: text(entry.description, 500),
        steps, rewards: { items: itemAmounts(object(entry.rewards).items) } }
    }), entry => entry.id),
    readoptionRules: { coins: integer(object(row.readoptionRules).coins, 1) },
    rules: {
      maxNameLength: integer(rules.maxNameLength, 1, 12), initialCoins: integer(rules.initialCoins),
      initialFood: integer(rules.initialFood), dailyCoins: integer(rules.dailyCoins),
      dailyFood: integer(rules.dailyFood), restDurationMs: integer(rules.restDurationMs, 1),
      restEnergyPerHour: integer(rules.restEnergyPerHour, 1, 100), growthDailyLimit: integer(rules.growthDailyLimit, 1),
    },
  }
  if (catalog.species.length !== 4 || catalog.skills.length !== 6 || catalog.jobs.length !== 6 || !catalog.items.some(item => item.id === 'food')) throw invalid()
  const itemIds = new Set(catalog.items.map(item => item.id)), collectionIds = new Set(catalog.collections.map(item => item.id))
  // 旧目录缺失时保持未知，不在客户端补造成长规则。
  if (row.growthRules !== undefined) {
    const growth = object(row.growthRules)
    catalog.growthRules = { experiencePerLevel: integer(growth.experiencePerLevel, 1), maxLevel: integer(growth.maxLevel, 1, 30),
      careExperience: integer(growth.careExperience), careFriendship: integer(growth.careFriendship, 0, 100) }
  }
  if (catalog.items.some(item => item.hunger !== item.effects.hunger)
      || catalog.recipes.some(recipe => !collectionIds.has(recipe.collectionId) || !recipe.ingredients.length
        || recipe.ingredients.some(item => !itemIds.has(item.itemId)))
      || [...catalog.places, ...catalog.courses, ...catalog.jobs].some(entry => entry.rewards.items.some(item => !itemIds.has(item.itemId)))
      || catalog.stories.some(story => story.rewards.items.some(item => !itemIds.has(item.itemId)))) throw invalid()
  return catalog
}

export function decodePetState(value: unknown): PetState {
  const row = object(value), wallet = object(row.wallet), daily = object(row.dailySupply)
  let pet: Pet | null = null
  if (row.pet !== null) {
    const data = object(row.pet), cooldowns = object(data.cooldowns), growth = object(data.growthToday)
    let activity: Pet['activity'] = null
    if (data.activity !== null) {
      const item = object(data.activity)
      const times = { startedAt: integer(item.startedAt), endsAt: integer(item.endsAt) }
      if (item.kind === 'rest') activity = { kind: 'rest', ...times }
      else if (item.status === 'running' || item.status === 'claimable') {
        activity = { id: text(item.id, 64), kind: activityKind(item.kind), entryId: text(item.entryId, 64), name: text(item.name, 80),
          ...times, status: item.status, cost: activityCost(item.cost), rewards: activityRewards(item.rewards) }
        if ((activity.status === 'claimable') !== (integer(row.serverNow) >= activity.endsAt)) throw invalid()
      } else throw invalid()
      if (activity.endsAt <= activity.startedAt) throw invalid()
    }
    pet = {
      id: text(data.id, 64), speciesId: species(data.speciesId), name: text(data.name),
      hunger: integer(data.hunger, 0, 100), water: integer(data.water, 0, 100),
      mood: integer(data.mood, 0, 100), energy: integer(data.energy, 0, 100),
      experience: integer(data.experience), level: integer(data.level, 1, 30),
      friendship: integer(data.friendship, 0, 100), adoptedAt: integer(data.adoptedAt), activity,
      skills: unique(list(data.skills, 6).map(value => {
        const entry = object(value)
        return { id: skill(entry.id), experience: integer(entry.experience), level: integer(entry.level, 1, 30) }
      }), entry => entry.id),
      jobs: unique(list(data.jobs, 6).map(value => {
        const entry = object(value)
        return { id: job(entry.id), experience: integer(entry.experience), level: integer(entry.level, 1, 30), completed: integer(entry.completed) }
      }), entry => entry.id),
      cooldowns: { pet: integer(cooldowns.pet), play: integer(cooldowns.play) },
      growthToday: { used: integer(growth.used), limit: integer(growth.limit, 1) },
    }
    if (pet.growthToday.used > pet.growthToday.limit || pet.skills.length !== 6 || pet.jobs.length !== 6) throw invalid()
  }
  const income = object(row.income)
  const earned = integer(income.earned), limit = integer(income.limit, 1), remaining = integer(income.remaining)
  if (remaining !== Math.max(0, limit - earned)) throw invalid()
  return {
    serverNow: integer(row.serverNow), today: date(row.today), catalogVersion: integer(row.catalogVersion, 1),
    wallet: { coins: integer(wallet.coins) },
    income: { date: date(income.date), earned, limit, remaining },
    inventory: unique(list(row.inventory, 100).map(value => {
      const item = object(value)
      return { itemId: text(item.itemId, 64), quantity: integer(item.quantity) }
    }), item => item.itemId),
    collections: unique(list(row.collections, 100).map(value => {
      const item = object(value)
      return { id: text(item.id, 64), unlockedAt: integer(item.unlockedAt) }
    }), item => item.id),
    stories: unique(list(row.stories, 20).map(value => {
      const item = object(value)
      if (item.status !== 'active' && item.status !== 'claimable' && item.status !== 'claimed') throw invalid()
      const completedSteps = integer(item.completedSteps, 0, 20)
      const completedAt = item.completedAt === null ? null : integer(item.completedAt)
      const claimedAt = item.claimedAt === null ? null : integer(item.claimedAt)
      if ((item.status === 'active') !== (completedAt === null)
          || (item.status === 'claimed') !== (claimedAt !== null)
          || (completedAt !== null && (completedSteps === 0 || completedAt > integer(row.serverNow)))
          || (claimedAt !== null && (completedAt === null || claimedAt < completedAt || claimedAt > integer(row.serverNow)))) throw invalid()
      return { id: text(item.id, 64), completedSteps, status: item.status, completedAt, claimedAt }
    }), item => item.id),
    dailySupply: { claimed: flag(daily.claimed), coins: integer(daily.coins), food: integer(daily.food) }, pet,
  }
}

function activityRecord(value: unknown, serverNow: number): PetActivityRecord {
  const item = object(value)
  if (item.status !== 'running' && item.status !== 'claimable' && item.status !== 'claimed') throw invalid()
  const startedAt = integer(item.startedAt), endsAt = integer(item.endsAt)
  const claimedAt = item.claimedAt === null ? null : integer(item.claimedAt)
  if (endsAt <= startedAt || (item.status === 'claimed') !== (claimedAt !== null)
      || (claimedAt !== null && claimedAt < endsAt)) throw invalid()
  if (item.status !== 'claimed' && (item.status === 'claimable') !== (serverNow >= endsAt)) throw invalid()
  // 早期已领取活动没有结算快照，保留未知，不能拿目录奖励冒充实际到账。
  const actualRewards = item.actualRewards === null ? null : activityRewards(item.actualRewards, true)
  if (item.status !== 'claimed' && actualRewards !== null) throw invalid()
  return { id: text(item.id, 64), petId: text(item.petId, 64), kind: activityKind(item.kind),
    entryId: text(item.entryId, 64), name: text(item.name, 80), startedAt, endsAt,
    status: item.status, claimedAt, actualRewards, cost: activityCost(item.cost), rewards: activityRewards(item.rewards) }
}
function historyPage(value: unknown) {
  const row = object(value), pagination = object(row.pagination)
  const serverNow = integer(row.serverNow)
  const page = integer(pagination.page, 1, 10000), pageSize = integer(pagination.pageSize, 1, 50)
  const total = integer(pagination.total), pageCount = integer(pagination.pageCount, 1)
  if (pageCount !== Math.max(1, Math.ceil(total / pageSize))) throw invalid()
  const values = list(row.list, pageSize)
  if (values.length > total) throw invalid()
  return { serverNow, values, pagination: { page, pageSize, total, pageCount } }
}
export function decodePetActivityHistory(value: unknown): PetActivityHistory {
  const { serverNow, values, pagination } = historyPage(value)
  return { serverNow, list: unique(values.map(value => activityRecord(value, serverNow)), item => item.id), pagination }
}
export function decodePetJournal(value: unknown): PetJournal {
  const { serverNow, values, pagination } = historyPage(value)
  const records = values.map((value): PetJournalRecord => {
    const item = object(value)
    if (item.recordType === 'activity') return { ...activityRecord(value, serverNow), recordType: 'activity' }
    if (item.recordType !== 'event' || !['care', 'craft', 'purchase', 'story', 'readoption'].includes(String(item.kind))) throw invalid()
    const kind = item.kind as PetJournalEvent['kind'], action = text(item.action, 40)
    if (kind === 'care' ? !['feed', 'water', 'pet', 'play', 'rest', 'wake'].includes(action)
      : action !== (kind === 'story' ? 'story-claim' : kind)) throw invalid()
    const gains = object(item.effects), occurredAt = integer(item.occurredAt)
    const collectionId = item.collectionId === null ? null : text(item.collectionId, 64)
    if ((kind === 'craft') !== (collectionId !== null)) throw invalid()
    return { recordType: 'event', id: text(item.id, 64), petId: text(item.petId, 64), kind, action,
      name: text(item.name, 80), occurredAt, itemChanges: itemAmounts(item.itemChanges, true),
      coinsDelta: integer(item.coinsDelta, -Number.MAX_SAFE_INTEGER),
      effects: { ...effects(gains, true), experience: integer(gains.experience), friendship: integer(gains.friendship, 0, 100) }, collectionId }
  })
  return { serverNow, list: unique(records, item => `${item.recordType}:${item.id}`), pagination }
}

// 截止时间包含响应正文读取；写入超时只代表结果未知，不能据此重新生成命令。
async function petRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const cancel = () => controller.abort(init.signal?.reason)
  const timer = setTimeout(() => controller.abort(new ApiError('等待响应超时，请稍后核对', 0, 'pet_timeout')), 15_000)
  init.signal?.addEventListener('abort', cancel, { once: true })
  if (init.signal?.aborted) cancel()
  let rejectAbort: (() => void) | undefined
  try {
    return await new Promise<T>((resolve, reject) => {
      rejectAbort = () => reject(controller.signal.reason ?? new DOMException('已取消', 'AbortError'))
      controller.signal.addEventListener('abort', rejectAbort, { once: true })
      if (controller.signal.aborted) { rejectAbort(); return }
      request<T>(path, { ...init, signal: controller.signal }).then(resolve, reject)
    })
  } finally {
    clearTimeout(timer)
    init.signal?.removeEventListener('abort', cancel)
    if (rejectAbort) controller.signal.removeEventListener('abort', rejectAbort)
  }
}

async function read<T>(path: string, decode: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
  const result = await petRequest<{ code: number; data: unknown }>(path, { signal, cache: 'no-store' })
  if (result?.code !== 0) throw invalid()
  return decode(result.data)
}
export const readPetCatalog = (signal?: AbortSignal) => read('/api/v3/pets/catalog', decodePetCatalog, signal)
export const readPetState = (signal?: AbortSignal) => read('/api/v3/me/pet', decodePetState, signal)
export async function readPetActivityHistory(kind: PetActivityKind | 'all', page: number, signal?: AbortSignal): Promise<PetActivityHistory> {
  if (!['all', 'outing', 'course', 'work'].includes(kind)) throw invalid()
  integer(page, 1, 10000)
  const result = await read(`/api/v3/me/pet/activities?kind=${kind}&p=${page}&size=10`, decodePetActivityHistory, signal)
  if (result.pagination.page !== page || result.pagination.pageSize !== 10
      || (kind !== 'all' && result.list.some(item => item.kind !== kind))) throw invalid()
  return result
}
export async function readPetJournal(kind: PetHistoryKind, page: number, signal?: AbortSignal): Promise<PetJournal> {
  if (!['all', 'outing', 'course', 'work', 'care', 'craft', 'purchase', 'story', 'readoption'].includes(kind)) throw invalid()
  integer(page, 1, 10000)
  const result = await read(`/api/v3/me/pet/journal?kind=${kind}&p=${page}&size=10`, decodePetJournal, signal)
  if (result.pagination.page !== page || result.pagination.pageSize !== 10
      || (kind !== 'all' && result.list.some(item => item.kind !== kind))) throw invalid()
  return result
}

export async function executePetCommand(command: PetCommand, signal?: AbortSignal): Promise<{ petId: string }> {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(command.key)) throw new ApiError('操作标识不合法', 422)
  const { kind, key, ...input } = command
  // 命令的本地路由标识与服务端活动类型分开，原键恢复始终发送冻结的活动类型。
  const body = command.kind === 'activities'
    ? { petId: command.petId, kind: command.activityKind, entryId: command.entryId, activityVersion: command.activityVersion }
    : input
  const response = await petRequest<{ code: number; data: unknown }>(`/api/v3/me/pet/${kind}`, {
    method: kind === 'name' ? 'PUT' : 'POST',
    headers: { 'Idempotency-Key': key }, body: JSON.stringify(body), signal,
  })
  if (response?.code !== 0) throw invalid()
  const receipt = object(response.data)
  const expectedOperation = command.kind === 'actions' ? command.action : command.kind === 'purchases' ? 'purchase'
    : command.kind === 'activities' ? 'activity-start' : command.kind === 'activities/claim' ? 'activity-claim'
      : command.kind === 'crafts' ? 'craft' : command.kind === 'stories/claim' ? 'story-claim' : command.kind
  if (text(receipt.operation, 80) !== expectedOperation) throw invalid()
  text(receipt.petId, 64)
  integer(receipt.committedAt)
  // 更换宠物回执必须同时证明旧目标与新身份，不能把历史回执当成当前宠物状态。
  if (command.kind === 'readoption') {
    if (text(receipt.previousPetId, 64) !== command.petId || receipt.petId === command.petId) throw invalid()
  } else if ('petId' in command && receipt.petId !== command.petId) throw invalid()
  if (command.kind === 'stories/claim' && text(receipt.storyId, 64) !== command.storyId) throw invalid()
  if (command.kind === 'activities' || command.kind === 'activities/claim') {
    text(receipt.activityId, 64)
    if (command.kind === 'activities/claim' && receipt.activityId !== command.activityId) throw invalid()
  }
  // 仅返回已校验的目标标识，供动画核对当前宠物；养成状态仍只采用后续聚合读取。
  return { petId: receipt.petId as string }
}
