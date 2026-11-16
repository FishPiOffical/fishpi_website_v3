<script setup lang="ts">
import { nextTick, ref } from 'vue'
import PetIcon from './PetIcon.vue'
import type { PetHomeSection } from './petNavigation'

const props = defineProps<{ selected: PetHomeSection; rewards: number }>()
const emit = defineEmits<{ select: [section: PetHomeSection] }>()
const element = ref<HTMLElement | null>(null)
const sections = [
  { id: 'care', label: '日常照顾', icon: 'home' },
  { id: 'activities', label: '外出与学习', icon: 'outing' },
  { id: 'stories', label: '成长旅程', icon: 'journey' },
  { id: 'shop', label: '家园小铺', icon: 'shop' },
  { id: 'workshop', label: '手作与收藏', icon: 'craft' },
  { id: 'history', label: '活动记录', icon: 'history' },
] as const

async function move(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const index = sections.findIndex(section => section.id === props.selected)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : sections.length - 1)) % sections.length
  const section = sections[next]!
  emit('select', section.id)
  await nextTick()
  if (props.selected !== section.id) return
  element.value?.querySelector<HTMLButtonElement>(`[data-pet-section="${section.id}"]`)?.focus()
}
</script>

<template>
  <nav ref="element" class="pet-home-navigation" aria-label="宠物家园分区">
    <div class="pet-home-tabs fp-tabs" role="tablist" aria-label="家园功能" @keydown="move">
      <button v-for="section in sections" :id="`pet-home-tab-${section.id}`" :key="section.id"
        type="button" role="tab" class="fp-tab" :data-pet-section="section.id" :aria-selected="selected === section.id"
        :aria-controls="`pet-home-panel-${section.id}`" :tabindex="selected === section.id ? 0 : -1"
        @click="emit('select', section.id)">
        <PetIcon :name="section.icon" /><span>{{ section.label }}</span>
        <span v-if="section.id === 'stories' && rewards" class="reward-count" :aria-label="`${rewards} 项奖励待领取`">{{ rewards }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.pet-home-navigation { margin-bottom: 16px; padding: 5px; border: 1px solid var(--fp-border); border-radius: 12px; background: var(--fp-card); }
.pet-home-tabs .fp-tab { flex: 1 0 auto; min-height: 44px; }
svg { width: 17px; height: 17px; }
.reward-count { min-width: 17px; padding: 1px 4px; border-radius: 5px; background: var(--fp-accent-soft); color: var(--fp-text); font-size: 10px; font-variant-numeric: tabular-nums; }
</style>
