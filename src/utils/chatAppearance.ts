export interface ChatAppearance { bubbleId: string; frameId: string; version: number }
export const CHAT_BUBBLES = ['classic', 'candy', 'paipai-orange', 'fishpond-blue'] as const
export const CHAT_FRAMES = ['none', 'gold', 'paipai-orange', 'fishpond-blue'] as const
export function defaultChatAppearance(): ChatAppearance { return { bubbleId: 'classic', frameId: 'none', version: 1 } }
export function isChatAppearance(value: unknown): value is ChatAppearance {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return row.version === 1 && CHAT_BUBBLES.includes(row.bubbleId as typeof CHAT_BUBBLES[number]) && CHAT_FRAMES.includes(row.frameId as typeof CHAT_FRAMES[number])
}
/** Old messages and unsupported versions get a deterministic default, never the viewer's current preference. */
export function chatAppearanceSnapshot(value: unknown): ChatAppearance {
  return isChatAppearance(value) ? { bubbleId: value.bubbleId, frameId: value.frameId, version: 1 } : defaultChatAppearance()
}
