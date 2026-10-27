import { defineStore, storeToRefs } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { fetchV3Bag, executeV3Inventory, inventoryInput, type BagItem, type InventoryCommand, type InventoryReceipt } from '@/api/v3-inventory'
import { profileOperationKey } from '@/api/v3-profile'
import { useAuthStore } from '@/stores/auth'
import { fpConfirm } from '@/composables/useDialog'
import { clearCache } from '@/utils/swr'
import { invalidateVipName } from '@/composables/useVipNickname'
export const useV3InventoryStore = defineStore('v3-inventory', () => {
  const auth = useAuthStore(), { accessToken, account } = storeToRefs(auth)
  const revision = ref(0), items = ref<BagItem[] | null>(null), loading = ref(false), readError = ref(''), error = ref(''), followupError = ref('')
  const busy = ref(false), confirming = ref(false), pending = ref<{ input: InventoryCommand; key: string } | null>(null), receipt = ref<InventoryReceipt | null>(null)
  let sequence = 0, boundary = getAuthContextVersion(), owner = account.value?.oId
  function clear() { revision.value++; sequence++; items.value = null; loading.value = busy.value = confirming.value = false; readError.value = error.value = followupError.value = ''; pending.value = null; receipt.value = null }
  const stop = watch([accessToken, () => account.value?.oId], () => { const context = getAuthContextVersion(), id = account.value?.oId; if (!accessToken.value || context !== boundary || id !== owner) clear(); boundary = context; owner = id }, { flush: 'sync' })
  onScopeDispose(() => { stop(); clear() })
  function capture() { const r = revision.value, context = getAuthContextVersion(), id = account.value?.oId; return () => !import.meta.env.SSR && !!accessToken.value && !!id && id === account.value?.oId && context === getAuthContextVersion() && revision.value === r }
  async function load() {
    const valid = capture(), current = ++sequence
    if (!valid()) return
    loading.value = true; readError.value = ''; items.value = null
    try { const value = await fetchV3Bag(); if (valid() && current === sequence) items.value = value }
    catch (e) { if (valid() && current === sequence) readError.value = e instanceof Error ? e.message : '背包读取失败' }
    finally { if (valid() && current === sequence) loading.value = false }
  }
  async function execute(intent: { input: InventoryCommand; key: string }) {
    const valid = capture()
    if (!valid() || busy.value) return
    const recovering = pending.value !== null, oldName = account.value?.userName, id = account.value?.oId
    pending.value = intent; busy.value = true; error.value = ''; followupError.value = ''
    let committed = false
    try {
      const result = await executeV3Inventory(intent.input, intent.key)
      if (!valid()) return
      pending.value = null; receipt.value = result; committed = true
      if (result.kind === 'nameCard' || result.kind === 'points') { clearCache(); invalidateVipName(id, oldName) }
      await Promise.all([load(), auth.reloadAccount().catch(() => { if (valid()) followupError.value = '操作已确认，当前账号信息刷新失败，请稍后重新读取' })])
    } catch (e) { if (valid()) { if (committed) followupError.value = '操作已确认，后续刷新失败，请重新读取当前资料与背包'; else error.value = e instanceof Error ? e.message : '操作结果未确认'; if (!committed && !recovering && e instanceof ApiError && e.status >= 400 && e.status < 500) pending.value = null } }
    finally { if (valid()) busy.value = false }
  }
  async function use(raw: InventoryCommand) {
    if (pending.value || busy.value || confirming.value) return
    const valid = capture(); if (!valid()) return
    let input: InventoryCommand
    error.value = ''
    try { input = inventoryInput(raw) } catch (e) { error.value = e instanceof Error ? e.message : '参数不合法'; return }
    const descriptions = { checkin1day: '消耗1张单日免签卡，增加1天剩余免签天数；不会立即完成今日签到。', checkin2days: '消耗1张两日免签卡，增加2天剩余免签天数；不会立即完成今日签到。', patchCheckinCard: '消耗1张补签卡，按平台自然日补一天，能连接已有连续记录时接回；须今天已签到且满足补签条件，不额外发积分。' }
    const message = 'userName' in input ? `将用户名改为 ${input.userName}。${input.kind === 'points' ? '按当前费用扣积分（目前1000积分），实际费用以回执为准。' : '消耗1张改名卡。' }名称仍需通过可用性与内容校验，是否继续？` : `${descriptions[input.kind]}是否继续？`
    confirming.value = true
    try { if (await fpConfirm({ title: '确认背包或改名操作', message, confirmText: '确认使用' }) && valid()) { receipt.value = null; await execute({ input, key: profileOperationKey() }) } }
    finally { if (valid()) confirming.value = false }
  }
  function retry() { if (pending.value) void execute(pending.value) }
  return { revision, items, loading, readError, error, followupError, busy, confirming, pending, receipt, load, use, retry }
})
