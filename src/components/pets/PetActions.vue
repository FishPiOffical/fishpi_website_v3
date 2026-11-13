<script setup lang="ts">
import { computed } from 'vue'
import { usePetsStore } from '@/stores/pets'
import type { PetAction } from '@/api/v3-pets'
import PetIcon from './PetIcon.vue'
import { petDuration, usePetClock } from './usePetClock'
import { usePetCareAvailability } from './usePetCareAvailability'

const props = defineProps<{ compact?: boolean; active?: boolean }>()
const pets = usePetsStore()
const { now } = usePetClock()
usePetCareAvailability(() => props.active !== false)
const occupied = computed(() => !!pets.pet?.activity)
const resting = computed(() => pets.pet?.activity?.kind === 'rest')
const occupiedHint = computed(() => resting.value ? '休息时暂不能进行其他互动' : '当前活动结束并领取成果后，才能继续照顾')
const actions = computed<{ id: PetAction; label: string; hint: string; blocked: boolean }[]>(() => {
  const pet = pets.pet
  if (!pet) return []
  const until = pet.activity?.endsAt ?? 0
  // 满值展示会向上取整；服务端确认已到可互动时间后，即使显示 100 也允许照顾。
  const feedFull = pet.hunger >= 100 && !(pet.careAvailableAt && pet.careAvailableAt.feed <= (pets.state?.serverNow ?? 0))
  const waterFull = pet.water >= 100 && !(pet.careAvailableAt && pet.careAvailableAt.water <= (pets.state?.serverNow ?? 0))
  return [
    { id: 'feed', label: '喂食', hint: pets.foodQuantity ? `余 ${pets.foodQuantity} 份口粮` : '背包里没有口粮了', blocked: occupied.value || !pets.foodQuantity || feedFull },
    { id: 'water', label: '饮水', hint: waterFull ? '水分充足' : '补充水分', blocked: occupied.value || waterFull },
    { id: 'pet', label: '抚摸', hint: pet.cooldowns.pet > now.value ? `${petDuration(pet.cooldowns.pet - now.value)}后` : '陪伴一下', blocked: occupied.value || pet.cooldowns.pet > now.value },
    { id: 'play', label: '玩耍', hint: pet.cooldowns.play > now.value ? `${petDuration(pet.cooldowns.play - now.value)}后` : pet.energy < 10 ? '需要先休息' : '消耗 10 精力', blocked: occupied.value || pet.cooldowns.play > now.value || pet.energy < 10 },
    { id: resting.value ? 'wake' : 'rest', label: resting.value ? '唤醒' : '休息', hint: resting.value ? until > now.value ? `${petDuration(until - now.value)}后结束` : '结束休息' : '恢复精力', blocked: !resting.value && (occupied.value || pet.energy >= 100) },
  ]
})
function run(action: PetAction, blocked: boolean) {
  if (blocked || pets.loading || pets.busy || pets.pending || pets.refreshNeeded) return
  void pets.act(action, action === 'feed' ? 'food' : undefined)
}
</script>
<template>
  <div class="pet-actions" :class="{ compact }" aria-label="照顾宠物">
    <button v-for="action in actions" :key="action.id" type="button" :disabled="action.blocked || pets.loading || pets.busy || !!pets.pending || pets.refreshNeeded" :title="occupied && action.id !== 'wake' ? occupiedHint : action.hint" @click="run(action.id, action.blocked)">
      <PetIcon :name="action.id" /><span>{{ action.label }}</span><small v-if="!compact">{{ action.hint }}</small>
    </button>
  </div>
</template>
<style scoped>
.pet-actions { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.pet-actions button { display: flex; flex-direction: column; align-items: center; gap: 7px; min-width: 0; padding: 16px 4px 12px; border: 1px solid var(--fp-border); border-radius: 12px; color: var(--fp-text); background: var(--fp-card); font: inherit; cursor: pointer; transition: transform .16s, border-color .16s, background .16s; }
.pet-actions button > svg { width: 23px; height: 23px; color: var(--fp-primary); }
.pet-actions button > span { font-size: 14px; font-weight: 600; }
.pet-actions button > small { color: var(--fp-muted); font-size: 11px; line-height: 1.4; text-align: center; }
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
