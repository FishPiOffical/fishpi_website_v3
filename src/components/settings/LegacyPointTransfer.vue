<script setup lang="ts">
import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLegacyPointTransferStore } from '@/stores/legacyPointTransfer'
import { getAuthContextVersion } from '@/api/http'
import { pointTransferInput } from '@/api/v3-finance'
import { fpConfirm } from '@/composables/useDialog'
const props = withDefaults(defineProps<{ initialRecipient?: string }>(), { initialRecipient: '' })
const auth = useAuthStore(), finance = useLegacyPointTransferStore(), recipient = ref(props.initialRecipient), amount = ref(5), memo = ref(''), error = ref(''), confirming = ref(false), mounted = ref(false)
const identity = () => JSON.stringify([getAuthContextVersion(), auth.apiKey, auth.account?.oId])
let confirmation: AbortController | null = null
function cancel() { confirmation?.abort(); confirmation = null; confirming.value = false }
async function send() {
  if (!mounted.value || finance.busy || finance.pending || confirming.value) return
  error.value = ''
  let input
  try { input = pointTransferInput({ userName: recipient.value, amount: amount.value, memo: memo.value }) } catch (failure) { error.value = failure instanceof Error ? failure.message : '转账参数不合法'; return }
  if (input.userName === auth.account?.userName) { error.value = '不能向自己转账'; return }
  const owner = identity(), controller = new AbortController()
  confirmation = controller; confirming.value = true
  try {
    const balance = await finance.readBalance()
    if (controller.signal.aborted || !mounted.value || owner !== identity() || balance === null) return
    if (balance < input.amount) { error.value = '当前余额不足'; return }
    const approved = await fpConfirm({ title: '确认旧版积分转账', message: `向用户名 ${input.userName} 转账，请求总积分 ${input.amount}（含手续费）。备注：${input.memo || '（空）'}。手续费和到账金额由服务端按当时会员状态处理，旧接口不返回明细；结果未知时不能自动重转。是否继续？`, confirmText: '确认转账', signal: controller.signal })
    if (approved && !controller.signal.aborted && mounted.value && owner === identity() && !finance.busy && !finance.pending) {
      const result = await finance.transfer(input)
      if (result && recipient.value.trim() === input.userName && amount.value === input.amount && memo.value.trim() === input.memo) { amount.value = 5; memo.value = '' }
    }
  } finally { if (confirmation === controller) { confirmation = null; confirming.value = false } }
}
watch(identity, () => { cancel(); recipient.value = props.initialRecipient; amount.value = 5; memo.value = ''; error.value = ''; if (mounted.value) void finance.readBalance() }, { flush: 'sync' })
watch(() => props.initialRecipient, name => { cancel(); recipient.value = name; amount.value = 5; memo.value = ''; error.value = '' }, { flush: 'sync' })
onMounted(() => { mounted.value = true; void finance.readBalance() })
onScopeDispose(() => { mounted.value = false; cancel(); recipient.value = memo.value = '' })
</script>
<template>
  <section class="point-transfer" aria-label="旧版积分转账">
    <p>当前账户余额：{{ finance.balance ?? '—' }} 积分</p><p v-if="finance.balanceLoading" role="status">正在读取余额…</p><p v-if="finance.balanceError" role="alert" class="error">{{ finance.completed ? '转账已确认，当前余额刷新失败；请重新读取，无需再次转账。' : '' }}{{ finance.balanceError }}</p><button type="button" :disabled="finance.balanceLoading || finance.busy" @click="finance.readBalance">重新读取转账余额</button>
    <p class="hint">请求总额包含手续费，实际费用按服务端当时会员状态计算。旧接口不提供到账、费用或流水编号，请核对积分流水。</p>
    <form @submit.prevent="send"><fieldset :disabled="finance.busy || !!finance.pending || confirming"><label>收款用户名<input v-model="recipient" aria-label="转账收款用户名" maxlength="64" autocomplete="off" /></label><label>请求总积分<input v-model.number="amount" aria-label="转账总积分" type="number" min="2" max="2147483647" step="1" /></label><label>备注<input v-model="memo" aria-label="转账备注" maxlength="128" placeholder="可空，服务端清洗HTML" /></label><button type="submit">核对并转账</button></fieldset></form>
    <p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="finance.error" role="alert" class="error">{{ finance.error }}</p><p v-if="finance.pending" role="status">转账结果未确认，已保留本次锁定；请先核对余额与流水。刷新或退出会清除本机状态。</p>
    <section v-if="finance.completed" class="receipt" aria-label="旧转账已确认请求"><h3>本次请求已确认</h3><p>请求用户名：{{ finance.completed.userName }} · 请求总积分：{{ finance.completed.amount }}</p><p class="hint">成功响应未提供实际到账金额、手续费或流水编号，不能将本次请求信息当作完整账单。</p></section>
    <RouterLink to="/points">查看积分流水</RouterLink>
  </section>
</template>
<style scoped lang="scss" src="./point-transfer.scss"></style>
