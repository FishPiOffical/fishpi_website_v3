import type { InjectionKey } from 'vue'

export const CHAT_QUICK_QUOTE: InjectionKey<{
  enabled: (messageId: string) => boolean
  quote: (messageId: string) => void
}> = Symbol('chat-quick-quote')
