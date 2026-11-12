<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import FpDialog from '@/components/FpDialog.vue'
import { useAppearanceShopStore } from '@/stores/appearanceShop'
import { useV3ChatAppearanceStore } from '@/stores/v3ChatAppearance'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import type { AppearanceKind, ShopProduct } from '@/api/v3-appearance-shop'
import { mountAssets } from '@/utils/mounts'
import { findPack } from '@/packs'

const shop = useAppearanceShopStore(), appearance = useV3ChatAppearanceStore(), auth = useAuthStore()
const category = ref<AppearanceKind>('mount'), ownedOnly = ref(false), days = ref<7 | 30>(7)
const confirmation = ref<{ product: ShopProduct; days: 7 | 30 } | null>(null)
const clock = ref(Date.now())
let offset = 0, timer: ReturnType<typeof setInterval> | undefined
watch(() => shop.inventory, value => { offset = value ? value.serverNow - Date.now() : 0; clock.value = Date.now() + offset })
watch(() => shop.open, value => {
  clearInterval(timer)
  confirmation.value = null
  if (value) { appearance.ensure(); clock.value = Date.now() + offset; timer = setInterval(() => clock.value = Date.now() + offset, 1000) }
})
watch(() => `${getAuthContextVersion()}:${auth.account?.oId}:${!!auth.accessToken}`, () => confirmation.value = null)
onBeforeUnmount(() => clearInterval(timer))
const expiration = (id: string) => shop.inventory?.list.find(item => item.productId === id)?.expiresAt || 0
const owned = (id: string) => expiration(id) > clock.value
const supported = (product: ShopProduct) => product.version === 1 && (product.kind === 'mount' ? !!mountAssets[product.styleId] : !!findPack(product.kind, product.styleId))
const products = computed(() => shop.products.filter(product => supported(product) && product.kind === category.value && (ownedOnly.value ? expiration(product.id) > 0 : product.enabled || owned(product.id))))
const blocked = computed(() => shop.busy || shop.loading || !!shop.pending || appearance.busy || !!appearance.pending || !shop.inventory)
const price = (product: ShopProduct, duration = days.value) => duration === 7 ? product.price7 : product.price30
const selected = (product: ShopProduct) => product.kind === 'mount' ? shop.inventory?.mountId === product.styleId : appearance.current?.[product.kind === 'bubble' ? 'bubbleId' : 'frameId'] === product.styleId
function expiryText(product: ShopProduct) {
  const time = expiration(product.id)
  if (!time) return ''
  if (time <= clock.value) return '已到期'
  return `${new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(time)} 到期`
}
async function equip(product: ShopProduct) {
  if (blocked.value || !owned(product.id)) return
  if (product.kind === 'mount') await shop.equip(selected(product) ? '' : product.id)
  else await appearance.choose(product.kind, selected(product) ? product.kind === 'bubble' ? 'classic' : 'none' : product.styleId)
}
async function confirmPurchase() {
  const selection = confirmation.value
  if (!selection || blocked.value) return
  confirmation.value = null
  await shop.buy(selection.product, selection.days)
}
</script>

<template>
  <FpDialog v-model:open="shop.open" title="外观商城" :width="940">
    <div class="shop-toolbar">
      <div class="shop-tabs" aria-label="外观分类">
        <button v-for="item in ([['mount', '座驾'], ['bubble', '气泡'], ['frame', '头像框']] as const)" :key="item[0]" :aria-pressed="category === item[0]" @click="category = item[0]">{{ item[1] }}</button>
      </div>
      <span v-if="shop.inventory" class="balance">{{ shop.inventory.balance.toLocaleString() }} 积分</span>
      <button class="refresh" title="刷新商城" aria-label="刷新商城" :disabled="shop.loading || shop.busy" @click="shop.load">↻</button>
    </div>
    <div class="shop-options">
      <label><input v-model="ownedOnly" type="checkbox"> 我的外观</label>
      <div class="durations"><button v-for="duration in ([7, 30] as const)" :key="duration" :aria-pressed="days === duration" @click="days = duration">{{ duration }} 天</button></div>
    </div>
    <p v-if="!auth.accessToken" class="muted">登录后可以购买并装备。</p>
    <p v-if="shop.error" role="alert" class="error">{{ shop.error }}</p>
    <p v-if="shop.writeError || appearance.writeError" role="alert" class="error">{{ shop.writeError || appearance.writeError }}</p>
    <p v-if="shop.notice" role="status" class="muted">{{ shop.notice }}</p>
    <div v-if="shop.pending" class="pending">有一项操作尚未确认。<button :disabled="shop.busy" @click="shop.retry">恢复原操作</button></div>
    <div v-if="appearance.pending" class="pending">有一项装备操作尚未确认。<button :disabled="appearance.busy" @click="appearance.retry">恢复装备</button></div>
    <div class="shop-grid" :aria-busy="shop.loading">
      <article v-for="product in products" :key="product.id" class="product">
        <div class="product-art fp-msg is-room" data-appearance-snapshot="v1" :data-bubble="product.kind === 'bubble' ? product.styleId : 'classic'" :data-frame="product.kind === 'frame' ? product.styleId : 'none'">
          <img v-if="product.kind === 'mount'" class="mount-image" :src="mountAssets[product.styleId]" :alt="product.name" loading="lazy">
          <div v-else-if="product.kind === 'bubble'" class="fp-bubble">今天也要开心摸鱼。</div>
          <span v-else class="fp-avatar-frame"><img class="fp-avatar" src="/logo.png" :alt="product.name"></span>
        </div>
        <div class="product-info">
          <h3>{{ product.name }} <span v-if="selected(product) && owned(product.id)">已装备</span></h3>
          <p class="expiry">{{ expiryText(product) || '购买后可随时装备' }}</p>
          <div class="product-actions">
            <button v-if="product.enabled" class="purchase" :disabled="blocked || (shop.inventory?.balance ?? 0) < price(product)" @click="confirmation = { product: { ...product }, days }">{{ expiration(product.id) ? '续期' : '购买' }} · {{ price(product) }} 积分</button>
            <span v-else class="muted">已下架</span>
            <button v-if="owned(product.id)" class="equip" :disabled="blocked || (product.kind !== 'mount' && (!appearance.current || appearance.loading))" @click="equip(product)">{{ selected(product) ? '卸下' : '装备' }}</button>
          </div>
        </div>
      </article>
    </div>
    <p v-if="!products.length && !shop.loading && !shop.error" class="empty">{{ ownedOnly ? '还没有这类外观' : '暂无上架外观' }}</p>
    <p v-if="shop.loading && !shop.products.length" class="empty">正在加载外观…</p>
    <p class="footnote">购买不会自动装备或续费。续期累加有效期，历史消息保留发送时外观。</p>
  </FpDialog>
  <FpDialog :open="!!confirmation && shop.open" title="确认购买" :width="380" layer="top" @update:open="confirmation = null">
    <template v-if="confirmation">
      <p>{{ confirmation.product.name }} · {{ confirmation.days }} 天</p>
      <p>消耗 <strong>{{ price(confirmation.product, confirmation.days) }} 积分</strong></p>
      <button class="purchase confirm" :disabled="blocked" @click="confirmPurchase">确认购买</button>
    </template>
  </FpDialog>
</template>

<style scoped>
.shop-toolbar,.shop-options,.shop-tabs,.product-actions,.durations { display:flex; align-items:center; gap:12px; }
.shop-toolbar { border-bottom:1px solid var(--fp-border); padding-bottom:12px; }
.shop-tabs { flex:1; }
.shop-tabs button { border:0; background:none; color:var(--fp-muted); padding:6px; }
.shop-tabs button[aria-pressed=true] { color:var(--fp-primary); font-weight:650; box-shadow:0 2px var(--fp-primary); }
.balance,.muted,.footnote,.expiry,.shop-options { color:var(--fp-muted); font-size:12px; }
.refresh { border:0; background:none; font-size:22px; }
.shop-options { justify-content:space-between; margin:16px 0; }
.durations { gap:3px; background:var(--fp-bg); border-radius:8px; padding:3px; }
.durations button { border:0; background:none; border-radius:6px; padding:4px 10px; font-size:12px; }
.durations button[aria-pressed=true] { background:var(--fp-card); color:var(--fp-primary); }
.shop-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }
.product { min-width:0; overflow:hidden; border:1px solid var(--fp-border); border-radius:14px; }
.product-art { height:158px; display:flex; justify-content:center; align-items:center; background:radial-gradient(ellipse,color-mix(in srgb,#80b9c2 14%,transparent),transparent 75%); }
.product-art .fp-bubble { position:relative; font-size:13px; max-width:85%; }
.product-art .fp-avatar { width:56px; height:56px; object-fit:contain; border-radius:8px; }
.mount-image { height:100%; width:100%; object-fit:contain; }
.product-info { padding:14px; }
h3 { margin:0; font-size:15px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
h3 span { color:var(--fp-primary); font-size:10px; font-weight:400; }
.expiry { min-height:18px; margin:6px 0 14px; }
.product-actions { gap:6px; flex-wrap:wrap; }
.purchase,.equip { border:0; border-radius:8px; padding:7px 10px; font:inherit; font-size:12px; cursor:pointer; }
.purchase { background:var(--fp-primary); color:white; }
.equip { background:var(--fp-bg); color:var(--fp-text); }
button:disabled { opacity:.45; cursor:default; }
.confirm { width:100%; padding:11px; }
.error { color:var(--fp-danger,#c64b42); font-size:13px; }
.pending { font-size:13px; margin:12px 0; }
.empty { padding:32px; text-align:center; color:var(--fp-muted); }
.footnote { margin:20px 0 0; }
@media(max-width:700px) { .shop-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; } .product-art { height:120px; } .product-info { padding:10px; } .balance { max-width:110px; } }
@media(max-width:380px) { .shop-grid { grid-template-columns:1fr; } }
</style>
