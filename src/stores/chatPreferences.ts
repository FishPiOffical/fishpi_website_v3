import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatSendShortcut } from '@/utils/chatSendShortcut'

const storageKey = 'fp.chat.sendShortcut'

export const useChatPreferencesStore = defineStore('chatPreferences', () => {
  const mountEffects = ref(true)
  const sendShortcut = ref<ChatSendShortcut>('mod-enter')

  function restore() {
    try {
      mountEffects.value = localStorage.getItem('fp.chat.mountEffects') !== 'false'
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

  function setMountEffects(enabled: boolean) {
    mountEffects.value = enabled
    try { localStorage.setItem('fp.chat.mountEffects', String(enabled)) } catch { /* 本机存储不可用时保留当前选择。 */ }
  }
  return { sendShortcut, mountEffects, restore, setSendShortcut, setMountEffects }
})
