import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { EmojiCollectionOrder } from '@/api/v3-emojis'

const storageKey = 'fp.emoji.collectionOrder'
const fish001StorageKey = 'fp.emoji.fish001'

export const emojiOrderOptions = {
  newest: '最新收藏',
  oldest: '最早收藏',
  manual: '自定义顺序',
} as const

export const useEmojiPreferencesStore = defineStore('emojiPreferences', () => {
  const order = ref<EmojiCollectionOrder>('newest')
  const fish001Enabled = ref(false)

  function restore() {
    try {
      fish001Enabled.value = localStorage.getItem(fish001StorageKey) === 'true'
      const saved = localStorage.getItem(storageKey)
      if (saved === 'newest' || saved === 'oldest' || saved === 'manual') order.value = saved
    } catch {
      // 无法读取本机设置时使用默认排序。
    }
  }

  function setOrder(value: string) {
    if (value !== 'newest' && value !== 'oldest' && value !== 'manual') return
    order.value = value
    try {
      localStorage.setItem(storageKey, value)
    } catch {
      // 无法持久化时保留当前页面的选择。
    }
  }

  function setFish001Enabled(enabled: boolean) {
    fish001Enabled.value = enabled
    try {
      localStorage.setItem(fish001StorageKey, String(enabled))
    } catch {
      // 无法持久化时保留当前页面的选择。
    }
  }

  return { order, fish001Enabled, restore, setOrder, setFish001Enabled }
})
