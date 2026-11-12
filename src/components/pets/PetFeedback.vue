<script setup lang="ts">
import { usePetsStore } from '@/stores/pets'
import PetIcon from './PetIcon.vue'
const pets = usePetsStore()
function friendly(value: string, fallback: string) {
  return /JSON|HTTP|SQL|fetch|network|token|stack|接口|数据格式/i.test(value) ? fallback : value || fallback
}
</script>
<template>
  <div v-if="pets.pending && !pets.busy" class="pet-feedback pending" role="status">
    <span>{{ pets.offline ? '网络已断开。上次操作仍待确认，联网后请核对原操作。' : friendly(pets.pendingError, '上次操作的结果尚未确认，请先核对。') }}</span>
    <button type="button" :disabled="pets.busy || pets.offline" aria-label="核对上次宠物操作" title="核对上次操作" @click="pets.retryPending()"><PetIcon name="refresh" /></button>
  </div>
  <div v-else-if="pets.refreshNeeded && !pets.busy && !pets.loading" class="pet-feedback pending" role="status">
    <span>{{ friendly(pets.error, '宠物状态暂未更新，请重新读取。') }}</span>
    <button type="button" :disabled="pets.loading || pets.offline" aria-label="刷新宠物状态" title="刷新状态" @click="pets.refresh()"><PetIcon name="refresh" /></button>
  </div>
  <div v-else-if="pets.error" class="pet-feedback" role="alert">
    <span>{{ friendly(pets.error, '暂时无法读取宠物状态，请稍后重试。') }}</span>
    <button type="button" :disabled="pets.loading || pets.offline" aria-label="重新读取宠物状态" title="重新读取" @click="pets.refresh()"><PetIcon name="refresh" /></button>
  </div>
</template>
<style scoped>
.pet-feedback { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: color-mix(in srgb, #d55850 7%, var(--fp-card)); border-radius: 8px; color: var(--fp-danger, #bb4038); font-size: 13px; line-height: 1.5; }
.pet-feedback.pending { color: var(--fp-text); background: var(--fp-primary-soft); }
.pet-feedback span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.pet-feedback button { display: grid; place-items: center; width: 32px; height: 32px; flex: none; padding: 0; border: 1px solid var(--fp-border); border-radius: 8px; background: var(--fp-card); color: inherit; cursor: pointer; }
.pet-feedback button:disabled { opacity: .5; cursor: wait; }
.pet-feedback button:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 2px; }
</style>
