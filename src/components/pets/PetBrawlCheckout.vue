<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import FpDialog from '@/components/FpDialog.vue'
import { getAuthContextVersion } from '@/api/http'
import { readBrawlOrder, readBrawlOrders, type BrawlOrder, type BrawlWeapon } from '@/api/v3-pets'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore } from '@/stores/pets'

const props = defineProps<{ petId: string; weapon: BrawlWeapon; level: number; version: number; cost?: number; materials: number; disabled: boolean }>()
const pets = usePetsStore()
const auth = useAuthStore()
const names = { SPOON: '小木勺', GUARD: '软垫护腕', FAN: '折纸扇' }
const labels = { pending: '待确认', completed: '已完成', expired: '已过期' }
const opened = ref(false)
const selected = ref<BrawlOrder>()
const orders = ref<BrawlOrder[]>([])
const loading = ref(false)
const next = ref<string | null>(null)
const balance = ref<number>()
const deduction = ref(0)
const problem = ref('')
const maximum = computed(() => Math.min(props.cost ?? 0, props.materials))
const blocked = computed(() => loading.value || pets.busy || !!pets.pending || pets.offline)
const pendingHere = computed(() => pets.pending?.kind === 'brawl-quote' || pets.pending?.kind === 'brawl-confirm')
const affordable = computed(() => !!selected.value && (selected.value.points === 0 || (balance.value ?? -1) >= selected.value.points))
let request: AbortController | undefined
let followUpOrder: string | undefined
let boundary = getAuthContextVersion()

function startRead() {
  request?.abort()
  request = new AbortController()
  loading.value = true
  problem.value = ''
  return request.signal
}
function fail(reason: unknown, signal: AbortSignal) {
  if (!signal.aborted) problem.value = reason instanceof Error ? reason.message : '暂时无法读取订单'
}
async function readList(before?: string) {
  const signal = startRead()
  try {
    const result = await readBrawlOrders(before, signal)
    if (signal.aborted) return
    orders.value = before ? [...orders.value, ...result.list] : result.list
    balance.value = result.balance
    next.value = result.next
  } catch (reason) { fail(reason, signal) } finally { if (!signal.aborted) loading.value = false }
}
async function show(id: string) {
  followUpOrder = id
  const signal = startRead()
  try {
    const result = await readBrawlOrder(id, signal)
    if (signal.aborted) return
    selected.value = result.order
    balance.value = result.balance
  } catch (reason) { fail(reason, signal) } finally { if (!signal.aborted) loading.value = false }
}
function open() {
  opened.value = true
  selected.value = undefined
  followUpOrder = undefined
  deduction.value = maximum.value
  if (pets.pending?.kind === 'brawl-confirm') void show(pets.pending.orderId)
  else void readList()
}
function close() {
  if (pets.busy) return
  opened.value = false
  request?.abort()
  loading.value = false
}
function back() {
  selected.value = undefined
  followUpOrder = undefined
  deduction.value = maximum.value
  void readList()
}
function quote() {
  if (blocked.value || props.disabled || !props.cost || !Number.isInteger(deduction.value)
      || deduction.value < 0 || deduction.value > maximum.value) return
  void pets.executeBrawl({ kind: 'brawl-quote', petId: props.petId, weapon: props.weapon,
    level: props.level, version: props.version, materials: deduction.value })
}
async function confirm() {
  const current = selected.value
  if (blocked.value || !affordable.value || current?.status !== 'pending' || current.petId !== props.petId) return
  const confirmed = await pets.executeBrawl({ kind: 'brawl-confirm', petId: current.petId, version: current.version, orderId: current.id })
  if (!confirmed && !pets.pending && opened.value && selected.value?.id === current.id) void show(current.id)
}
watch(() => pets.confirmedEvent, event => {
  if (!opened.value || !event?.orderId) return
  void show(event.orderId)
})
watch([() => auth.account?.oId, () => auth.accessToken, () => props.petId], ([owner, token, id], [previous, , previousId]) => {
  const context = getAuthContextVersion()
  if (!token || owner !== previous || id !== previousId || context !== boundary) {
    request?.abort()
    opened.value = loading.value = false
    selected.value = undefined
    followUpOrder = undefined
    balance.value = undefined
    next.value = null
    orders.value = []
    problem.value = ''
  }
  boundary = context
}, { flush: 'sync' })
onUnmounted(() => request?.abort())
</script>

<template>
  <button type="button" class="checkout-trigger" @click="open()">积分强化与订单</button>
  <FpDialog :open="opened" title="积分强化" :width="480" :persistent="pets.busy" :closable="!pets.busy" @close="close()">
    <div class="checkout">
      <p v-if="balance !== undefined" class="balance">积分余额 <strong>{{ balance.toLocaleString() }}</strong></p>
      <p v-if="problem" role="alert">{{ problem }} <button type="button" @click="followUpOrder ? show(followUpOrder) : readList()">重读</button></p>
      <p v-if="pendingHere && pets.pendingError" role="status">{{ pets.pendingError }}</p>
      <p v-else-if="pets.error && !pets.busy" role="alert">{{ pets.error }}</p>
      <button v-if="pendingHere" type="button" :disabled="pets.busy || pets.offline" @click="pets.retryPending()">继续原操作</button>
      <template v-if="selected">
        <h3>{{ names[selected.weapon] }}强化至 +{{ selected.level + 1 }}</h3>
        <dl>
          <div><dt>订单</dt><dd>{{ selected.id }}</dd></div>
          <div><dt>状态</dt><dd role="status">{{ labels[selected.status] }}</dd></div>
          <div><dt>抵扣材料</dt><dd>{{ selected.materials }}</dd></div>
          <div><dt>实扣积分</dt><dd>{{ selected.points.toLocaleString() }}</dd></div>
        </dl>
        <p v-if="selected.status === 'pending' && balance !== undefined && !affordable" role="status">积分余额不足，可返回调整材料抵扣。</p>
        <p v-else-if="selected.status === 'pending' && balance !== undefined && selected.points">确认后余额 {{ (balance - selected.points).toLocaleString() }}</p>
        <div class="actions">
          <button type="button" :disabled="loading || pets.busy" @click="back()">返回订单</button>
          <button v-if="selected.status === 'pending'" type="button" :disabled="blocked || !affordable || selected.petId !== petId" @click="confirm()">确认强化</button>
        </div>
      </template>
      <template v-else>
        <form v-if="cost" class="quote-form" @submit.prevent="quote()">
          <label>抵扣材料<input v-model.number="deduction" type="number" min="0" :max="maximum" step="1" required :disabled="blocked"></label>
          <small>最多可用 {{ maximum }}，每份抵扣 10 积分。</small>
          <button type="submit" :disabled="blocked || disabled || typeof deduction !== 'number'">获取 {{ names[weapon] }} +{{ level + 1 }} 报价</button>
        </form>
        <h3>最近订单</h3>
        <p v-if="!orders.length && !loading && !problem">暂无订单</p>
        <ul v-else>
          <li v-for="order in orders" :key="order.id"><button type="button" :disabled="loading || pets.busy" @click="show(order.id)">{{ names[order.weapon] }} +{{ order.level + 1 }} · {{ labels[order.status] }} · {{ order.points }} 积分</button></li>
        </ul>
        <button v-if="next" type="button" :disabled="loading" @click="readList(next)">更早订单</button>
      </template>
    </div>
  </FpDialog>
</template>

<style scoped>
.checkout { display: grid; gap: 12px; }
.checkout p, h3, dl { margin: 0; }
.checkout h3 { font-size: 1rem; }
.balance { color: var(--fp-muted); }
.balance strong { color: var(--fp-text); }
dl { display: grid; gap: 6px; }
dl div { display: flex; justify-content: space-between; gap: 12px; }
dd { margin: 0; overflow-wrap: anywhere; }
input, button { min-height: 40px; border: 1px solid var(--fp-border); border-radius: 8px; padding: 6px 12px; background: var(--fp-card); color: var(--fp-text); font: inherit; }
button:not(:disabled) { cursor: pointer; }
button:disabled { opacity: .55; }
.quote-form, .quote-form label { display: grid; gap: 8px; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
ul { display: grid; gap: 6px; padding: 0; margin: 0; list-style: none; }
li button { width: 100%; text-align: start; }
</style>
