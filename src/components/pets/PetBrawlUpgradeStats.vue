<script setup lang="ts">
import { computed } from 'vue'
import { formatBattleStat, type BrawlStats } from './brawlStats'

const props = defineProps<{ growth: BrawlStats[]; toLevel: number }>()
const percent = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 2 })
const rows = computed(() => {
  const base = props.growth[0]
  const before = props.growth[props.toLevel - 1]
  const after = props.growth[props.toLevel]
  if (!base || !before || !after) return []
  return (['maxHp', 'attack'] as const).map(key => ({
    name: key === 'maxHp' ? '生命' : '基础伤害',
    ratio: percent.format((after[key] - base[key]) / base[key]),
    value: after[key], gain: after[key] - before[key], total: after[key] - base[key],
  }))
})
</script>

<template>
  <table v-if="rows.length" class="upgrade-stats">
    <caption>武器强化 +{{ toLevel - 1 }} → +{{ toLevel }}</caption>
    <thead><tr><th scope="col">属性</th><th scope="col">强化后</th><th scope="col">本级提升</th><th scope="col">较 +0 累计</th></tr></thead>
    <tbody><tr v-for="row in rows" :key="row.name">
      <th scope="row">{{ row.name }}</th><td>{{ formatBattleStat(row.value) }}</td>
      <td>+{{ formatBattleStat(row.gain) }}</td><td>+{{ formatBattleStat(row.total) }} <small>({{ row.ratio }})</small></td>
    </tr></tbody>
  </table>
</template>

<style scoped>
.upgrade-stats { width: 100%; border-collapse: collapse; font-size: .8rem; font-variant-numeric: tabular-nums; }
caption { padding-bottom: 8px; color: var(--fp-title); text-align: start; font-weight: 600; }
th, td { padding: 5px 0; text-align: end; }
th { color: var(--fp-muted); font-weight: 500; }
th:first-child { text-align: start; }
thead { border-bottom: 1px solid var(--fp-border); }
td { color: var(--fp-title); }
small { display: inline-block; color: var(--fp-muted); font-weight: 400; }
td:last-child { color: var(--fp-primary-ink, var(--fp-primary)); font-weight: 600; }
</style>
