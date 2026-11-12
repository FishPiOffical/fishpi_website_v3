import type { InjectionKey } from 'vue'

// 按所在聊天室注入输入目标，避免悬浮窗和主页面互相写入草稿。
export const CHAT_MENTION: InjectionKey<{
  enabled: () => boolean
  insert: (userName: string) => void
}> = Symbol('chat-mention')

export function chatMentionText(userName: string) {
  return userName && !/[\s@\[\]<>\\]/u.test(userName) ? ` @${userName} ` : ''
}
