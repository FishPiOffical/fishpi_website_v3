import { defineStore } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { getApiMode } from '@/api/mode'
import { fetchLegacyMemberState, fetchLegacyMemberLevels, writeLegacyMember, legacyMemberInput, type LegacyMemberCommand, type LegacyMemberState, type LegacyMemberLevel } from '@/api/legacy/membership'
import { useAuthStore } from './auth'
import { invalidateVipName } from '@/composables/useVipNickname'
export const useLegacyMembershipStore = defineStore('legacy-membership', () => {
  const auth = useAuthStore(), state = ref<LegacyMemberState | null>(null), levels = ref<LegacyMemberLevel[] | null>(null), stateLoading = ref(false), levelsLoading = ref(false), stateError = ref(''), levelsError = ref(''), pending = ref<LegacyMemberCommand | null>(null), completed = ref<LegacyMemberCommand['kind'] | null>(null), busy = ref(false), error = ref(''), followupError = ref('')
  let generation = 0, stateSequence = 0, levelsSequence = 0
  const identity = () => JSON.stringify([getAuthContextVersion(), auth.apiKey, auth.account?.oId]), active = () => !import.meta.env.SSR && getApiMode() === 'v1' && !!auth.apiKey && !!auth.account?.oId
  function clear() { generation++; stateSequence++; levelsSequence++; state.value = levels.value = null; stateLoading.value = levelsLoading.value = busy.value = false; stateError.value = levelsError.value = error.value = followupError.value = ''; pending.value = completed.value = null }
  const stop = watch(identity, clear, { flush: 'sync' }); onScopeDispose(() => { stop(); clear() })
  function guard() { const owner = identity(), run = generation; return () => active() && identity() === owner && run === generation }
  async function loadState() { if (!active()) return; const valid = guard(), run = ++stateSequence, owner = auth.account!.oId; state.value = null; stateLoading.value = true; stateError.value = ''; try { const result = await fetchLegacyMemberState(owner); if (valid() && run === stateSequence) state.value = result } catch (e) { if (valid() && run === stateSequence) stateError.value = e instanceof Error ? e.message : '会员状态读取失败' } finally { if (valid() && run === stateSequence) stateLoading.value = false } }
  async function loadLevels() { if (!active()) return; const valid = guard(), run = ++levelsSequence; levels.value = null; levelsLoading.value = true; levelsError.value = ''; try { const result = await fetchLegacyMemberLevels(); if (valid() && run === levelsSequence) levels.value = result } catch (e) { if (valid() && run === levelsSequence) levelsError.value = e instanceof Error ? e.message : '会员目录读取失败' } finally { if (valid() && run === levelsSequence) levelsLoading.value = false } }
  async function execute(raw: LegacyMemberCommand) {
    if (!active() || busy.value || pending.value) return false
    let input: LegacyMemberCommand
    try { input = legacyMemberInput(raw) } catch (e) { error.value = e instanceof Error ? e.message : '会员参数不合法'; return false }
    const valid = guard(); pending.value = input; busy.value = true; completed.value = null; error.value = followupError.value = ''
    try {
      await writeLegacyMember(input)
      if (!valid()) return false
      pending.value = null; completed.value = input.kind
      try { invalidateVipName(auth.account?.oId, auth.account?.userName) } catch { followupError.value = '操作已确认，昵称缓存刷新失败，请重新读取。' }
      await Promise.all([loadState(), auth.reloadAccount().catch(() => { if (valid()) followupError.value = '操作已确认，本人余额刷新失败，请核对积分流水，无需再次开通。' })])
      return valid()
    } catch (e) { if (valid()) error.value = (e instanceof Error ? e.message : '结果未确认') + '。旧接口无幂等恢复，请核对会员状态、背包和积分流水，勿重复开通。'; return false }
    finally { if (valid()) busy.value = false }
  }
  function release() { if (!busy.value) { pending.value = null; error.value = '' } }
  function dismiss() { if (!busy.value && !pending.value) { completed.value = null; error.value = followupError.value = '' } }
  return { state, levels, stateLoading, levelsLoading, stateError, levelsError, pending, completed, busy, error, followupError, loadState, loadLevels, execute, release, dismiss }
})
