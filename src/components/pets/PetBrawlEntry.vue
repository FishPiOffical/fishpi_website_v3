<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Pet } from '@/api/v3-pets'
import { imageThumbnail } from '@/utils/avatar'
import { petPortrait } from './animations'
import PetIcon from './PetIcon.vue'

const props = defineProps<{ pet: Pick<Pet, 'speciesId' | 'level' | 'name'> }>()
const portrait = computed(() => {
  const source = petPortrait(props.pet.speciesId)
  return source ? imageThumbnail(source, 72, 72) : undefined
})
const levelReady = computed(() => props.pet.level >= 10)
</script>

<template>
  <RouterLink class="pet-brawl-entry" to="/pets/brawl" aria-label="查看宠物乱斗">
    <span class="entry-portrait" aria-hidden="true">
      <img v-if="portrait" :src="portrait" width="72" height="72" alt="" />
      <PetIcon v-else name="collection" />
    </span>
    <span class="entry-copy">
      <span class="entry-heading"><strong>宠物乱斗</strong><span class="entry-level" :class="{ ready: levelReady }">{{ levelReady ? `Lv.${pet.level} · 已达参赛等级` : 'Lv.10 开放对战' }}</span></span>
      <span class="entry-description">{{ levelReady ? '装备强化 · 匹配对战 · 赛季排行' : `${pet.name}当前 Lv.${pet.level}，先来看看乱斗玩法` }}</span>
    </span>
    <span class="entry-action">{{ levelReady ? '进入乱斗' : '查看乱斗' }}<PetIcon name="chevron" /></span>
  </RouterLink>
</template>

<style scoped>
.pet-brawl-entry {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  margin-bottom: 16px;
  padding: 12px 20px 12px 14px;
  border: 1px solid color-mix(in srgb, var(--fp-primary) 24%, var(--fp-border));
  border-radius: var(--fp-panel-radius, 14px);
  background: color-mix(in srgb, var(--fp-primary) 4%, var(--fp-card));
  color: var(--fp-text);
  text-decoration: none;
  transition: border-color .16s, background .16s, transform .16s;
}
.pet-brawl-entry:hover {
  border-color: var(--fp-primary);
  background: color-mix(in srgb, var(--fp-primary) 7%, var(--fp-card));
  color: var(--fp-text);
  text-decoration: none;
  transform: translateY(-2px);
}
.pet-brawl-entry:focus-visible { outline: 2px solid var(--fp-primary-ink, var(--fp-primary)); outline-offset: 3px; }
.entry-portrait { display: grid; place-items: center; width: 72px; height: 72px; }
.entry-portrait img { display: block; width: 100%; height: 100%; object-fit: contain; }
.entry-portrait > svg { width: 32px; height: 32px; color: var(--fp-accent); }
.entry-copy { display: grid; min-width: 0; gap: 7px; }
.entry-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 7px 12px; }
.entry-heading strong { color: var(--fp-title); font-size: 18px; line-height: 1.4; }
.entry-level { color: var(--fp-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.entry-level.ready { color: var(--fp-primary-ink, var(--fp-primary)); }
.entry-description { color: var(--fp-muted); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.entry-action { display: inline-flex; justify-content: center; align-items: center; gap: 12px; min-height: 44px; padding: 0 16px; border: 1px solid var(--fp-border); border-radius: 9px; color: var(--fp-primary-ink, var(--fp-primary)); background: var(--fp-card); font-size: 13px; font-weight: 600; white-space: nowrap; }
.entry-action svg { width: 15px; height: 15px; }
@media (max-width: 600px) {
  .pet-brawl-entry { grid-template-columns: 56px minmax(0, 1fr); gap: 10px 12px; padding: 14px; }
  .entry-portrait { width: 56px; height: 56px; }
  .entry-heading { gap: 4px 10px; }
  .entry-heading strong { font-size: 16px; }
  .entry-action { grid-column: 1 / -1; justify-content: space-between; padding-inline: 14px; }
}
@media (prefers-reduced-motion: reduce) {
  .pet-brawl-entry { transition: none; }
  .pet-brawl-entry:hover { transform: none; }
}
</style>
