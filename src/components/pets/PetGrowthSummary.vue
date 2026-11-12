<script setup lang="ts">
import { computed } from 'vue'
import { usePetsStore } from '@/stores/pets'

const pets = usePetsStore()
const progress = computed(() => {
  const pet = pets.pet, rules = pets.catalog?.growthRules
  if (!pet || !rules) return null
  const complete = pet.level >= rules.maxLevel
  const start = (pet.level - 1) * rules.experiencePerLevel
  // 以服务端规则和当前等级计算展示进度，不在客户端修改成长状态。
  const earned = Math.max(0, Math.min(rules.experiencePerLevel, pet.experience - start))
  return {
    complete,
    percent: complete ? 100 : Math.round(earned / rules.experiencePerLevel * 100),
    remaining: Math.max(0, rules.experiencePerLevel - earned),
  }
})
</script>

<template>
  <div v-if="pets.pet" class="growth-summary">
    <div class="growth-values"><span>累计经验 <strong>{{ pets.pet.experience }}</strong></span><span>亲密度 <strong>{{ pets.pet.friendship }}</strong></span></div>
    <template v-if="progress">
      <div class="growth-track" role="progressbar" aria-label="宠物升级进度" :aria-valuenow="progress.percent" :aria-valuemin="0" :aria-valuemax="100"><span :style="{ width: `${progress.percent}%` }" /></div>
      <p>{{ progress.complete ? '已达到当前最高等级，仍可积累本领与亲密度' : `再获得 ${progress.remaining} 经验，升到 Lv. ${pets.pet.level + 1}` }}</p>
    </template>
  </div>
</template>

<style scoped>
.growth-summary { max-width: 300px; margin-inline: auto; color: var(--fp-muted); font-size: 12px; }
.growth-values { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 24px; }
.growth-values strong { margin-left: 4px; color: var(--fp-text); font-size: 14px; font-variant-numeric: tabular-nums; }
.growth-track { height: 4px; margin-top: 14px; overflow: hidden; border-radius: 4px; background: var(--fp-hover); }
.growth-track span { display: block; height: 100%; border-radius: inherit; background: var(--fp-primary); transition: width .2s; }
.growth-summary p { margin: 8px 0 0; font-size: 11px; line-height: 1.6; }
@media (prefers-reduced-motion: reduce) { .growth-track span { transition: none; } }
</style>
