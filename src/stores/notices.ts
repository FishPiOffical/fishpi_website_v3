import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchUnreadCount, type UnreadCount } from '@/api/fishpi'
import { useAuthStore } from './auth'

export const useNoticeStore = defineStore('notices', () => {
  const unread = ref<UnreadCount>({})
  const loading = ref(false)

  const total = computed(() => Number(unread.value.unreadNotificationCnt || 0))

  async function refresh() {
    const auth = useAuthStore()
    if (!auth.apiKey) {
      unread.value = {}
      return
    }
    loading.value = true
    try {
      unread.value = await fetchUnreadCount(auth.apiKey)
    } catch {
      unread.value = {}
    } finally {
      loading.value = false
    }
  }

  function clear() {
    unread.value = {}
  }

  return { unread, loading, total, refresh, clear }
})
