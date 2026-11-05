import { defineStore } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { getApiMode } from '@/api/mode'
import { emojiCommand, writeLegacyEmoji, type EmojiCommand } from '@/api/legacy/emoji-management'
import { useAuthStore } from './auth'
export const useLegacyEmojisStore = defineStore('legacy-emojis', () => {
  const auth = useAuthStore(), pending = ref<EmojiCommand | null>(null), busy = ref(false), error = ref(''), revision = ref(0)
  let generation = 0
  const identity = () => JSON.stringify([getAuthContextVersion(), auth.apiKey, auth.account?.oId])
  function clear() { generation++; pending.value = null; busy.value = false; error.value = ''; revision.value++ }
  const stop = watch(identity, clear, { flush: 'sync' }); onScopeDispose(() => { stop(); clear() })
  async function submit(input: EmojiCommand) {
    if (import.meta.env.SSR || getApiMode() !== 'v1' || !auth.apiKey || !auth.account?.oId || busy.value || pending.value) return false
    let frozen: EmojiCommand
    try { frozen = emojiCommand(input) } catch (failure) { error.value = failure instanceof Error ? failure.message : '参数不合法'; return false }
    const owner = identity(), run = generation, valid = () => owner === identity() && run === generation
    pending.value = frozen; busy.value = true; error.value = ''
    try { await writeLegacyEmoji(frozen); if (!valid()) return false; pending.value = null; revision.value++; return true }
    catch (failure) { if (valid()) error.value = (failure instanceof Error ? failure.message : '操作未确认') + '。请先刷新核对；旧接口没有幂等恢复，不能直接重发。'; return false }
    finally { if (valid()) busy.value = false }
  }
  function release() { if (!busy.value) { pending.value = null; error.value = '' } }
  return { pending, busy, error, revision, submit, release }
})
