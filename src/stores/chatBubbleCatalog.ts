import { defineStore } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { readChatBubbles, type ChatBubbleOption } from '@/api/v3-chat-bubbles'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

export const useChatBubbleCatalog = defineStore('chat-bubble-catalog', () => {
  const auth = useAuthStore()
  const items = ref<ChatBubbleOption[]>([])
  const error = ref('')
  let pending: AbortController | undefined
  let loadedAt = 0
  let wanted = false
  const identity = () => `${getAuthContextVersion()}:${auth.account?.oId ?? ''}:${!!auth.accessToken}`

  async function load(force = false) {
    wanted = true
    if (import.meta.env.SSR || !auth.accessToken || !auth.account?.oId || pending || !force && Date.now() - loadedAt < 60_000) return
    const context = identity()
    const controller = new AbortController()
    pending = controller
    error.value = ''
    try {
      const result = await readChatBubbles(controller.signal)
      if (controller.signal.aborted || context !== identity()) return
      items.value = result
      loadedAt = Date.now()
    } catch (cause) {
      if (!controller.signal.aborted && context === identity()) {
        if (cause instanceof ApiError && cause.status === 404) {
          items.value = []
          loadedAt = Date.now()
        } else {
          error.value = cause instanceof Error ? cause.message : '气泡目录暂不可用'
        }
      }
    } finally {
      if (pending === controller) pending = undefined
    }
  }
  function clear() {
    pending?.abort()
    pending = undefined
    loadedAt = 0
    items.value = []
    error.value = ''
  }
  watch(identity, () => { clear(); if (wanted) void load() }, { flush: 'sync' })
  onScopeDispose(clear)
  return { items, error, load }
})
