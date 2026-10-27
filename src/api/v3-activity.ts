import { ApiError, request } from './http'
export interface CheckinState { checkedIn: boolean; liveness: number; threshold: number; streak: number }
export interface RewardState { date: string; amount: number; claimed: boolean; claimable: boolean }
export interface RewardReceipt { date: string; amount: number; claimed: true }
export interface RewardCommand { date: string; key: string }
const bad = () => new ApiError('活动响应格式不正确', 502)
function row(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw bad(); return value as Record<string, unknown> }
function count(value: unknown, integer = true) { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER || integer && !Number.isSafeInteger(value)) throw bad(); return value }
export function rewardDate(value: string) {
  if (typeof value !== 'string' || value.length !== 8 || /[^0-9]/.test(value)) throw new ApiError('奖励日期不合法', 422)
  const year = Number(value.slice(0,4)), month = Number(value.slice(4,6)), day = Number(value.slice(6)), date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new ApiError('奖励日期不合法', 422)
  return value
}
function date(value: unknown) { try { return rewardDate(value as string) } catch { throw bad() } }
async function data(path: string, init?: RequestInit) { const envelope = row(await request(path, { cache: 'no-store', ...init })); if (envelope.code !== 0) throw bad(); return row(envelope.data) }
export async function fetchCheckinState(): Promise<CheckinState> {
  const d = await data('/api/v3/me/checkin'); if (typeof d.checkedIn !== 'boolean') throw bad()
  return { checkedIn: d.checkedIn, liveness: count(d.liveness, false), threshold: count(d.threshold, false), streak: count(d.streak) }
}
export async function fetchRewardState(): Promise<RewardState> {
  const d = await data('/api/v3/me/activity/yesterday-reward'), amount = count(d.amount)
  if (typeof d.claimed !== 'boolean' || typeof d.claimable !== 'boolean' || d.claimable !== (!d.claimed && amount > 0)) throw bad()
  return { date: date(d.date), amount, claimed: d.claimed, claimable: d.claimable }
}
export async function claimYesterdayReward(command: RewardCommand): Promise<RewardReceipt> {
  const expectedDate = rewardDate(command.date)
  if (!command.key || command.key.length > 128 || /[^A-Za-z0-9._:-]/.test(command.key)) throw new ApiError('操作标识不合法', 422)
  const d = await data('/api/v3/me/activity/yesterday-reward', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': command.key }, body: JSON.stringify({ expectedDate }) })
  const amount = count(d.amount)
  if (d.claimed !== true || date(d.date) !== expectedDate || amount <= 0) throw bad()
  return { date: expectedDate, amount, claimed: true }
}
