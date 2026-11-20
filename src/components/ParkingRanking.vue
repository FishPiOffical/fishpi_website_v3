<script setup lang="ts">
import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { readParkingWeekly } from '@/api/v3-parking'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'

const auth = useAuthStore(), mounted = ref(false)
const result = ref<Awaited<ReturnType<typeof readParkingWeekly>> | null>(null), error = ref('')
let revision = 0
async function load() {
  const seq = ++revision
  result.value = null; error.value = ''
  if (!mounted.value || !auth.isLoggedIn) return
  try {
    const board = await readParkingWeekly()
    if (seq === revision) result.value = board
  } catch (cause) {
    if (seq === revision) error.value = cause instanceof Error ? cause.message : '周榜读取失败'
  }
}
watch([mounted, () => auth.account?.oId, () => auth.isLoggedIn, getAuthContextVersion], load, { flush: 'sync' })
onMounted(() => { mounted.value = true })
onScopeDispose(() => { revision++ })
</script>
<template>
  <header class="board-header">
    <RouterLink to="/parking">抢车位</RouterLink><span aria-hidden="true"> / </span><span>周榜</span>
    <h1 class="fp-page-title">停车周榜</h1>
    <p>按本周实际到账的游园币排序，展示前 50 名。每周一北京时间零点重新统计。</p>
  </header>
  <p v-if="error" role="alert">{{ error }} <button @click="load">重试</button></p>
  <ol v-else-if="result?.rows.length" class="parking-ranks">
    <li v-for="(row, index) in result.rows" :key="row.userName">
      <span class="position" aria-hidden="true">{{ index + 1 }}</span>
      <RouterLink :to="'/member/' + encodeURIComponent(row.userName)">{{ row.name }}</RouterLink>
      <strong>{{ row.income.toLocaleString() }} <small>游园币</small></strong>
    </li>
  </ol>
  <p v-else role="status">{{ result ? '本周还没有停车收益到账。' : '正在读取周榜…' }}</p>
</template>
<style scoped>
.board-header { border-bottom: 1px solid var(--fp-border); padding-bottom: 16px; color: var(--fp-muted); font-size: 13px; }
.board-header h1 { margin-block: 6px; }
.board-header p { margin: 0; }
.parking-ranks { margin: 0; padding: 0; list-style: none; }
.parking-ranks li { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 12px 0; }
.parking-ranks li + li { border-top: 1px solid var(--fp-border); }
.position { display: grid; place-items: center; min-height: 27px; border-radius: 6px; font-weight: 650; color: var(--fp-muted); background: var(--fp-elevated); }
li:nth-child(-n+3) .position { color: var(--fp-primary-ink, var(--fp-primary)); background: var(--fp-primary-soft); }
.parking-ranks a { width: fit-content; max-width: 100%; color: var(--fp-text); overflow-wrap: anywhere; }
.parking-ranks strong { font-variant-numeric: tabular-nums; }
.parking-ranks small { color: var(--fp-muted); font-weight: 400; }
</style>
