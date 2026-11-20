<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { readPetCoffee, type PetCatalog, type PetCoffeeOffer } from '@/api/v3-pets'
import { fpConfirm } from '@/composables/useDialog'
import { getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore } from '@/stores/pets'
import PetIcon from './PetIcon.vue'

type Item = PetCatalog['items'][number]
const props = defineProps<{ active: boolean }>()
const pets = usePetsStore(), auth = useAuthStore()
const coffee = ref<PetCoffeeOffer | null>(null)
const coffeeLoading = ref(false)
const coffeeError = ref('')
const confirmingCoffee = ref(false)
let coffeeRead: AbortController | undefined
let coffeeConfirmation: AbortController | undefined
const coffeeOwner = () => `${getAuthContextVersion()}:${auth.account?.oId ?? ''}:${!!auth.accessToken}:${pets.pet?.id ?? ''}`
const showCoffee = computed(() => filter.value === 'all' || filter.value === 'drink')
const coffeeReason = computed(() => {
  if (!coffee.value?.enabled || !pets.pet) return ''
  if (coffee.value.remaining === 0) return '今天的咖啡次数已用完'
  if (pets.pet.activity) return '休息或活动结束后才能购买'
  if (pets.pet.energy >= 100) return '宠物精力已满'
  if (coffee.value.balance < coffee.value.price) return '积分余额不足'
  return ''
})
async function refreshCoffee() {
  coffeeRead?.abort()
  const controller = new AbortController()
  coffeeRead = controller
  coffeeLoading.value = true
  coffeeError.value = ''
  try {
    const result = await readPetCoffee(controller.signal)
    if (!controller.signal.aborted) coffee.value = result
  } catch (error) {
    if (!controller.signal.aborted) {
      coffee.value = null
      coffeeError.value = error instanceof Error ? error.message : '宠物咖啡暂不可用'
    }
  } finally {
    if (!controller.signal.aborted) coffeeLoading.value = false
  }
}
watch([coffeeOwner, () => props.active, () => pets.state], ([owner, active], previous) => {
  if (owner !== previous?.[0] || !active) {
    coffeeRead?.abort()
    coffeeConfirmation?.abort()
    coffee.value = null
    coffeeLoading.value = false
    coffeeError.value = ''
  }
  if (active && pets.pet && auth.accessToken) void refreshCoffee()
}, { immediate: true })

async function buyCoffee() {
  const offer = coffee.value, pet = pets.pet, owner = coffeeOwner()
  if (!offer?.enabled || !pet || !props.active || locked.value || coffeeLoading.value || coffeeReason.value || confirmingCoffee.value) return
  const controller = new AbortController()
  coffeeConfirmation = controller
  confirmingCoffee.value = true
  try {
    const confirmed = await fpConfirm({ title: '购买宠物咖啡', confirmText: '购买并使用', signal: controller.signal,
      message: `将扣除 ${offer.price} 积分，立即恢复最多 ${offer.energy} 点精力。当前余额 ${offer.balance} 积分，今天还可使用 ${offer.remaining} 次。` })
    if (!confirmed || controller.signal.aborted || owner !== coffeeOwner()) return
    if (offer.today !== pets.state?.today) await pets.refresh()
    if (controller.signal.aborted || owner !== coffeeOwner()) return
    const purchased = await pets.buyCoffee(pet.id, offer.today, offer.version)
    if (!purchased && owner === coffeeOwner() && props.active && !pets.refreshNeeded && !pets.pending) await refreshCoffee()
  } finally {
    if (coffeeConfirmation === controller) {
      coffeeConfirmation = undefined
      confirmingCoffee.value = false
    }
  }
}

const filter = ref('all'), quantities = reactive<Record<string, number>>({})
const root = ref<HTMLElement | null>(null)
let focusVersion = 0
const filters = [{ id: 'all', name: '全部' }, { id: 'food', name: '食品' }, { id: 'drink', name: '饮品' }, { id: 'material', name: '材料' }]
const items = computed(() => pets.catalog?.items.filter(item => item.price !== null && (filter.value === 'all' || item.category === filter.value)) ?? [])
const locked = computed(() => pets.loading || pets.busy || !!pets.pending || pets.refreshNeeded)
const owned = (id: string) => pets.state?.inventory.find(item => item.itemId === id)?.quantity ?? 0
const quantity = (id: string) => quantities[id] ?? 1
const icon = (item: Item) => item.category === 'food' ? 'feed' : item.category === 'drink' ? 'water' : 'material'
function effects(item: Item) {
  return (Object.entries(item.effects) as [keyof Item['effects'], number][])
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${{ hunger: '饱食', water: '水分', mood: '心情', energy: '精力' }[key]} +${value}`).join(' · ')
}
function useReason(item: Item) {
  if (pets.pet?.activity) return '活动结束后才能使用'
  if (!owned(item.id)) return '背包中暂无此物品'
  if (!pets.pet) return '请先读取宠物状态'
  if (Object.entries(item.effects).every(([key, value]) => !value || pets.pet![key as keyof Item['effects']] >= 100)) return '当前状态充足'
  return ''
}
function buy(item: Item) {
  if (locked.value || item.price === null || (pets.coins ?? 0) < item.price * quantity(item.id)) return
  void pets.buyItem(item.id, quantity(item.id))
}
function use(item: Item) {
  if (locked.value || useReason(item) || item.category === 'material') return
  void pets.act(item.category === 'food' ? 'feed' : 'water', item.id)
}
/** 只定位当前仍在售的物品，保留购买数量，不触发购买或使用。 */
async function focusItem(itemId?: string, stillActive: () => boolean = () => true): Promise<boolean> {
  const version = ++focusVersion
  const owner = `${getAuthContextVersion()}:${auth.account?.oId ?? ''}:${!!auth.accessToken}:${pets.pet?.id ?? ''}`
  const item = pets.catalog?.items.find(value => value.id === itemId && value.price !== null)
  if (!stillActive() || !pets.pet || !pets.catalog || (itemId && !item)) return false
  if (item) filter.value = item.category
  await nextTick()
  // 父分区的导航代次同步失效，防止隐藏面板在下一轮 DOM 更新前抢回焦点。
  if (!stillActive() || version !== focusVersion || owner !== `${getAuthContextVersion()}:${auth.account?.oId ?? ''}:${!!auth.accessToken}:${pets.pet?.id ?? ''}`
    || (itemId && !items.value.some(value => value.id === itemId))) return false
  const heading = itemId
    ? [...root.value?.querySelectorAll<HTMLElement>('[data-pet-item]') ?? []].find(element => element.dataset.petItem === itemId)
    : root.value?.querySelector<HTMLElement>('#pet-shop-title')
  if (!heading?.isConnected || root.value?.closest<HTMLElement>('[data-pet-panel]')?.style.display === 'none') return false
  heading.focus({ preventScroll: true })
  heading.scrollIntoView?.({ block: 'nearest' })
  return document.activeElement === heading
}
defineExpose({ focusItem })
onBeforeUnmount(() => { focusVersion++; coffeeRead?.abort(); coffeeConfirmation?.abort() })
watch(() => `${getAuthContextVersion()}:${auth.account?.oId ?? ''}:${!!auth.accessToken}`, () => {
  filter.value = 'all'
  for (const key of Object.keys(quantities)) delete quantities[key]
})
</script>

<template>
  <section v-if="pets.catalog && pets.state && pets.pet" ref="root" class="pet-shop" aria-labelledby="pet-shop-title">
    <header class="shop-heading"><div><h2 id="pet-shop-title" tabindex="-1"><PetIcon name="shop" />家园小铺</h2><p>补充食物与饮品，也为下一件手作准备材料。</p></div><span><PetIcon name="bag" />普通商品存入背包</span></header>
    <div class="shop-filters" aria-label="商店分类"><button v-for="option in filters" :key="option.id" type="button" :aria-pressed="filter === option.id" @click="filter = option.id">{{ option.name }}</button></div>
    <div class="shop-grid">
      <article v-for="item in items" :key="item.id" class="shop-item">
        <header><span class="item-icon"><PetIcon :name="icon(item)" /></span><div><h3 :data-pet-item="item.id" tabindex="-1">{{ item.name }}</h3><span>背包 {{ owned(item.id) }} 份</span></div><strong>{{ item.price }}<small> {{ pets.currencyName }} / 份</small></strong></header>
        <p class="item-description">{{ item.description }}</p><p class="item-effects">{{ effects(item) || '用于配方制作' }}</p>
        <form class="shop-buy" @submit.prevent="buy(item)"><label :for="`pet-item-quantity-${item.id}`" class="sr-only">购买{{ item.name }}数量</label><select :id="`pet-item-quantity-${item.id}`" :value="quantity(item.id)" :disabled="locked" @change="quantities[item.id] = Number(($event.target as HTMLSelectElement).value)"><option :value="1">1</option><option :value="5">5</option><option :value="10">10</option></select><button type="submit" :disabled="locked || item.price === null || pets.state.wallet.coins < item.price * quantity(item.id)" :aria-label="`购买${item.name}`">购买 · {{ (item.price ?? 0) * quantity(item.id) }} {{ pets.currencyName }}</button></form>
        <button v-if="item.category !== 'material'" type="button" class="item-use" :disabled="locked || !!useReason(item)" :title="useReason(item) || `使用一份${item.name}`" :aria-label="`使用${item.name}`" @click="use(item)">{{ useReason(item) || '使用一份' }}</button>
        <p v-else class="material-use">在手作配方中制作收藏</p>
      </article>
      <article v-if="showCoffee && coffee?.enabled" class="shop-item">
        <header><span class="item-icon"><PetIcon name="water" /></span><div><h3>宠物咖啡</h3><span>今日剩余 {{ coffee.remaining }} / {{ coffee.dailyLimit }} 次</span></div><strong>{{ coffee.price }}<small> 积分</small></strong></header>
        <p class="item-description">购买后立即使用</p>
        <p class="item-effects">精力 +{{ coffee.energy }} · 上限 100</p>
        <div class="shop-buy"><button type="button" :disabled="locked || confirmingCoffee || coffeeLoading || !!coffeeReason" @click="buyCoffee">{{ coffeeReason || '购买并使用' }}</button></div>
      </article>
    </div>
    <p v-if="showCoffee && coffeeError" class="shop-empty" role="status">宠物咖啡读取失败 <button type="button" @click="refreshCoffee">重试</button></p>
    <p v-if="!items.length && !(showCoffee && coffee?.enabled)" class="shop-empty">这个分类暂时没有在售物品。</p>
  </section>
</template>

<style scoped>
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
.pet-shop { margin-top: 20px; padding: 24px; border: 1px solid var(--fp-border); border-radius: var(--fp-panel-radius, 14px); background: var(--fp-card); color: var(--fp-text); }
.shop-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; margin-bottom: 20px; }.shop-heading h2 { display: flex; align-items: center; gap: 9px; font-size: 19px; margin: 0; color: var(--fp-title); }.shop-heading h2 svg { color: var(--fp-primary); }.shop-heading p { margin: 8px 0 0; color: var(--fp-muted); font-size: 13px; line-height: 1.7; }.shop-heading > span { display: inline-flex; align-items: center; gap: 6px; color: var(--fp-muted); font-size: 11px; }.shop-heading > span svg { width: 15px; height: 15px; }
.shop-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }.shop-filters button { border: 1px solid transparent; border-radius: 7px; padding: 7px 14px; min-height: 38px; background: transparent; color: var(--fp-muted); font: inherit; font-size: 12px; cursor: pointer; }.shop-filters button[aria-pressed=true] { border-color: var(--fp-border); color: var(--fp-primary); background: var(--fp-primary-soft); }
.shop-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }.shop-item { display: flex; flex-direction: column; min-width: 0; padding: 16px; border: 1px solid var(--fp-border); border-radius: 11px; }.shop-item > header { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }.item-icon { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border-radius: 9px; background: var(--fp-primary-soft); color: var(--fp-primary); }.shop-item header > div { flex: 1; min-width: 65px; }.shop-item h3 { margin: 0 0 5px; font-size: 14px; color: var(--fp-title); }.shop-item header div > span { color: var(--fp-muted); font-size: 11px; }.shop-item header > strong { font-size: 16px; font-variant-numeric: tabular-nums; }.shop-item header > strong small { font-size: 10px; font-weight: 400; color: var(--fp-muted); }
.item-description { margin: 16px 0 7px; color: var(--fp-muted); font-size: 12px; line-height: 1.7; }.item-effects { margin: 0 0 18px; color: var(--fp-primary); font-size: 11px; line-height: 1.7; }.shop-buy { display: flex; gap: 8px; margin-top: auto; }.shop-buy select { min-width: 0; width: 65px; padding: 8px; border: 1px solid var(--fp-border); border-radius: 8px; background: var(--fp-card); color: var(--fp-text); font: inherit; font-size: 12px; }.shop-buy button { flex: 1; min-height: 40px; padding: 8px; border: 1px solid color-mix(in srgb, var(--fp-primary) 20%, var(--fp-border)); border-radius: 8px; background: var(--fp-primary-soft); color: var(--fp-primary); font: inherit; font-weight: 600; font-size: 12px; cursor: pointer; }.item-use { display: block; width: 100%; min-height: 38px; margin-top: 8px; padding: 6px 4px; border: 0; background: transparent; color: var(--fp-primary); font: inherit; font-size: 12px; cursor: pointer; }.material-use { margin: 8px 0 0; min-height: 38px; display: grid; place-items: center; color: var(--fp-muted); font-size: 11px; }.shop-empty { margin: 0; color: var(--fp-muted); padding: 20px; text-align: center; font-size: 13px; }
button:disabled { opacity: .5; cursor: default; }button:not(:disabled):hover { filter: brightness(.97); }button:focus-visible, select:focus-visible { outline: 2px solid var(--fp-primary-ink, var(--fp-primary)); outline-offset: 3px; }
.shop-item:has(h3:focus-visible) { border-color: var(--fp-primary); background: var(--fp-primary-soft); }
:is(h2, h3)[tabindex="-1"]:focus-visible { outline: 2px solid var(--fp-primary-ink, var(--fp-primary)); outline-offset: 4px; border-radius: 2px; }
:is(h2, h3)[tabindex="-1"] { scroll-margin-block: calc(var(--fp-nav-h, 58px) + 16px) 24px; }
@media (max-width: 1000px) { .shop-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .pet-shop { padding: 20px; }.shop-grid { grid-template-columns: 1fr; }.shop-heading h2 { font-size: 18px; }.shop-filters button, .shop-buy button, .shop-buy select, .item-use { min-height: 44px; } }
@media (max-width: 390px) { .pet-shop { padding: 16px; }.shop-heading > span { display: none; }.shop-filters { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px; }.shop-filters button { padding-inline: 4px; } }
</style>
