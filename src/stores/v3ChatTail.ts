import { defineStore, storeToRefs } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { profileOperationKey } from '@/api/v3-profile'
import { readChatTail, saveChatTail, validateChatTail, type ChatTailCommand, type ChatTailSettings } from '@/api/v3-chat-tail'
import { useAuthStore } from '@/stores/auth'

export const useV3ChatTailStore = defineStore('v3-chat-tail', () => {
  const { accessToken, account } = storeToRefs(useAuthStore())
  const current = ref<ChatTailSettings | null>(null)
  const pending = ref<ChatTailCommand | null>(null)
  const loading = ref(false), busy = ref(false), error = ref(''), writeError = ref('')
  const confirmed = ref(0)
  let generation = 0, sequence = 0, abort: AbortController | null = null
  let owner = account.value?.oId, boundary = getAuthContextVersion()
  const active = () => !import.meta.env.SSR && !!accessToken.value && !!account.value?.oId
  const capture = () => {
    const epoch = generation, actor = account.value?.oId, context = getAuthContextVersion()
    return () => active() && epoch === generation && actor === account.value?.oId && context === getAuthContextVersion()
  }
  function cancelRead() { sequence++; abort?.abort(); abort = null; loading.value = false }
  function clear() {
    generation++; cancelRead(); current.value = pending.value = null
    busy.value = false; error.value = writeError.value = ''; confirmed.value = 0
  }
  async function load() {
    if (!active() || loading.value || busy.value) return
    const valid = capture(), run = ++sequence, controller = new AbortController()
    abort = controller; loading.value = true; error.value = ''
    try {
      const result = await readChatTail(controller.signal)
      if (valid() && run === sequence && !controller.signal.aborted) current.value = result
    } catch (e) {
      if (valid() && run === sequence && !controller.signal.aborted) {
        current.value = null; error.value = e instanceof Error ? e.message : '小尾巴设置读取失败'
      }
    } finally { if (valid() && run === sequence) { loading.value = false; abort = null } }
  }
  async function execute(command: ChatTailCommand, recovering: boolean) {
    if (!active() || busy.value) return
    const valid = capture()
    cancelRead(); pending.value = command; busy.value = true; writeError.value = ''
    try {
      await saveChatTail(command)
      if (valid()) {
        pending.value = null; current.value = null; confirmed.value++
        busy.value = false
        // 保存已确认后只重读设置，读取失败不能再次提交原写操作。
        await load()
      }
    } catch (e) {
      if (valid()) {
        writeError.value = e instanceof Error ? e.message : '小尾巴设置保存失败'
        if (!recovering && e instanceof ApiError && e.status >= 400 && e.status < 500 && e.code !== 'confirmation_required') pending.value = null
      }
    } finally { if (valid()) busy.value = false }
  }
  function save(value: ChatTailSettings) {
    if (!current.value || pending.value || busy.value || loading.value || !active()) return
    try { validateChatTail(value) } catch (e) { writeError.value = (e as Error).message; return }
    return execute({ enabled: value.enabled, text: value.text, key: profileOperationKey() }, false)
  }
  function retry() { if (pending.value && !busy.value) return execute(pending.value, true) }
  const stop = watch([accessToken, () => account.value?.oId], () => {
    const context = getAuthContextVersion(), actor = account.value?.oId
    if (!accessToken.value || context !== boundary || actor !== owner) clear()
    boundary = context; owner = actor
  }, { flush: 'sync' })
  onScopeDispose(() => { stop(); clear() })
  return { current, pending, loading, busy, error, writeError, confirmed, load, save, retry }
})
