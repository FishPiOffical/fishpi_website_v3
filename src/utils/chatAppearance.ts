import { decodeBubbleStyle, isCustomBubbleId, type BubbleStyle } from '@/utils/bubbleStyle'
export { bubbleAttributes, isCustomBubbleId } from '@/utils/bubbleStyle'

export interface ChatAppearance { bubbleId: string; frameId: string; version: number; bubbleRevision?: number; bubbleStyle?: BubbleStyle }
export const CHAT_BUBBLES = ['classic', 'candy', 'paipai-orange', 'fishpond-blue', 'sea-soda', 'sunset-letter', 'star-route'] as const
export const CHAT_FRAMES = ['none', 'gold', 'paipai-orange', 'fishpond-blue', 'tide', 'paipai-stamp', 'star-ring'] as const
export function defaultChatAppearance(): ChatAppearance { return { bubbleId: 'classic', frameId: 'none', version: 1 } }
export function isChatAppearance(value: unknown): value is ChatAppearance {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return row.version === 1 && (CHAT_BUBBLES.includes(row.bubbleId as typeof CHAT_BUBBLES[number]) || isCustomBubbleId(row.bubbleId))
    && CHAT_FRAMES.includes(row.frameId as typeof CHAT_FRAMES[number])
}
/** Old messages and unsupported versions get a deterministic default, never the viewer's current preference. */
export function chatAppearanceSnapshot(value: unknown): ChatAppearance {
  if (!isChatAppearance(value)) return defaultChatAppearance()
  if (!isCustomBubbleId(value.bubbleId)) return { bubbleId: value.bubbleId, frameId: value.frameId, version: 1 }
  const style = decodeBubbleStyle(value.bubbleStyle)
  const revision = value.bubbleRevision
  if (!style || typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1)
    return { ...defaultChatAppearance(), frameId: value.frameId }
  return { bubbleId: value.bubbleId, frameId: value.frameId, version: 1, bubbleStyle: style, bubbleRevision: revision }
}
