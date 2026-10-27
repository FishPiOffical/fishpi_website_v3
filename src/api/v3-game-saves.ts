import { ApiError, request } from './http'
export const GAME_ID = 'evolve-save'
export interface GameSaveOption { gameId: string; name: string; dataFormat: 'string'; maxLength: number; maxBytes: number; legacyMigration: boolean }
export interface GameSaveMetadata { gameId: string; revision: number; updatedAt: number; byteLength: number; sha256: string }
export interface GameSave extends GameSaveMetadata { data: string }
export type GameSaveCommand = { kind: 'save'; data: string; expectedRevision: number; key: string } | { kind: 'migrate'; key: string }
const bad = () => new ApiError('存档响应格式不正确', 502)
function row(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw bad(); return value as Record<string, unknown> }
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw bad(); return value }
export function gameSaveData(value: string) {
  if (typeof value !== 'string' || value.length > 500000) throw new ApiError('存档最多500000个UTF-16字符', 422)
  for (let i = 0; i < value.length; i++) { const unit = value.charCodeAt(i); if (unit >= 0xd800 && unit <= 0xdbff) { const next = value.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) throw new ApiError('存档含无效Unicode', 422) } else if (unit >= 0xdc00 && unit <= 0xdfff) throw new ApiError('存档含无效Unicode', 422) }
  if (new TextEncoder().encode(value).length > 2097152) throw new ApiError('存档UTF-8最多2MiB', 422)
  return value
}
export function gameSaveRevision(value: number) { if (!Number.isSafeInteger(value) || value < 0) throw new ApiError('存档版本不合法', 422); return value }
async function hash(value: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('') }
function metadata(value: unknown): GameSaveMetadata {
  const d = row(value)
  if (d.gameId !== GAME_ID || typeof d.sha256 !== 'string' || d.sha256.length !== 64 || /[^a-f0-9]/.test(d.sha256)) throw bad()
  return { gameId: GAME_ID, revision: integer(d.revision, 1), updatedAt: integer(d.updatedAt, 1, 8640000000000000), byteLength: integer(d.byteLength, 0, 2097152), sha256: d.sha256 }
}
async function data(path: string, init?: RequestInit) { const envelope = row(await request(path, { cache: 'no-store', ...init })); if (envelope.code !== 0) throw bad(); return envelope.data }
export async function fetchGameSaveOptions(): Promise<GameSaveOption[]> {
  const d = row(await data('/api/v3/game-save-options'))
  if (!Array.isArray(d.list) || d.list.length !== 1) throw bad()
  const option = row(d.list[0])
  if (option.gameId !== GAME_ID || option.name !== 'Evolve' || option.dataFormat !== 'string' || option.maxLength !== 500000 || option.maxBytes !== 2097152 || option.legacyMigration !== true) throw bad()
  return [{ gameId: GAME_ID, name: 'Evolve', dataFormat: 'string', maxLength: 500000, maxBytes: 2097152, legacyMigration: true }]
}
export async function fetchGameSave(): Promise<GameSave> {
  const d = row(await data(`/api/v3/me/game-saves/${GAME_ID}`)), result = metadata(d)
  let raw: string; try { raw = gameSaveData(d.data as string) } catch { throw bad() }
  if (new TextEncoder().encode(raw).length !== result.byteLength || await hash(raw) !== result.sha256) throw bad()
  return { ...result, data: raw }
}
export async function executeGameSave(command: GameSaveCommand): Promise<GameSaveMetadata> {
  if (!command.key || command.key.length > 128 || /[^A-Za-z0-9._:-]/.test(command.key)) throw new ApiError('操作标识不合法', 422)
  const root = `/api/v3/me/game-saves/${GAME_ID}`, headers = { 'Content-Type': 'application/json', 'Idempotency-Key': command.key }
  if (command.kind === 'save') {
    const raw = gameSaveData(command.data), expectedRevision = gameSaveRevision(command.expectedRevision), sha256 = await hash(raw)
    const result = metadata(await data(root, { method: 'PUT', headers, body: JSON.stringify({ data: raw, expectedRevision }) }))
    if (result.revision !== expectedRevision + 1 || result.byteLength !== new TextEncoder().encode(raw).length || result.sha256 !== sha256) throw bad()
    return result
  }
  if (command.kind !== 'migrate') throw new ApiError('存档操作不合法', 422)
  const d = row(await data(root + '/migrations', { method: 'POST', headers, body: '{}' })), result = metadata(d)
  if (result.revision !== 1 || d.migrated !== true) throw bad()
  return result
}
