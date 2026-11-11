import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatSendShortcut } from '@/utils/chatSendShortcut'

const storageKey = 'fp.chat.sendShortcut'

export const useChatPreferencesStore = defineStore('chatPreferences', () => {
  const sendShortcut = ref<ChatSendShortcut>('mod-enter')

  function restore() {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved === 'ctrl-enter') sendShortcut.value = 'mod-enter'
      else if (saved === 'mod-enter' || saved === 'enter') sendShortcut.value = saved
    } catch {
      // 存储不可用时继续使用本次页面中的设置。
    }
  }

  function setSendShortcut(shortcut: ChatSendShortcut) {
    sendShortcut.value = shortcut
    try {
      localStorage.setItem(storageKey, shortcut)
    } catch {
      // 无法保存时仍允许立即切换快捷键。
    }
  }

  return { sendShortcut, restore, setSendShortcut }
})
