import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { getApiMode } from '@/api/mode'
import { fetchLegacyOwnerMedals, writeLegacyOwnerMedal, legacyMedalInput, type LegacyOwnerMedal, type LegacyMedalCommand } from '@/api/legacy/owner-medals'
import { useAuthStore } from './auth'
export const useLegacyMedalsStore = defineStore('legacy-owner-medals', () => {
  const auth = useAuthStore(), items = ref<LegacyOwnerMedal[] | null>(null), loading = ref(false), readError = ref(''), busy = ref(false), pending = ref<LegacyMedalCommand | null>(null), completed = ref<LegacyMedalCommand | null>(null), error = ref('')
  let generation = 0, readSequence = 0
  const identity = () => JSON.stringify([getAuthContextVersion(), auth.apiKey, auth.account?.oId])
  const active = () => !import.meta.env.SSR && getApiMode() === 'v1' && !!auth.apiKey && !!auth.account?.oId
  const ambiguous = computed(() => {
    const definitions = new Map<string, number>(), records = new Map<string, number>(), ids = new Set<string>()
    for (const row of items.value || []) { definitions.set(row.definitionId, (definitions.get(row.definitionId) || 0) + 1); records.set(row.recordId, (records.get(row.recordId) || 0) + 1) }
    for (const row of items.value || []) if (definitions.get(row.definitionId)! > 1 || records.get(row.recordId)! > 1) ids.add(row.recordId)
    return ids
  })
  function clear() { generation++; readSequence++; items.value = null; loading.value = busy.value = false; readError.value = error.value = ''; pending.value = completed.value = null }
  const stop = watch(identity, clear, { flush: 'sync' }); onScopeDispose(() => { stop(); clear() })
  function guard() { const owner = identity(), run = generation; return () => active() && identity() === owner && generation === run }
  async function load() {
    if (!active()) return
    const valid = guard(), run = ++readSequence, owner = auth.account!.oId
    loading.value = true; readError.value = ''
    try { const result = await fetchLegacyOwnerMedals(owner); if (valid() && run === readSequence) items.value = result }
    catch (failure) { if (valid() && run === readSequence) { items.value = null; readError.value = failure instanceof Error ? failure.message : '勋章读取失败' } }
    finally { if (valid() && run === readSequence) loading.value = false }
  }
  async function execute(raw: LegacyMedalCommand) {
    if (!active() || loading.value || busy.value || pending.value || !items.value) return false
    let input: LegacyMedalCommand
    try { input = legacyMedalInput(raw) } catch (failure) { error.value = failure instanceof Error ? failure.message : '勋章参数不合法'; return false }
    if (ambiguous.value.has(input.recordId) || !items.value.some(row => row.recordId === input.recordId && row.definitionId === input.definitionId)) { error.value = '当前勋章记录不能被旧接口唯一定位，请重新读取或在经典页面核对。'; return false }
    const valid = guard()
    pending.value = input; completed.value = null; busy.value = true; error.value = ''
    try {
      await writeLegacyOwnerMedal(input)
      if (!valid()) return false
      pending.value = null; completed.value = input
      await load()
      return valid()
    } catch (failure) { if (valid()) error.value = (failure instanceof Error ? failure.message : '勋章结果未确认') + '。旧接口没有幂等恢复，请先核对当前展示状态与顺序，勿重复移动。'; return false }
    finally { if (valid()) busy.value = false }
  }
  function release() { if (!busy.value) { pending.value = null; error.value = '' } }
  function dismiss() { if (!busy.value && !pending.value) { completed.value = null; error.value = '' } }
  return { items, ambiguous, loading, readError, busy, pending, completed, error, load, execute, release, dismiss }
})
