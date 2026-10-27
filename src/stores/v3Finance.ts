import { defineStore, storeToRefs } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { fpConfirm } from '@/composables/useDialog'
import { profileOperationKey } from '@/api/v3-profile'
import { pointTransferInput, transferV3Points, purchaseV3Invitation, type PointTransfer, type TransferReceipt, type InvitationReceipt } from '@/api/v3-finance'

/** Private in-memory commands survive page changes, but never an identity boundary. */
export const useV3FinanceStore = defineStore('v3-finance', () => {
  const auth = useAuthStore(), { accessToken, account } = storeToRefs(auth)
  const revision = ref(0), transferPending = ref<{ input: PointTransfer; key: string } | null>(null), invitationPending = ref<{ key: string } | null>(null)
  const transferReceipt = ref<TransferReceipt | null>(null), invitations = ref<InvitationReceipt[]>([])
  const transferBusy = ref(false), transferConfirming = ref(false), invitationBusy = ref(false), invitationConfirming = ref(false)
  const transferError = ref(''), invitationError = ref(''), refreshError = ref('')
  let boundary = getAuthContextVersion(), owner = account.value?.oId
  function reset() { revision.value++; transferPending.value = invitationPending.value = null; transferReceipt.value = null; invitations.value = []; transferBusy.value = transferConfirming.value = invitationBusy.value = invitationConfirming.value = false; transferError.value = invitationError.value = refreshError.value = '' }
  const stop = watch([accessToken, () => account.value?.oId], () => {
    const next = getAuthContextVersion(), id = account.value?.oId
    if (!accessToken.value || next !== boundary || id !== owner) reset()
    boundary = next; owner = id
  }, { flush: 'sync' })
  onScopeDispose(() => { stop(); reset() })
  function capture() {
    const current = revision.value, context = getAuthContextVersion(), id = account.value?.oId
    return () => !import.meta.env.SSR && !!accessToken.value && !!id && id === account.value?.oId && context === getAuthContextVersion() && current === revision.value
  }
  function rejected(error: unknown) { return error instanceof ApiError && error.status >= 400 && error.status < 500 }
  async function refresh(valid: () => boolean) {
    try { await auth.reloadAccount(); if (valid()) refreshError.value = '' }
    catch { if (valid()) refreshError.value = '操作已确认，账户余额刷新失败，请稍后重新读取余额或积分流水' }
  }
  async function executeTransfer(intent: { input: PointTransfer; key: string }) {
    const valid = capture()
    if (!valid() || transferBusy.value) return
    const recovering = transferPending.value !== null
    transferPending.value = intent; transferBusy.value = true; transferError.value = ''
    try {
      const result = await transferV3Points(intent.input, intent.key)
      if (valid()) { transferPending.value = null; transferReceipt.value = result; await refresh(valid) }
    } catch (error) { if (valid()) { transferError.value = error instanceof Error ? error.message : '转账失败'; if (!recovering && rejected(error)) transferPending.value = null } }
    finally { if (valid()) transferBusy.value = false }
  }
  async function transfer(input: PointTransfer) {
    if (transferBusy.value || transferConfirming.value || transferPending.value) return
    const valid = capture()
    if (!valid()) return
    transferError.value = ''
    let body: PointTransfer
    try { body = pointTransferInput(input) } catch (error) { transferError.value = error instanceof Error ? error.message : '转账参数不合法'; return }
    transferConfirming.value = true
    try {
      const accepted = await fpConfirm({ title: '确认积分转账', message: `向用户名 ${body.userName} 转账，总扣款 ${body.amount} 积分（含手续费）。备注：${body.memo || '（空）'}。实际到账、手续费和处理后的备注以服务端回执为准。是否继续？`, confirmText: '确认转账' })
      if (accepted && valid()) { transferReceipt.value = null; await executeTransfer({ input: body, key: profileOperationKey() }) }
    } finally { if (valid()) transferConfirming.value = false }
  }
  async function executeInvitation(intent: { key: string }) {
    const valid = capture()
    if (!valid() || invitationBusy.value) return
    const recovering = invitationPending.value !== null
    invitationPending.value = intent; invitationBusy.value = true; invitationError.value = ''
    try {
      const result = await purchaseV3Invitation(intent.key)
      if (valid()) { invitationPending.value = null; if (!invitations.value.some(row => row.code === result.code)) invitations.value.unshift(result); await refresh(valid) }
    } catch (error) { if (valid()) { invitationError.value = error instanceof Error ? error.message : '购买失败'; if (!recovering && rejected(error)) invitationPending.value = null } }
    finally { if (valid()) invitationBusy.value = false }
  }
  async function purchaseInvitation() {
    if (invitationBusy.value || invitationConfirming.value || invitationPending.value) return
    const valid = capture()
    if (!valid()) return
    invitationError.value = ''; invitationConfirming.value = true
    try { const accepted = await fpConfirm({ title: '确认购买邀请码', message: '花费100积分购买一枚邀请码，仅当前邀请注册模式可用。余额不足或当前模式不支持时不会购买。是否继续？', confirmText: '确认购买' }); if (accepted && valid()) await executeInvitation({ key: profileOperationKey() }) }
    finally { if (valid()) invitationConfirming.value = false }
  }
  function retryTransfer() { if (transferPending.value) void executeTransfer(transferPending.value) }
  function retryInvitation() { if (invitationPending.value) void executeInvitation(invitationPending.value) }
  return { revision, transferPending, invitationPending, transferReceipt, invitations, transferBusy, transferConfirming, invitationBusy, invitationConfirming, transferError, invitationError, refreshError, capture, transfer, purchaseInvitation, retryTransfer, retryInvitation }
})
