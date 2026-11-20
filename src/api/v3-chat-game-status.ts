import { ApiError, request } from './http'

export const CHAT_GAME_BATCH_SIZE = 50
export const chatGameUserId = /^[1-9][0-9]{0,18}$/

export interface ChatGameStatus {
  parkingFree?: boolean
  partner?: { full: boolean; displayValue?: string }
}

function invalid(): never {
  throw new ApiError('游园状态数据格式异常', 502, 'invalid_response')
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : invalid()
}

export async function readChatGameStatuses(userIds: string[]) {
  const requested = new Set(userIds)
  if (!requested.size || requested.size > CHAT_GAME_BATCH_SIZE || [...requested].some(id => !chatGameUserId.test(id))) invalid()
  const query = new URLSearchParams({ userIds: [...requested].join(',') })
  const response = await request<{ code: number; data: unknown }>('/api/v3/chat/game-status?' + query, {
    cache: 'no-store', signal: AbortSignal.timeout(15_000),
  })
  const list = response?.code === 0 ? record(response.data).list : invalid()
  if (!Array.isArray(list) || list.length > requested.size) invalid()
  const statuses = new Map<string, ChatGameStatus>()
  for (const value of list) {
    const row = record(value)
    if (typeof row.userId !== 'string' || !requested.has(row.userId) || statuses.has(row.userId)) invalid()
    const status: ChatGameStatus = {}
    if (row.parkingFree !== undefined) {
      if (typeof row.parkingFree !== 'boolean') invalid()
      status.parkingFree = row.parkingFree
    }
    if (row.partner !== undefined) {
      const card = record(row.partner)
      if (typeof card.full !== 'boolean') invalid()
      status.partner = { full: card.full }
      if (card.displayValue !== undefined) {
        if (typeof card.displayValue !== 'string' || !/^[1-9][0-9]{0,41}$/.test(card.displayValue)) invalid()
        status.partner.displayValue = card.displayValue
      }
    }
    statuses.set(row.userId, status)
  }
  return statuses
}
