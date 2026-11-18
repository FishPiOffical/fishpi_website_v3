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
  <header class="board-header"><RouterLink to="/parking">抢车位</RouterLink><h1>停车周榜</h1><p>按本周实际到账游园币排名，每周一北京时间零点重新统计，展示前 50 名。</p></header>
  <p v-if="error" role="alert">{{ error }} <button @click="load">重试</button></p>
  <ol v-else-if="result?.rows.length"><li v-for="row in result.rows" :key="row.userName">
    <RouterLink :to="'/member/' + encodeURIComponent(row.userName)">{{ row.name }}</RouterLink><strong>{{ row.income.toLocaleString() }} 游园币</strong>
  </li></ol>
  <p v-else role="status">{{ result ? '本周还没有停车收益到账。' : '正在读取周榜…' }}</p>
</template>
<style scoped>
header,ol,p { margin:0; padding:16px; }
h1 { margin:8px 0; }
header p { padding:0; color:var(--fp-muted); }
ol { list-style-position:inside; }
li { padding:10px 0; border-top:1px solid var(--fp-border); }
strong { float:right; font-variant-numeric:tabular-nums; }
</style>
