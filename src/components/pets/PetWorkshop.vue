<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PetCatalog } from '@/api/v3-pets'
import { getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore } from '@/stores/pets'
import { formatDateTime } from '@/utils/time'
import { petSkillNames } from './petActivityStatus'
import PetIcon from './PetIcon.vue'

type Recipe = PetCatalog['recipes'][number]
const pets = usePetsStore(), auth = useAuthStore()
const tab = ref<'recipes' | 'collections'>('recipes')
const locked = computed(() => pets.loading || pets.busy || !!pets.pending || pets.refreshNeeded)
const materials = computed(() => pets.catalog?.items.filter(item => item.category === 'material') ?? [])
const owned = (id: string) => pets.state?.inventory.find(item => item.itemId === id)?.quantity ?? 0
const unlocked = (id: string) => pets.state?.collections.find(item => item.id === id)
const itemName = (id: string) => pets.catalog?.items.find(item => item.id === id)?.name ?? id
const skillName = (id: keyof typeof petSkillNames) => pets.catalog?.skills.find(item => item.id === id)?.name ?? petSkillNames[id]
function reason(recipe: Recipe) {
  if (unlocked(recipe.collectionId)) return '已收入收藏'
  if (pets.pet?.activity) return '活动结束后再制作'
  if (!pets.pet) return '请先读取宠物状态'
  for (const requirement of recipe.requirements) {
    const experience = pets.pet.skills.find(skill => skill.id === requirement.skillId)?.experience
    if (experience === undefined || experience < requirement.experience) return `需要${skillName(requirement.skillId)}经验 ${requirement.experience}`
  }
  if (recipe.ingredients.some(item => owned(item.itemId) < item.quantity)) return '材料尚未集齐'
  if ((pets.coins ?? 0) < recipe.coins) return '宠物币不足'
  return ''
}
function craft(recipe: Recipe) {
  if (locked.value || reason(recipe)) return
  void pets.craft(recipe.id)
}
watch(() => `${getAuthContextVersion()}:${auth.account?.oId ?? ''}:${!!auth.accessToken}`, () => { tab.value = 'recipes' })
</script>

<template>
  <section v-if="pets.catalog && pets.state && pets.pet" class="pet-workshop" aria-labelledby="pet-workshop-title">
    <header class="workshop-heading"><div><h2 id="pet-workshop-title"><PetIcon name="craft" />手作与收藏</h2><p>带回旅途中的材料，做成留在家里的纪念。</p></div><span class="collection-count"><PetIcon name="collection" /><b>{{ pets.state.collections.length }}</b> / {{ pets.catalog.collections.length }} 件收藏</span></header>
    <div class="material-bag" aria-label="材料背包"><span><PetIcon name="bag" />材料背包</span><div><span v-for="item in materials" :key="item.id" class="material-chip" :class="{ available: owned(item.id) > 0 }">{{ item.name }}<b>{{ owned(item.id) }}</b></span></div></div>
    <div class="workshop-tabs" aria-label="手作与收藏分类"><button type="button" :aria-pressed="tab === 'recipes'" @click="tab = 'recipes'">制作配方</button><button type="button" :aria-pressed="tab === 'collections'" @click="tab = 'collections'">我的收藏</button></div>
    <div v-if="tab === 'recipes'" class="recipe-grid">
      <article v-for="recipe in pets.catalog.recipes" :key="recipe.id" class="recipe-card" :class="{ completed: !!unlocked(recipe.collectionId) }">
        <header><span class="recipe-mark"><PetIcon :name="unlocked(recipe.collectionId) ? 'check' : 'craft'" /></span><div><h3>{{ recipe.name }}</h3><span>{{ unlocked(recipe.collectionId) ? '已经制作完成' : '制作后永久收藏' }}</span></div></header>
        <p class="recipe-description">{{ recipe.description }}</p>
        <div class="recipe-ingredients"><span v-for="item in recipe.ingredients" :key="item.itemId" :class="{ enough: owned(item.itemId) >= item.quantity }">{{ itemName(item.itemId) }}<b>{{ owned(item.itemId) }} / {{ item.quantity }}</b></span></div>
        <p class="recipe-requirement"><span v-for="requirement in recipe.requirements" :key="requirement.skillId">{{ skillName(requirement.skillId) }}经验 {{ requirement.experience }}</span></p>
        <footer><span><PetIcon name="coin" /><b>{{ recipe.coins }}</b>宠物币</span><button type="button" :disabled="locked || !!reason(recipe)" :title="reason(recipe) || `制作${recipe.name}`" :aria-label="`制作${recipe.name}`" @click="craft(recipe)">{{ reason(recipe) || '制作收藏' }}</button></footer>
      </article>
    </div>
    <div v-else class="collection-grid">
      <article v-for="collection in pets.catalog.collections" :key="collection.id" class="collection-card" :class="{ collected: !!unlocked(collection.id) }"><div class="collection-symbol"><PetIcon :name="unlocked(collection.id) ? 'collection' : 'lock'" /></div><div><h3>{{ collection.name }}</h3><p>{{ collection.description }}</p><time v-if="unlocked(collection.id)">{{ formatDateTime(unlocked(collection.id)!.unlockedAt) }} 收入收藏</time><span v-else class="collection-unowned">完成对应配方后收藏</span></div></article>
    </div>
    <p v-if="tab === 'collections' && !pets.state.collections.length" class="collection-empty">还没有收藏，先从一次探索和一件手作开始。</p>
  </section>
</template>

<style scoped>
.pet-workshop { margin-top: 20px; padding: 24px; border: 1px solid var(--fp-border); border-radius: var(--fp-panel-radius, 14px); background: var(--fp-card); color: var(--fp-text); }.workshop-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; margin-bottom: 22px; }.workshop-heading h2 { display: flex; align-items: center; gap: 9px; font-size: 19px; margin: 0; color: var(--fp-title); }.workshop-heading h2 svg { color: var(--fp-primary); }.workshop-heading p { margin: 8px 0 0; color: var(--fp-muted); font-size: 13px; line-height: 1.7; }.collection-count { display: flex; align-items: center; gap: 6px; color: var(--fp-muted); font-size: 12px; }.collection-count svg { width: 17px; height: 17px; color: var(--fp-accent); }.collection-count b { font-size: 16px; color: var(--fp-title); }
.material-bag { display: flex; align-items: center; flex-wrap: wrap; gap: 12px 18px; padding: 14px; background: var(--fp-bg); border-radius: 9px; margin-bottom: 22px; }.material-bag > span { display: flex; align-items: center; gap: 7px; color: var(--fp-muted); font-size: 12px; }.material-bag svg { width: 17px; height: 17px; }.material-bag > div { display: flex; flex-wrap: wrap; gap: 7px; }.material-chip { display: flex; align-items: center; gap: 12px; padding: 5px 9px; border: 1px solid var(--fp-border); border-radius: 6px; color: var(--fp-muted); background: var(--fp-card); font-size: 11px; }.material-chip b { font-size: 12px; font-variant-numeric: tabular-nums; }.material-chip.available b { color: var(--fp-primary); }
.workshop-tabs { display: flex; gap: 6px; margin-bottom: 18px; }.workshop-tabs button { min-height: 38px; padding: 7px 14px; border: 1px solid transparent; border-radius: 7px; background: transparent; color: var(--fp-muted); font: inherit; font-size: 12px; cursor: pointer; }.workshop-tabs button[aria-pressed=true] { color: var(--fp-primary); background: var(--fp-primary-soft); border-color: var(--fp-border); }
.recipe-grid, .collection-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }.recipe-card { min-width: 0; display: flex; flex-direction: column; padding: 18px; border: 1px solid var(--fp-border); border-radius: 11px; }.recipe-card > header { display: flex; align-items: center; gap: 10px; }.recipe-mark { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 9px; background: var(--fp-bg); color: var(--fp-muted); flex: none; }.completed .recipe-mark { background: var(--fp-primary-soft); color: var(--fp-primary); }.recipe-card h3, .collection-card h3 { margin: 0; font-size: 15px; color: var(--fp-title); }.recipe-card header div > span { display: block; margin-top: 5px; font-size: 11px; color: var(--fp-muted); }.recipe-description { margin: 16px 0; font-size: 12px; color: var(--fp-muted); line-height: 1.7; }
.recipe-ingredients { display: flex; flex-wrap: wrap; gap: 7px; }.recipe-ingredients > span { display: flex; align-items: center; gap: 14px; font-size: 12px; color: var(--fp-muted); padding: 6px 9px; border: 1px solid var(--fp-border); border-radius: 6px; }.recipe-ingredients b { font-size: 11px; font-weight: 500; font-variant-numeric: tabular-nums; }.recipe-ingredients .enough { color: var(--fp-primary); background: var(--fp-primary-soft); border-color: transparent; }.recipe-requirement { display: flex; flex-wrap: wrap; gap: 8px; color: var(--fp-muted); font-size: 11px; line-height: 1.6; margin: 12px 0 18px; }.recipe-card footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 9px; margin-top: auto; }.recipe-card footer > span { display: flex; align-items: center; gap: 4px; color: var(--fp-muted); font-size: 11px; }.recipe-card footer > span svg { width: 15px; height: 15px; color: var(--fp-accent); }.recipe-card footer b { color: var(--fp-title); font-size: 14px; }.recipe-card footer button { min-height: 40px; padding: 8px 12px; border: 1px solid color-mix(in srgb, var(--fp-primary) 20%, var(--fp-border)); border-radius: 8px; background: var(--fp-primary-soft); color: var(--fp-primary); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
.collection-card { display: flex; align-items: flex-start; gap: 12px; padding: 18px; border: 1px solid var(--fp-border); border-radius: 11px; min-width: 0; }.collection-symbol { display: grid; place-items: center; width: 42px; height: 42px; flex: none; border-radius: 11px; color: var(--fp-muted); background: var(--fp-bg); }.collected .collection-symbol { color: var(--fp-accent); background: var(--fp-hover); }.collection-card p { color: var(--fp-muted); font-size: 12px; line-height: 1.7; margin: 10px 0; }.collection-card time, .collection-unowned { color: var(--fp-muted); font-size: 11px; line-height: 1.7; }.collected time { color: var(--fp-primary); }.collection-empty { text-align: center; margin: 18px 0 0; color: var(--fp-muted); font-size: 12px; line-height: 1.7; }
button:disabled { opacity: .5; cursor: default; }button:not(:disabled):hover { filter: brightness(.97); }button:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
@media (max-width: 950px) { .recipe-grid, .collection-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .pet-workshop { padding: 20px; }.workshop-heading h2 { font-size: 18px; }.recipe-grid, .collection-grid { grid-template-columns: 1fr; }.workshop-tabs button, .recipe-card footer button { min-height: 44px; } }
@media (max-width: 390px) { .pet-workshop { padding: 16px; }.workshop-tabs { display: grid; grid-template-columns: 1fr 1fr; }.recipe-card, .collection-card { padding: 16px; }.recipe-card footer { align-items: flex-start; }.recipe-card footer button { width: 100%; }.material-bag { padding: 12px; } }
</style>
