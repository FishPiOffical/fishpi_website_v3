<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { PetCatalog } from '@/api/v3-pets'
import { getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore } from '@/stores/pets'
import PetIcon from './PetIcon.vue'

type Item = PetCatalog['items'][number]
const pets = usePetsStore(), auth = useAuthStore()
const filter = ref('all'), quantities = reactive<Record<string, number>>({})
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
watch(() => `${getAuthContextVersion()}:${auth.account?.oId ?? ''}:${!!auth.accessToken}`, () => {
  filter.value = 'all'
  for (const key of Object.keys(quantities)) delete quantities[key]
})
</script>

<template>
  <section v-if="pets.catalog && pets.state && pets.pet" class="pet-shop" aria-labelledby="pet-shop-title">
    <header class="shop-heading"><div><h2 id="pet-shop-title"><PetIcon name="shop" />家园小铺</h2><p>补充食物与饮品，也为下一件手作准备材料。</p></div><span><PetIcon name="bag" />购买后存入背包</span></header>
    <div class="shop-filters" aria-label="商店分类"><button v-for="option in filters" :key="option.id" type="button" :aria-pressed="filter === option.id" @click="filter = option.id">{{ option.name }}</button></div>
    <div class="shop-grid">
      <article v-for="item in items" :key="item.id" class="shop-item">
        <header><span class="item-icon"><PetIcon :name="icon(item)" /></span><div><h3>{{ item.name }}</h3><span>背包 {{ owned(item.id) }} 份</span></div><strong>{{ item.price }}<small> 币 / 份</small></strong></header>
        <p class="item-description">{{ item.description }}</p><p class="item-effects">{{ effects(item) || '用于配方制作' }}</p>
        <form class="shop-buy" @submit.prevent="buy(item)"><label :for="`pet-item-quantity-${item.id}`" class="sr-only">购买{{ item.name }}数量</label><select :id="`pet-item-quantity-${item.id}`" :value="quantity(item.id)" :disabled="locked" @change="quantities[item.id] = Number(($event.target as HTMLSelectElement).value)"><option :value="1">1 份</option><option :value="5">5 份</option><option :value="10">10 份</option></select><button type="submit" :disabled="locked || item.price === null || pets.state.wallet.coins < item.price * quantity(item.id)" :aria-label="`购买${item.name}`">购买 · {{ (item.price ?? 0) * quantity(item.id) }} 币</button></form>
        <button v-if="item.category !== 'material'" type="button" class="item-use" :disabled="locked || !!useReason(item)" :title="useReason(item) || `使用一份${item.name}`" :aria-label="`使用${item.name}`" @click="use(item)">{{ useReason(item) || '使用一份' }}</button>
        <p v-else class="material-use">在下方配方中制作收藏</p>
      </article>
    </div>
    <p v-if="!items.length" class="shop-empty">这个分类暂时没有在售物品。</p>
  </section>
</template>

<style scoped>
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
.pet-shop { margin-top: 20px; padding: 24px; border: 1px solid var(--fp-border); border-radius: var(--fp-panel-radius, 14px); background: var(--fp-card); color: var(--fp-text); }
.shop-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; margin-bottom: 20px; }.shop-heading h2 { display: flex; align-items: center; gap: 9px; font-size: 19px; margin: 0; color: var(--fp-title); }.shop-heading h2 svg { color: var(--fp-primary); }.shop-heading p { margin: 8px 0 0; color: var(--fp-muted); font-size: 13px; line-height: 1.7; }.shop-heading > span { display: inline-flex; align-items: center; gap: 6px; color: var(--fp-muted); font-size: 11px; }.shop-heading > span svg { width: 15px; height: 15px; }
.shop-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }.shop-filters button { border: 1px solid transparent; border-radius: 7px; padding: 7px 14px; min-height: 38px; background: transparent; color: var(--fp-muted); font: inherit; font-size: 12px; cursor: pointer; }.shop-filters button[aria-pressed=true] { border-color: var(--fp-border); color: var(--fp-primary); background: var(--fp-primary-soft); }
.shop-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }.shop-item { display: flex; flex-direction: column; min-width: 0; padding: 16px; border: 1px solid var(--fp-border); border-radius: 11px; }.shop-item > header { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }.item-icon { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border-radius: 9px; background: var(--fp-primary-soft); color: var(--fp-primary); }.shop-item header > div { flex: 1; min-width: 65px; }.shop-item h3 { margin: 0 0 5px; font-size: 14px; color: var(--fp-title); }.shop-item header div > span { color: var(--fp-muted); font-size: 11px; }.shop-item header > strong { font-size: 16px; font-variant-numeric: tabular-nums; }.shop-item header > strong small { font-size: 10px; font-weight: 400; color: var(--fp-muted); }
.item-description { margin: 16px 0 7px; color: var(--fp-muted); font-size: 12px; line-height: 1.7; }.item-effects { margin: 0 0 18px; color: var(--fp-primary); font-size: 11px; line-height: 1.7; }.shop-buy { display: flex; gap: 8px; margin-top: auto; }.shop-buy select { min-width: 0; width: 65px; padding: 8px; border: 1px solid var(--fp-border); border-radius: 8px; background: var(--fp-card); color: var(--fp-text); font: inherit; font-size: 12px; }.shop-buy button { flex: 1; min-height: 40px; padding: 8px; border: 1px solid color-mix(in srgb, var(--fp-primary) 20%, var(--fp-border)); border-radius: 8px; background: var(--fp-primary-soft); color: var(--fp-primary); font: inherit; font-weight: 600; font-size: 12px; cursor: pointer; }.item-use { display: block; width: 100%; min-height: 38px; margin-top: 8px; padding: 6px 4px; border: 0; background: transparent; color: var(--fp-primary); font: inherit; font-size: 12px; cursor: pointer; }.material-use { margin: 8px 0 0; min-height: 38px; display: grid; place-items: center; color: var(--fp-muted); font-size: 11px; }.shop-empty { margin: 0; color: var(--fp-muted); padding: 20px; text-align: center; font-size: 13px; }
button:disabled { opacity: .5; cursor: default; }button:not(:disabled):hover { filter: brightness(.97); }button:focus-visible, select:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
@media (max-width: 1000px) { .shop-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .pet-shop { padding: 20px; }.shop-grid { grid-template-columns: 1fr; }.shop-heading h2 { font-size: 18px; }.shop-filters button, .shop-buy button, .shop-buy select, .item-use { min-height: 44px; } }
@media (max-width: 390px) { .pet-shop { padding: 16px; }.shop-heading > span { display: none; }.shop-filters { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px; }.shop-filters button { padding-inline: 4px; } }
</style>
