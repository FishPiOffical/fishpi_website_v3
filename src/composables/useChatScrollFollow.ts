import { ref, watch, type Ref } from 'vue'
import { createChatScrollFollow } from '@/utils/chatScrollFollow'

export function useChatScrollFollow(scroller: Ref<HTMLElement | null>, selector: string, userScrolled?: () => void) {
  const following = ref(true)
  let controller: ReturnType<typeof createChatScrollFollow> | undefined
  watch(scroller, (el, _, onCleanup) => {
    following.value = true
    if (!el) return
    controller = createChatScrollFollow(el, selector, value => { following.value = value }, userScrolled)
    onCleanup(() => { controller?.dispose(); controller = undefined })
  }, { flush: 'post' })
  return {
    following,
    jump: () => controller?.jump(),
    pause: () => controller?.pause(),
    refresh: () => controller?.refresh(),
  }
}
