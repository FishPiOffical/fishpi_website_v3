<script setup lang="ts">
import { computed } from 'vue'
import { usePetsStore } from '@/stores/pets'
import PetIcon from './PetIcon.vue'
import type { PetHomeTarget } from './petNavigation'
import { usePetClock } from './usePetClock'
import { petActivityStatus } from './petActivityStatus'

const pets = usePetsStore()
const emit = defineEmits<{ navigate: [target: PetHomeTarget] }>()
const { now } = usePetClock()
const activity = computed(() => pets.pet?.activity)
const activityReady = computed(() => activity.value && activity.value.kind !== 'rest'
  && (activity.value.status === 'claimable' || activity.value.endsAt <= now.value))
const activityText = computed(() => petActivityStatus(activity.value ?? null, now.value))
const journey = computed(() => {
  if (!pets.state || !pets.catalog) return null
  const progress = pets.state.stories.find(item => item.status === 'claimable')
    ?? pets.state.stories.find(item => item.status === 'active')
  const story = pets.catalog.stories.find(item => item.id === progress?.id)
  if (!progress || !story) return null
  return { name: story.name, ready: progress.status === 'claimable',
    next: story.steps[progress.completedSteps]?.description }
})
function openActivity() {
  emit('navigate', activity.value?.kind === 'rest' ? { section: 'care' }
    : { section: 'activities', kind: activity.value?.kind })
}
</script>

<template>
  <div v-if="pets.pet && pets.state" class="pet-home-guide" aria-label="家园近况">
    <button type="button" class="guide-item pet-guide-activity" :class="{ ready: activityReady }" @click="openActivity">
      <span class="guide-icon"><PetIcon :name="activityReady ? 'gift' : activity?.kind ?? 'home'" /></span>
      <span class="guide-copy"><span>{{ activityReady ? '收获等你领取' : '伙伴近况' }}</span><strong>{{ activityText }}</strong></span>
      <PetIcon name="chevron" />
    </button>
    <button v-if="!pets.state.dailySupply.claimed" type="button" class="guide-item pet-guide-supply" @click="emit('navigate', { section: 'care', anchor: 'supplies' })">
      <span class="guide-icon"><PetIcon name="bag" /></span>
      <span class="guide-copy"><span>每日补给 · 待领取</span><strong>{{ pets.state.dailySupply.coins }} 币与 {{ pets.state.dailySupply.food }} 份口粮</strong></span>
      <PetIcon name="chevron" />
    </button>
    <button v-if="journey" type="button" class="guide-item pet-guide-journey" :class="{ ready: journey.ready }" @click="emit('navigate', { section: 'stories' })">
      <span class="guide-icon"><PetIcon :name="journey.ready ? 'gift' : 'journey'" /></span>
      <span class="guide-copy"><span>{{ journey.name }}{{ journey.ready ? ' · 待领奖' : '' }}</span><strong>{{ journey.ready ? '查看旅程奖励' : journey.next || '查看成长旅程' }}</strong></span>
      <PetIcon name="chevron" />
    </button>
  </div>
</template>

<style scoped>
.pet-home-guide { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
.guide-item { flex: 1 1 230px; display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 66px; padding: 12px 14px; text-align: left; border: 1px solid var(--fp-border); border-radius: 10px; background: var(--fp-card); color: var(--fp-text); font: inherit; cursor: pointer; transition: border-color .16s, background .16s; }
.guide-item:hover { border-color: color-mix(in srgb, var(--fp-primary) 35%, var(--fp-border)); background: var(--fp-hover); }
.guide-item:focus-visible { outline: 2px solid var(--fp-primary-ink, var(--fp-primary)); outline-offset: 2px; }
.guide-icon { display: grid; place-items: center; flex: none; width: 32px; height: 32px; color: var(--fp-muted); background: var(--fp-bg); border-radius: 8px; }
.ready .guide-icon { color: var(--fp-primary); background: var(--fp-primary-soft); }
.guide-icon svg { width: 17px; height: 17px; }
.guide-copy { display: grid; min-width: 0; flex: 1; gap: 4px; }
.guide-copy > span { color: var(--fp-muted); font-size: 11px; }
.guide-copy strong { font-size: 12px; font-weight: 500; line-height: 1.5; overflow-wrap: anywhere; }
.guide-item > svg { width: 14px; height: 14px; color: var(--fp-muted); }
@media (max-width: 600px) {
  .pet-home-guide { gap: 7px; }
  .guide-item { flex-basis: calc(50% - 7px); min-height: 58px; padding: 9px 12px; }
  .pet-guide-activity { flex-basis: 100%; }
  .guide-item:not(.pet-guide-activity) { gap: 7px; }
  .guide-item:not(.pet-guide-activity) > svg { display: none; }
  .guide-item:not(.pet-guide-activity) .guide-icon { width: 25px; height: 25px; }
}
@media (prefers-reduced-motion: reduce) { .guide-item { transition: none; } }
</style>
