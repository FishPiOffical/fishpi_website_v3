import { defineStore } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { getApiMode } from '@/api/mode'
import { pointTransferInput, type PointTransfer } from '@/api/v3-finance'
import { readLegacyTransferBalance, transferLegacyPoints } from '@/api/legacy/point-transfer'
import { useAuthStore } from './auth'
export const useLegacyPointTransferStore = defineStore('legacy-point-transfer', () => {
  const auth = useAuthStore(), balance = ref<number | null>(null), balanceLoading = ref(false), balanceError = ref(''), pending = ref<PointTransfer | null>(null), completed = ref<PointTransfer | null>(null), busy = ref(false), error = ref('')
  let generation = 0, readSequence = 0
  const identity = () => JSON.stringify([getAuthContextVersion(), auth.apiKey, auth.account?.oId])
  const active = () => !import.meta.env.SSR && getApiMode() === 'v1' && !!auth.apiKey && !!auth.account?.oId
  function clear() { generation++; readSequence++; balance.value = null; balanceLoading.value = busy.value = false; balanceError.value = error.value = ''; pending.value = completed.value = null }
  const stop = watch(identity, clear, { flush: 'sync' }); onScopeDispose(() => { stop(); clear() })
  function guard() { const reader = identity(), run = generation; return () => active() && reader === identity() && run === generation }
  async function readBalance() {
    if (!active()) return null
    const valid = guard(), run = ++readSequence, owner = auth.account!.oId
    balance.value = null; balanceLoading.value = true; balanceError.value = ''
    try { const result = await readLegacyTransferBalance(owner); if (valid() && run === readSequence) { balance.value = result; if (auth.account) auth.account.userPoint = result; return result } }
    catch (failure) { if (valid() && run === readSequence) balanceError.value = failure instanceof Error ? failure.message : '余额读取失败' }
    finally { if (valid() && run === readSequence) balanceLoading.value = false }
    return null
  }
  async function transfer(raw: PointTransfer) {
    if (!active() || busy.value || pending.value) return false
    let input: PointTransfer
    try { input = pointTransferInput(raw) } catch (failure) { error.value = failure instanceof Error ? failure.message : '参数不合法'; return false }
    const valid = guard()
    pending.value = input; completed.value = null; busy.value = true; error.value = ''
    try {
      await transferLegacyPoints(input)
      if (!valid()) return false
      pending.value = null; completed.value = input
      await readBalance()
      return valid()
    } catch (failure) { if (valid()) error.value = (failure instanceof Error ? failure.message : '转账结果未确认') + '。旧接口没有幂等恢复，请先核对余额和积分流水，勿重复转账。'; return false }
    finally { if (valid()) busy.value = false }
  }
  function release() { if (!busy.value) { pending.value = null; error.value = '' } }
  function dismiss() { if (!busy.value && !pending.value) { completed.value = null; error.value = '' } }
  return { balance, balanceLoading, balanceError, pending, completed, busy, error, readBalance, transfer, release, dismiss }
})
