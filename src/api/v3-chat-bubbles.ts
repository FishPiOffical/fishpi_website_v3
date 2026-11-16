import { ApiError, request } from './http'
import { decodeBubbleStyle, isCustomBubbleId, type BubbleStyle } from '@/utils/bubbleStyle'

export interface ChatBubbleOption { id: string; name: string; access: 'free' | 'vip'; style: BubbleStyle }

export async function readChatBubbles(signal: AbortSignal): Promise<ChatBubbleOption[]> {
  const response = await request<{ code: number; data?: { list?: unknown } }>('/api/v3/chat/bubbles', { signal })
  if (response.code !== 0 || !Array.isArray(response.data?.list)) throw new ApiError('气泡目录暂不可用', 502)
  return response.data.list.flatMap((item): ChatBubbleOption[] => {
    if (!item || typeof item !== 'object') return []
    const { id, name, access, style } = item as Record<string, unknown>
    const decoded = decodeBubbleStyle(style)
    return isCustomBubbleId(id) && typeof name === 'string' && name.length <= 48 && (access === 'free' || access === 'vip') && decoded
      ? [{ id, name, access, style: decoded }] : []
  })
}
