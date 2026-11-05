import { defineStore } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { getApiMode } from '@/api/mode'
import { fetchLegacyBag, executeLegacyInventory, legacyInventoryInput, type LegacyInventoryCommand } from '@/api/legacy/inventory'
import type { BagItem } from '@/api/v3-inventory'
import { useAuthStore } from './auth'
import { clearCache } from '@/utils/swr'
import { invalidateVipName } from '@/composables/useVipNickname'
export const useLegacyInventoryStore = defineStore('legacy-inventory', () => {
  const auth = useAuthStore(), items = ref<BagItem[] | null>(null), loading = ref(false), readError = ref(''), busy = ref(false), error = ref(''), followupError = ref('')
  const pending = ref<LegacyInventoryCommand | null>(null), completed = ref<LegacyInventoryCommand | null>(null), revision = ref(0)
  let generation = 0, readSequence = 0
  const identity = () => JSON.stringify([getAuthContextVersion(), auth.apiKey, auth.account?.oId])
  const active = () => !import.meta.env.SSR && getApiMode() === 'v1' && !!auth.apiKey && !!auth.account?.oId
  function clear() { generation++; readSequence++; items.value = null; loading.value = busy.value = false; readError.value = error.value = followupError.value = ''; pending.value = completed.value = null; revision.value++ }
  const stop = watch(identity, clear, { flush: 'sync' }); onScopeDispose(() => { stop(); clear() })
  function guard() { const reader = identity(), run = generation; return () => active() && reader === identity() && run === generation }
  async function load() {
    if (!active()) return
    const valid = guard(), run = ++readSequence
    items.value = null; loading.value = true; readError.value = ''
    try { const result = await fetchLegacyBag(); if (valid() && run === readSequence) items.value = result }
    catch (failure) { if (valid() && run === readSequence) readError.value = failure instanceof Error ? failure.message : '背包读取失败' }
    finally { if (valid() && run === readSequence) loading.value = false }
  }
  async function use(raw: LegacyInventoryCommand) {
    if (!active() || busy.value || pending.value) return null
    let input: LegacyInventoryCommand
    try { input = legacyInventoryInput(raw) } catch (failure) { error.value = failure instanceof Error ? failure.message : '道具参数不合法'; return null }
    const valid = guard(), oldName = auth.account?.userName, userId = auth.account?.oId
    pending.value = input; completed.value = null; busy.value = true; error.value = followupError.value = ''
    let confirmed = false
    try {
      const result = await executeLegacyInventory(input)
      if (!valid()) return null
      confirmed = true; pending.value = null; completed.value = input; revision.value++
      if (input.kind === 'nameCard') {
        try { clearCache(); invalidateVipName(userId, oldName) } catch { followupError.value = '改名已确认，显示缓存刷新失败，请重新读取当前资料。' }
      }
      await Promise.all([load(), auth.reloadAccount().catch(() => { if (valid()) followupError.value = '道具操作已确认，当前账号刷新失败，请重新读取资料；无需再次使用道具。' })])
      return valid() ? result : null
    } catch (failure) {
      if (valid()) {
        if (confirmed) followupError.value = '道具操作已确认，后续刷新失败；请重新读取背包和资料，无需再次使用。'
        else error.value = (failure instanceof Error ? failure.message : '道具结果未确认') + '。旧接口没有幂等恢复，请核对当前背包及账号后解除锁定，勿重复使用。'
      }
      return null
    } finally { if (valid()) busy.value = false }
  }
  function release() { if (!busy.value) { pending.value = null; error.value = '' } }
  function dismiss() { if (!busy.value && !pending.value) { completed.value = null; error.value = followupError.value = '' } }
  return { items, loading, readError, busy, error, followupError, pending, completed, revision, load, use, release, dismiss }
})
