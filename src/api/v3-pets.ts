import { ApiError, request } from './http'

export type PetSpeciesId = 'momota' | 'hexiaotun' | 'yubingmiao' | 'paixiaoyu'
export type PetAction = 'feed' | 'water' | 'pet' | 'play' | 'rest' | 'wake'
export interface PetCatalog {
  version: number
  species: { id: PetSpeciesId; name: string; description: string }[]
  items: { id: string; name: string; price: number; hunger: number }[]
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
  activity: null | { kind: 'rest'; startedAt: number; endsAt: number }
  cooldowns: { pet: number; play: number }
  growthToday: { used: number; limit: number }
}
export interface PetState {
  serverNow: number
  today: string
  catalogVersion: number
  wallet: { coins: number }
  inventory: { itemId: string; quantity: number }[]
  dailySupply: { claimed: boolean; coins: number; food: number }
  pet: Pet | null
}
export type PetCommand = (
  | { kind: 'adoption'; speciesId: PetSpeciesId; name: string }
  | { kind: 'name'; petId: string; name: string }
  | { kind: 'actions'; petId: string; action: PetAction; itemId?: string }
  | { kind: 'supplies'; expectedDate: string }
  | { kind: 'purchases'; petId: string; itemId: string; quantity: number; catalogVersion: number }
) & { key: string }

const speciesIds = new Set(['momota', 'hexiaotun', 'yubingmiao', 'paixiaoyu'])
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
    species: unique(list(row.species, 4).map(value => {
      const entry = object(value)
      return { id: species(entry.id), name: text(entry.name, 40), description: text(entry.description, 500) }
    }), entry => entry.id),
    items: unique(list(row.items, 50).map(value => {
      const entry = object(value)
      return { id: text(entry.id, 64), name: text(entry.name, 80), price: integer(entry.price, 1), hunger: integer(entry.hunger, 0, 100) }
    }), entry => entry.id),
    rules: {
      maxNameLength: integer(rules.maxNameLength, 1, 12), initialCoins: integer(rules.initialCoins),
      initialFood: integer(rules.initialFood), dailyCoins: integer(rules.dailyCoins),
      dailyFood: integer(rules.dailyFood), restDurationMs: integer(rules.restDurationMs, 1),
      restEnergyPerHour: integer(rules.restEnergyPerHour, 1, 100), growthDailyLimit: integer(rules.growthDailyLimit, 1),
    },
  }
  if (catalog.species.length !== 4 || !catalog.items.some(item => item.id === 'food')) throw invalid()
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
      if (item.kind !== 'rest') throw invalid()
      activity = { kind: 'rest', startedAt: integer(item.startedAt), endsAt: integer(item.endsAt) }
      if (activity.endsAt <= activity.startedAt) throw invalid()
    }
    pet = {
      id: text(data.id, 64), speciesId: species(data.speciesId), name: text(data.name),
      hunger: integer(data.hunger, 0, 100), water: integer(data.water, 0, 100),
      mood: integer(data.mood, 0, 100), energy: integer(data.energy, 0, 100),
      experience: integer(data.experience), level: integer(data.level, 1, 30),
      friendship: integer(data.friendship, 0, 100), adoptedAt: integer(data.adoptedAt), activity,
      cooldowns: { pet: integer(cooldowns.pet), play: integer(cooldowns.play) },
      growthToday: { used: integer(growth.used), limit: integer(growth.limit, 1) },
    }
    if (pet.growthToday.used > pet.growthToday.limit) throw invalid()
  }
  return {
    serverNow: integer(row.serverNow), today: date(row.today), catalogVersion: integer(row.catalogVersion, 1),
    wallet: { coins: integer(wallet.coins) },
    inventory: unique(list(row.inventory, 100).map(value => {
      const item = object(value)
      return { itemId: text(item.itemId, 64), quantity: integer(item.quantity) }
    }), item => item.itemId),
    dailySupply: { claimed: flag(daily.claimed), coins: integer(daily.coins), food: integer(daily.food) }, pet,
  }
}

async function read<T>(path: string, decode: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
  const result = await request<{ code: number; data: unknown }>(path, { signal, cache: 'no-store' })
  if (result?.code !== 0) throw invalid()
  return decode(result.data)
}
export const readPetCatalog = (signal?: AbortSignal) => read('/api/v3/pets/catalog', decodePetCatalog, signal)
export const readPetState = (signal?: AbortSignal) => read('/api/v3/me/pet', decodePetState, signal)

export async function executePetCommand(command: PetCommand): Promise<void> {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(command.key)) throw new ApiError('操作标识不合法', 422)
  const { kind, key, ...body } = command
  const response = await request<{ code: number; data: unknown }>(`/api/v3/me/pet/${kind}`, {
    method: kind === 'name' ? 'PUT' : 'POST',
    headers: { 'Idempotency-Key': key }, body: JSON.stringify(body),
  })
  if (response?.code !== 0) throw invalid()
  const receipt = object(response.data)
  const expectedOperation = command.kind === 'actions' ? command.action : command.kind === 'purchases' ? 'purchase' : command.kind
  if (text(receipt.operation, 80) !== expectedOperation) throw invalid()
  text(receipt.petId, 64)
  integer(receipt.committedAt)
  if ('petId' in command && receipt.petId !== command.petId) throw invalid()
}
