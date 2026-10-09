import { ref } from 'vue'
import { ensureCsrfToken } from '@/api/pageAuth'

/** `/gen` 勋章图依赖页面会话 cookie；会话就绪后递增，让之前取到空图的勋章重新加载 */
export const medalSessionEpoch = ref(0)

export async function ensureMedalSession(apiKey: string | null | undefined) {
  if (!apiKey || import.meta.env.SSR) return
  try {
    await ensureCsrfToken(apiKey)
    medalSessionEpoch.value++
  } catch {
    /* 未就绪时勋章走兜底样式 */
  }
}
