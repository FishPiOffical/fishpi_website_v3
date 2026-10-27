<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useV3FinanceStore } from '@/stores/v3Finance'
const props = withDefaults(defineProps<{ initialRecipient?: string }>(), { initialRecipient: '' })
const auth = useAuthStore(), finance = useV3FinanceStore()
const { account } = storeToRefs(auth)
const { transferBusy, transferConfirming, transferPending, transferReceipt, transferError, refreshError, revision } = storeToRefs(finance)
const recipient = ref(props.initialRecipient), amount = ref(5), memo = ref('')
watch([() => props.initialRecipient, transferPending], ([name, pending]) => {
  if (pending) { recipient.value = pending.input.userName; amount.value = pending.input.amount; memo.value = pending.input.memo }
  else if (name) recipient.value = name
}, { immediate: true, flush: 'sync' })
watch(revision, () => { recipient.value = props.initialRecipient; amount.value = 5; memo.value = '' }, { flush: 'sync' })
function send() { void finance.transfer({ userName: recipient.value, amount: amount.value, memo: memo.value }) }
onBeforeUnmount(() => { recipient.value = ''; memo.value = '' })
</script>

<template>
  <section class="point-transfer" aria-label="v3积分转账">
    <p>当前账户余额：{{ account?.userPoint ?? '—' }} 积分</p>
    <p class="hint">总额包含手续费。普通手续费为总额的1%向下取整、最低1分；当前有效VIP4_YEAR/VIP4_MONTH和手续费收款账号本人免手续费。实际到账与费用以回执为准。</p>
    <form @submit.prevent="send">
      <fieldset :disabled="transferBusy || transferConfirming || !!transferPending">
        <label>收款用户名<input v-model="recipient" aria-label="转账收款用户名" maxlength="64" autocomplete="off" /></label>
        <label>总扣款积分<input v-model.number="amount" aria-label="转账总积分" type="number" min="2" max="2147483647" step="1" /></label>
        <label>备注<input v-model="memo" aria-label="转账备注" maxlength="128" placeholder="可空，保存时清除HTML" /></label>
        <button type="submit">{{ transferBusy ? '正在转账…' : '核对并转账' }}</button>
      </fieldset>
    </form>
    <p v-if="transferError" role="alert" class="error">{{ transferError }}</p>
    <p v-if="transferPending && !transferBusy" class="hint">转账结果尚未确认，原请求保留在当前登录会话中；重试恢复同一笔转账。刷新页面或退出会清除本地恢复信息，请先核对流水。</p>
    <button v-if="transferPending" type="button" :disabled="transferBusy" @click="finance.retryTransfer">重试未确认转账</button>
    <section v-if="transferReceipt" class="receipt" aria-label="最近已确认转账">
      <h3>最近已确认转账</h3><p role="status">转账结果已确认</p>
      <p>收款用户名：{{ transferReceipt.recipient.userName }}</p><p>总扣款：{{ transferReceipt.amount }} 积分 · 主款到账：{{ transferReceipt.receivedPoints }} 积分 · 手续费：{{ transferReceipt.feePoints }} 积分</p>
      <p v-if="transferReceipt.memo">处理后备注：{{ transferReceipt.memo }}</p><p>记录编号：{{ transferReceipt.transferId }}</p>
    </section>
    <p v-if="refreshError" role="alert" class="error">{{ refreshError }}</p>
  </section>
</template>

<style scoped lang="scss">
.point-transfer { margin: 16px 0; } fieldset { border: 0; padding: 0; margin: 0; } label { display: grid; gap: 6px; margin: 12px 0; } input { padding: 9px 12px; color: var(--fp-text); background: var(--fp-bg); border: 1px solid var(--fp-border); border-radius: 8px; max-width: 100%; box-sizing: border-box; }
button { padding: 8px 12px; margin: 6px 8px 6px 0; border: 1px solid var(--fp-border); border-radius: 8px; color: var(--fp-text); background: transparent; cursor: pointer; } button:disabled { opacity: .5; cursor: default; } .hint { font-size: 13px; color: var(--fp-muted); } .error { color: #c34a36; } .receipt { margin-top: 18px; padding-top: 12px; border-top: 1px solid var(--fp-border); overflow-wrap: anywhere; }
</style>
