<script setup lang="ts">
import { computed } from 'vue'
import { usePetsStore } from '@/stores/pets'
import type { PetAction } from '@/api/v3-pets'
import PetIcon from './PetIcon.vue'
import { petDuration, usePetClock } from './usePetClock'
import { usePetCareAvailability } from './usePetCareAvailability'

const props = defineProps<{ compact?: boolean; active?: boolean }>()
const pets = usePetsStore()
const quickFeedItemId = 'food'
const feedGain = computed(() => pets.catalog?.items.find(item => item.id === quickFeedItemId)?.effects.hunger)
const { now } = usePetClock()
usePetCareAvailability(() => props.active !== false)
const occupied = computed(() => !!pets.pet?.activity)
const resting = computed(() => pets.pet?.activity?.kind === 'rest')
const occupiedHint = computed(() => resting.value ? '休息时暂不能进行其他互动' : '当前活动结束并领取成果后，才能继续照顾')
const actions = computed<{ id: PetAction; label: string; hint: string; gain?: string; cost?: string; blocked: boolean }[]>(() => {
  const pet = pets.pet
  if (!pet) return []
  const rules = pets.catalog?.rules
  const playCost = rules?.playEnergy
  const playLowEnergy = pet.energy < (playCost ?? 10)
  const until = pet.activity?.endsAt ?? 0
  // 满值展示会向上取整；服务端确认已到可互动时间后，即使显示 100 也允许照顾。
  const feedFull = pet.hunger >= 100 && !(pet.careAvailableAt && pet.careAvailableAt.feed <= (pets.state?.serverNow ?? 0))
  const waterFull = pet.water >= 100 && !(pet.careAvailableAt && pet.careAvailableAt.water <= (pets.state?.serverNow ?? 0))
  return [
    { id: 'feed', label: '喂食', gain: gain('饱食', feedGain.value), hint: pets.foodQuantity ? `余 ${pets.foodQuantity} 份口粮` : '背包里没有口粮了', blocked: occupied.value || !pets.foodQuantity || feedFull },
    { id: 'water', label: '饮水', gain: gain('水分', rules?.waterGain), hint: waterFull ? '水分充足' : rules?.waterGain === undefined ? '补充水分' : '', blocked: occupied.value || waterFull },
    { id: 'pet', label: '抚摸', gain: gain('心情', rules?.petMood), hint: pet.cooldowns.pet > now.value ? `${petDuration(pet.cooldowns.pet - now.value)}后` : rules?.petMood === undefined ? '陪伴一下' : '', blocked: occupied.value || pet.cooldowns.pet > now.value },
    { id: 'play', label: '玩耍', gain: gain('心情', rules?.playMood), cost: playCost === undefined ? undefined : `精力 −${playCost}`, hint: pet.cooldowns.play > now.value ? `${petDuration(pet.cooldowns.play - now.value)}后` : playLowEnergy ? '需要先休息' : playCost === undefined ? '消耗 10 精力' : '', blocked: occupied.value || pet.cooldowns.play > now.value || playLowEnergy },
    resting.value
      ? { id: 'wake', label: '唤醒', hint: until > now.value ? `${petDuration(until - now.value)}后结束` : '结束休息', blocked: false }
      : { id: 'rest', label: '休息', gain: gain('每小时精力', rules?.restEnergyPerHour), hint: pet.energy >= 100 ? '精力充足' : rules?.restEnergyPerHour === undefined ? '恢复精力' : '', blocked: occupied.value || pet.energy >= 100 },
  ]
})
function gain(label: string, value?: number) {
  return value === undefined ? undefined : `${label} +${value}`
}
function run(action: PetAction, blocked: boolean) {
  if (blocked || pets.loading || pets.busy || pets.pending || pets.refreshNeeded) return
  void pets.act(action, action === 'feed' ? quickFeedItemId : undefined)
}
</script>
<template>
  <div class="pet-actions" :class="{ compact }" aria-label="照顾宠物">
    <button v-for="action in actions" :key="action.id" type="button" :disabled="action.blocked || pets.loading || pets.busy || !!pets.pending || pets.refreshNeeded" :title="occupied && action.id !== 'wake' ? occupiedHint : action.hint || undefined" @click="run(action.id, action.blocked)">
      <PetIcon :name="action.id" /><span>{{ action.label }}</span>
      <small v-if="action.gain || action.cost || (!compact && action.hint)">
        <span v-if="action.gain" class="action-gain">{{ action.gain }}</span>
        <span v-if="action.cost" class="action-cost">{{ action.cost }}</span>
        <span v-if="!compact && action.hint">{{ action.hint }}</span>
      </small>
    </button>
  </div>
</template>
<style scoped>
.pet-actions { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.pet-actions button { display: flex; flex-direction: column; align-items: center; gap: 7px; min-width: 0; padding: 16px 4px 12px; border: 1px solid var(--fp-border); border-radius: 12px; color: var(--fp-text); background: var(--fp-card); font: inherit; cursor: pointer; transition: transform .16s, border-color .16s, background .16s; }
.pet-actions button > svg { width: 23px; height: 23px; color: var(--fp-primary); }
.pet-actions button > span { font-size: 14px; font-weight: 600; }
.pet-actions button > small { color: var(--fp-muted); font-size: 11px; line-height: 1.4; text-align: center; }
.action-gain, .action-cost { display: block; font-variant-numeric: tabular-nums; }
.action-gain { color: var(--fp-primary-ink, var(--fp-primary)); }
.pet-actions button:not(:disabled):hover { transform: translateY(-2px); background: var(--fp-primary-soft); border-color: color-mix(in srgb, var(--fp-primary) 40%, var(--fp-border)); }
.pet-actions button:active { transform: translateY(0); }
.pet-actions button:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 2px; }
.pet-actions button:disabled { opacity: .48; cursor: default; }
.pet-actions.compact { gap: 4px; }
.pet-actions.compact button { padding: 10px 2px; gap: 6px; border-color: transparent; border-radius: 8px; }
.pet-actions.compact button > span { font-size: 12px; }
.pet-actions.compact button > svg { width: 18px; height: 18px; }
@media (max-width: 480px) { .pet-actions { gap: 5px; } .pet-actions button { padding: 12px 3px; } .pet-actions button > small { font-size: 10px; } }
@media (prefers-reduced-motion: reduce) { .pet-actions button { transition: none; } }
</style>
