import { ApiError, request } from './http'
import { chatAppearanceSnapshot, isChatAppearance, type ChatAppearance } from '@/utils/chatAppearance'
export interface AppearanceCommand { bubbleId: string; frameId: string; key: string }
function decode(value: unknown): ChatAppearance {
  if (!isChatAppearance(value)) throw new ApiError('聊天外观响应不正确', 502)
  const snapshot = chatAppearanceSnapshot(value)
  if (snapshot.bubbleId !== value.bubbleId) throw new ApiError('聊天外观响应不正确', 502)
  return snapshot
}
export async function readChatAppearance(signal?: AbortSignal) {
  const response = await request<{code: number; data: unknown}>('/api/v3/me/chat-appearance', {signal, cache: 'no-store'})
  if (response.code !== 0) throw new ApiError('聊天外观读取失败', 502)
  return decode(response.data)
}
export async function setChatAppearance(command: AppearanceCommand) {
  if (!isChatAppearance({...command, version: 1}) || !/^[A-Za-z0-9._:-]{1,128}$/.test(command.key)) throw new ApiError('聊天外观参数不合法', 422)
  const response = await request<{code:number; data:unknown}>('/api/v3/me/chat-appearance', {method:'PUT', headers:{'Idempotency-Key':command.key}, body:JSON.stringify({bubbleId:command.bubbleId,frameId:command.frameId})})
  if (response.code !== 0) throw new ApiError('聊天外观保存响应不正确', 502)
  return decode(response.data)
}
