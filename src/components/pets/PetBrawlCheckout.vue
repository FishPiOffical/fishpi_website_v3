<script setup lang="ts">
import { computed, onUnmounted, ref, useId, watch } from 'vue'
import FpDialog from '@/components/FpDialog.vue'
import { getAuthContextVersion } from '@/api/http'
import { readBrawlOrder, readBrawlOrders, type BrawlOrder, type BrawlProduct, type BrawlWeapon } from '@/api/v3-pets'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore } from '@/stores/pets'

const props = defineProps<{ petId: string; weapon: BrawlWeapon; level: number; version: number; cost?: number; materials: number; disabled: boolean;
  gearOptions: { id: BrawlProduct; name: string; level: number; cost?: number; hp: number; attack: number }[] }>()
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
const selectionId = useId()
const product = ref<BrawlProduct | ''>('')
const target = computed(() => props.gearOptions.find(option => option.id === product.value))
const costToQuote = computed(() => target.value ? target.value.cost : props.cost)
const problem = ref('')
const maximum = computed(() => Math.min(costToQuote.value ?? 0, props.materials))
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
  product.value = props.cost ? '' : props.gearOptions.find(option => option.cost)?.id ?? ''
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
  if (blocked.value || props.disabled || !costToQuote.value || !Number.isInteger(deduction.value)
      || deduction.value < 0 || deduction.value > maximum.value) return
  void pets.executeBrawl({ kind: 'brawl-quote', petId: props.petId, weapon: props.weapon,
    level: target.value?.level ?? props.level, version: props.version, materials: deduction.value,
    ...(target.value ? { product: target.value.id } : {}) })
}
async function confirm() {
  const current = selected.value
  if (blocked.value || !affordable.value || current?.status !== 'pending' || current.petId !== props.petId) return
  const confirmed = await pets.executeBrawl({ kind: 'brawl-confirm', petId: current.petId, version: current.version, orderId: current.id })
  if (!confirmed && !pets.pending && opened.value && selected.value?.id === current.id) void show(current.id)
}
function orderLabel(order: BrawlOrder) {
  if (!order.product) return `${names[order.weapon]} +${order.level + 1}`
  const label = props.gearOptions.find(item => item.id === order.product)?.name ?? order.product
  return order.product === 'ARTIFACT' || order.product === 'SLOT'
    ? `${names[order.weapon]} · ${label}` : `${label} Lv.${order.level + 1}`
}
watch(product, () => { deduction.value = maximum.value })
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
  <button type="button" class="checkout-trigger" @click="open()"><span>积分与材料商店</span><span aria-hidden="true">↗</span></button>
  <FpDialog :open="opened" title="积分与材料商店" :width="560" :persistent="pets.busy" :closable="!pets.busy" @close="close()">
    <div class="checkout" :aria-busy="loading || pets.busy">
      <div class="wallet-summary">
        <div><span>积分余额</span><strong>{{ balance !== undefined ? balance.toLocaleString() : '—' }}</strong></div>
        <div><span>历练材料</span><strong>{{ materials.toLocaleString() }}</strong></div>
      </div>
      <p v-if="problem" class="checkout-notice" role="alert">{{ problem }} <button type="button" @click="followUpOrder ? show(followUpOrder) : readList()">重读</button></p>
      <p v-if="pendingHere && pets.pendingError" class="checkout-notice" role="status">{{ pets.pendingError }}</p>
      <p v-else-if="pets.error && !pets.busy" class="checkout-notice" role="alert">{{ pets.error }}</p>
      <button v-if="pendingHere" type="button" :disabled="pets.busy || pets.offline" @click="pets.retryPending()">继续原操作</button>
      <template v-if="selected">
        <div class="order-heading"><h3>{{ orderLabel(selected) }}</h3><span class="order-status" :class="selected.status" role="status">{{ labels[selected.status] }}</span></div>
        <dl class="order-details">
          <div><dt>订单编号</dt><dd>{{ selected.id }}</dd></div>
          <div><dt>抵扣材料</dt><dd>{{ selected.materials.toLocaleString() }}</dd></div>
          <div class="order-total"><dt>实扣积分</dt><dd><strong>{{ selected.points.toLocaleString() }}</strong> 积分</dd></div>
        </dl>
        <p v-if="selected.status === 'pending' && balance !== undefined && !affordable" class="checkout-notice" role="status">积分余额不足，可返回调整材料抵扣。</p>
        <p v-else-if="selected.status === 'pending' && balance !== undefined && selected.points" class="secondary remaining-balance">确认后余额 <strong>{{ (balance - selected.points).toLocaleString() }}</strong></p>
        <div class="actions">
          <button type="button" :disabled="loading || pets.busy" @click="back()">返回订单</button>
          <button v-if="selected.status === 'pending'" type="button" class="primary" :disabled="blocked || !affordable || selected.petId !== petId" @click="confirm()">确认强化</button>
        </div>
      </template>
      <template v-else>
        <form v-if="cost || gearOptions.some(item => item.cost)" class="quote-form" @submit.prevent="quote()">
          <div class="form-heading"><h3>打造与强化</h3><span class="secondary">{{ names[weapon] }} +{{ level }}</span></div>
          <div v-if="gearOptions.length" class="field">
            <label :for="selectionId">打造项目</label>
            <select :id="selectionId" v-model="product" :disabled="blocked">
              <option value="" :disabled="!cost">{{ names[weapon] }}强化</option>
              <option v-for="option in gearOptions" :key="option.id" :value="option.id" :disabled="!option.cost">{{ option.name }}{{ option.cost ? '' : '（暂不可用）' }}</option>
            </select>
          </div>
          <p v-if="target && (target.hp || target.attack)" class="upgrade-benefit">本次提升 <span>生命 +{{ (target.hp / 100).toFixed(2) }}</span><span>基础伤害 +{{ (target.attack / 100).toFixed(2) }}</span></p>
          <div class="deduction-field">
            <label :for="`${selectionId}-deduction`">抵扣材料<small>最多 {{ maximum }}，每份抵扣 10 积分</small></label>
            <input :id="`${selectionId}-deduction`" v-model.number="deduction" type="number" min="0" :max="maximum" step="1" required :disabled="blocked">
          </div>
          <button type="submit" class="primary quote-action" :disabled="blocked || disabled || !costToQuote || typeof deduction !== 'number'">获取{{ target ? ` ${target.name}` : ` ${names[weapon]} +${level + 1}` }}报价</button>
        </form>
        <section class="order-history" aria-label="最近订单">
          <div class="form-heading"><h3>最近订单</h3><span v-if="loading" class="secondary" role="status">读取中…</span></div>
          <p v-if="!orders.length && !loading && !problem" class="empty-orders">暂无订单</p>
          <ul v-else>
            <li v-for="order in orders" :key="order.id">
              <button type="button" class="order-row" :disabled="loading || pets.busy" @click="show(order.id)">
                <span class="order-name">{{ orderLabel(order) }}<small>{{ order.id }}</small></span>
                <span class="order-amount"><strong>{{ order.points.toLocaleString() }} <small>积分</small></strong><span class="order-status" :class="order.status">{{ labels[order.status] }}</span></span>
                <span class="order-arrow" aria-hidden="true">›</span>
              </button>
            </li>
          </ul>
          <button v-if="next" type="button" class="older-orders" :disabled="loading" @click="readList(next)">更早订单</button>
        </section>
      </template>
    </div>
  </FpDialog>
</template>

<style scoped>
.checkout { display: grid; gap: 20px; color: var(--fp-text); }
.checkout p, h3, dl, dd { margin: 0; }
.checkout h3 { font-size: .95rem; font-weight: 650; }
.secondary, small { color: var(--fp-muted); font-size: .75rem; }
.wallet-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; padding: 16px; background: var(--fp-bg); border-radius: var(--fp-radius-lg, 10px); }
.wallet-summary > div { min-inline-size: 0; display: grid; gap: 4px; }
.wallet-summary > div + div { padding-inline-start: 16px; border-inline-start: 1px solid var(--fp-border); }
.wallet-summary span { color: var(--fp-muted); font-size: .75rem; }
.wallet-summary strong { font-size: 1.25rem; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.checkout-notice { padding: 12px; border-radius: var(--fp-radius-md, 8px); background: var(--fp-hover); font-size: .825rem; overflow-wrap: anywhere; }
.checkout-notice button { margin-inline-start: 8px; }
.form-heading, .order-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; }
.order-details { display: grid; gap: 14px; padding-block: 4px 0; }
.order-details > div { display: flex; justify-content: space-between; align-items: baseline; gap: 20px; }
.order-details dt { flex: none; color: var(--fp-muted); font-size: .825rem; }
.order-details dd { text-align: end; overflow-wrap: anywhere; min-inline-size: 0; }
.order-details .order-total { border-block-start: 1px solid var(--fp-border); padding-block-start: 16px; }
.order-total dd { font-size: .75rem; color: var(--fp-muted); }
.order-total strong { color: var(--fp-text); font-size: 1.6rem; font-variant-numeric: tabular-nums; }
.remaining-balance { text-align: end; margin-block-start: -12px !important; }
input, select, button { min-block-size: 44px; border: 1px solid var(--fp-border); border-radius: var(--fp-radius-md, 8px); padding: 8px 12px; background: var(--fp-card); color: var(--fp-text); font: inherit; font-size: .875rem; }
input, select { inline-size: 100%; min-inline-size: 0; }
button { transition: background .16s, border-color .16s; }
button:not(:disabled) { cursor: pointer; }
button:not(:disabled):hover { background: var(--fp-hover); border-color: var(--fp-primary); }
button:disabled { opacity: .55; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
button.primary { background: var(--fp-primary-fill, var(--fp-primary)); border-color: var(--fp-primary-fill, var(--fp-primary)); color: var(--fp-on-primary, #fff); font-weight: 600; }
button.primary:not(:disabled):hover { background: var(--fp-primary-fill-hover, var(--fp-primary-hover)); }
.checkout-trigger { display: inline-flex; align-items: center; justify-content: space-between; gap: 16px; }
.checkout-trigger > span:last-child { color: var(--fp-muted); }
.quote-form { display: grid; gap: 16px; }
.field { display: grid; gap: 8px; }
.field label, .deduction-field label { font-size: .825rem; font-weight: 550; }
.deduction-field { display: grid; grid-template-columns: minmax(0, 1fr) 104px; gap: 12px; align-items: center; }
.deduction-field label { display: grid; gap: 4px; }
.deduction-field small { font-weight: 400; }
.upgrade-benefit { display: flex; flex-wrap: wrap; gap: 6px 12px; color: var(--fp-muted); font-size: .75rem; }
.upgrade-benefit span { color: var(--fp-primary-ink, var(--fp-primary)); }
.quote-action { inline-size: 100%; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; }
.actions button { flex: 1 1 130px; }
.order-history { display: grid; gap: 12px; padding-block-start: 20px; border-block-start: 1px solid var(--fp-border); }
ul { display: grid; padding: 0; margin: 0; list-style: none; }
li + li { border-block-start: 1px solid var(--fp-border); }
.order-row { display: flex; align-items: center; gap: 12px; padding: 13px 8px; inline-size: 100%; border-color: transparent; border-radius: 6px; text-align: start; }
.order-name { min-inline-size: 0; flex: 1; display: grid; gap: 4px; font-weight: 550; overflow-wrap: anywhere; }
.order-name small { font-weight: 400; font-size: .7rem; }
.order-amount { display: grid; justify-items: end; gap: 4px; flex: none; }
.order-amount strong { font-weight: 550; font-size: .825rem; }
.order-amount small { font-weight: 400; }
.order-status { display: inline-block; padding: 2px 7px; border-radius: 5px; font-size: .7rem; white-space: nowrap; background: var(--fp-hover); color: var(--fp-muted); }
.order-status.pending { background: color-mix(in srgb, var(--fp-accent) 12%, transparent); color: var(--fp-accent); }
.order-status.completed { background: var(--fp-primary-soft); color: var(--fp-primary-ink, var(--fp-primary)); }
.order-arrow { color: var(--fp-muted); }
.older-orders { justify-self: center; }
.empty-orders { text-align: center; padding-block: 20px; color: var(--fp-muted); font-size: .825rem; }
@media (max-width: 420px) {
  .checkout { gap: 16px; }
  .wallet-summary { padding: 12px; gap: 12px; }
  .wallet-summary > div + div { padding-inline-start: 12px; }
  .deduction-field { grid-template-columns: minmax(0, 1fr) 88px; }
  .order-row { gap: 8px; padding-inline: 0; }
}
@media (prefers-reduced-motion: reduce) { button { transition: none; } }
</style>
