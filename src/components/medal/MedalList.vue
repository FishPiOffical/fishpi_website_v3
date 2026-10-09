<script setup lang="ts">
import { computed } from 'vue'
import { normalizeMetals } from '@/api/fishpi'
import MedalIcon from './MedalIcon.vue'

const props = withDefaults(
  defineProps<{
    /** 接口里的 sysMetal：数组或 `{"list":[...]}` JSON 字符串 */
    items?: unknown
    /** chat：聊天室规则，Premium Sponsor 用完整图，其余用小图 */
    variant?: 'full' | 'mini' | 'chat'
  }>(),
  { items: undefined, variant: 'full' },
)

const medals = computed(() => normalizeMetals(props.items))

function isMini(name?: string) {
  if (props.variant === 'mini') return true
  if (props.variant === 'chat') return name !== 'Premium Sponsor'
  return false
}
</script>

<template>
  <span v-if="medals.length" class="medal-list">
    <MedalIcon v-for="(m, i) in medals" :key="(m.id || m.name || '') + i" :medal="m" :mini="isMini(m.name)" />
  </span>
</template>

<style scoped>
.medal-list {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  vertical-align: middle;
}
</style>
