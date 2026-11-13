<script setup lang="ts">
import { computed } from 'vue'
import { usePetsStore } from '@/stores/pets'
import type { PetStory } from '@/api/v3-pets'
import PetIcon from './PetIcon.vue'

const pets = usePetsStore()
const locked = computed(() => pets.loading || pets.busy || !!pets.pending || pets.refreshNeeded)
const progress = (id: string) => pets.state?.stories.find(item => item.id === id)
const rewardText = (story: PetStory) => story.rewards.items.map(item => `${pets.catalog?.items.find(value => value.id === item.itemId)?.name || item.itemId} ×${item.quantity}`).join(' · ')
const completed = computed(() => pets.state?.stories.filter(item => item.status !== 'active').length ?? 0)
function claim(story: PetStory) {
  if (locked.value || pets.pet?.activity || progress(story.id)?.status !== 'claimable') return
  void pets.claimStory(story.id)
}
</script>

<template>
  <section v-if="pets.catalog && pets.state && pets.pet" class="pet-stories" aria-labelledby="pet-stories-title">
    <header class="stories-heading"><div><h2 id="pet-stories-title"><PetIcon name="journey" />成长旅程</h2><p>照顾、探索与学习，慢慢完成属于你们的小故事。</p></div><span>{{ completed }} / {{ pets.catalog.stories.length }} 段已完成</span></header>
    <div class="stories-grid">
      <article v-for="story in pets.catalog.stories" :key="story.id" class="story-card" :class="{ claimed: progress(story.id)?.status === 'claimed' }">
        <header><h3>{{ story.name }}</h3><span v-if="progress(story.id)">{{ progress(story.id)!.completedSteps }} / {{ story.steps.length }}</span></header>
        <p class="story-description">{{ story.description }}</p>
        <ol class="story-steps"><li v-for="(step, index) in story.steps" :key="step.id" :class="{ complete: index < (progress(story.id)?.completedSteps ?? 0), current: progress(story.id)?.status === 'active' && index === progress(story.id)?.completedSteps }"><span class="step-indicator" aria-hidden="true"><PetIcon v-if="index < (progress(story.id)?.completedSteps ?? 0)" name="check" /><template v-else>{{ index + 1 }}</template></span><span>{{ step.description }}<span v-if="index < (progress(story.id)?.completedSteps ?? 0)" class="sr-only">，已完成</span><span v-else-if="progress(story.id)?.status === 'active' && index === progress(story.id)?.completedSteps" class="sr-only">，当前目标</span></span></li></ol>
        <footer><p><PetIcon name="gift" />{{ rewardText(story) }}</p><button v-if="progress(story.id)?.status === 'claimable'" type="button" :disabled="locked || !!pets.pet.activity" :title="pets.pet.activity ? '当前活动结束后再领取' : '领取这段旅程的奖励'" :aria-label="`领取${story.name}奖励`" @click="claim(story)">领取奖励</button><span v-else class="story-status"><PetIcon v-if="progress(story.id)?.status === 'claimed'" name="check" />{{ !progress(story.id) ? '进度暂不可用' : progress(story.id)?.status === 'claimed' ? '奖励已领取' : '按顺序完成目标' }}</span></footer>
      </article>
    </div>
  </section>
</template>

<style scoped>
.pet-stories { margin-top: 20px; padding: 24px; border: 1px solid var(--fp-border); border-radius: var(--fp-panel-radius, 14px); background: var(--fp-card); color: var(--fp-text); }
.stories-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }.stories-heading h2 { display: flex; align-items: center; gap: 9px; font-size: 19px; color: var(--fp-title); margin: 0; }.stories-heading h2 svg { color: var(--fp-primary); }.stories-heading p { color: var(--fp-muted); font-size: 13px; line-height: 1.7; margin: 8px 0 0; }.stories-heading > span { font-size: 12px; color: var(--fp-muted); }
.stories-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }.story-card { min-width: 0; display: flex; flex-direction: column; padding: 18px; border: 1px solid var(--fp-border); border-radius: 11px; }.story-card > header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }.story-card h3 { margin: 0; font-size: 15px; color: var(--fp-title); }.story-card header > span { color: var(--fp-muted); font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }.story-description { color: var(--fp-muted); font-size: 12px; line-height: 1.7; margin: 10px 0 18px; }.story-steps { list-style: none; margin: 0 0 20px; padding: 0; display: flex; flex-direction: column; gap: 14px; }.story-steps li { display: flex; align-items: flex-start; gap: 9px; color: var(--fp-muted); font-size: 12px; line-height: 1.6; }.story-steps .current { color: var(--fp-title); }.step-indicator { display: inline-grid; place-items: center; width: 20px; height: 20px; flex: none; border: 1px solid var(--fp-border); border-radius: 6px; font-size: 10px; font-variant-numeric: tabular-nums; }.step-indicator svg { width: 13px; height: 13px; }.complete .step-indicator { background: var(--fp-primary-soft); color: var(--fp-primary); border-color: transparent; }.current .step-indicator { border-color: var(--fp-primary); color: var(--fp-primary); }
.story-card footer { margin-top: auto; border-top: 1px solid var(--fp-border); padding-top: 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }.story-card footer > p { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 11px; color: var(--fp-muted); line-height: 1.7; }.story-card footer > p svg { width: 15px; height: 15px; color: var(--fp-accent); }.story-card button { min-height: 40px; padding: 8px 13px; border: 1px solid color-mix(in srgb, var(--fp-primary) 20%, var(--fp-border)); border-radius: 8px; color: var(--fp-primary); background: var(--fp-primary-soft); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }.story-status { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--fp-muted); }.claimed .story-status { color: var(--fp-primary); }.story-status svg { width: 14px; height: 14px; }button:disabled { opacity: .5; cursor: default; }button:not(:disabled):hover { filter: brightness(.97); }button:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
@media (max-width: 950px) { .stories-grid { grid-template-columns: 1fr; }.story-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; } }
@media (max-width: 600px) { .pet-stories { padding: 20px; }.stories-heading h2 { font-size: 18px; }.story-steps { display: flex; }.story-card button { min-height: 44px; } }
@media (max-width: 390px) { .pet-stories { padding: 16px; }.story-card { padding: 16px; } }
</style>
