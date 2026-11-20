<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { fetchV3MemberPoints, pointChange, pointTime, type PointChange, type PointPage } from '@/api/v3-points'
import MemberRecordsTable from '@/components/member/MemberRecordsTable.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { useAuthStore } from '@/stores/auth'

const route = useRoute(), auth = useAuthStore()
const name = computed(() => String(route.params.userName ?? ''))
const own = computed(() => auth.account?.userName?.toLowerCase() === name.value.toLowerCase() && auth.isLoggedIn)
const result = ref<PointPage<PointChange> | null>(null)
const page = ref(1)
const state = ref<'loading' | 'ready' | 'private' | 'missing' | 'error'>('loading')
const viewer = () => `${getAuthContextVersion()}:${auth.account?.oId ?? ''}:${!!auth.accessToken}`
let mounted = false
let pending: AbortController | undefined
usePageSeo(() => ({ title: `${name.value} 的积分记录`, path: route.path, robots: 'noindex' }))

async function load(targetPage = page.value) {
  if (!mounted) return
  pending?.abort()
  const controller = new AbortController()
  pending = controller
  const target = name.value, identity = viewer()
  const current = () => !controller.signal.aborted && target === name.value && identity === viewer()
  state.value = 'loading'
  result.value = null
  page.value = targetPage
  try {
    const response = await fetchV3MemberPoints(target, targetPage, controller.signal)
    if (!current()) return
    result.value = response
    state.value = 'ready'
  } catch (cause) {
    if (!current()) return
    if (cause instanceof ApiError && cause.status === 403 && cause.code === 'point_history_private') state.value = 'private'
    else if (cause instanceof ApiError && cause.status === 404 && cause.code === 'not_found') state.value = 'missing'
    else state.value = 'error'
  }
}
watch([name, () => auth.accessToken, () => auth.account?.oId], () => {
  if (!mounted) return
  void load(1)
}, { flush: 'sync' })
onMounted(() => { mounted = true; void load(1) })
onScopeDispose(() => { mounted = false; pending?.abort() })
</script>

<template>
  <section class="fp-surface">
    <header class="records-header">
      <h1>积分记录</h1>
      <RouterLink v-if="own" to="/points">查看我的积分明细</RouterLink>
    </header>
    <p v-if="state === 'loading'" class="fp-state" role="status">正在读取积分记录…</p>
    <p v-else-if="state === 'private'" class="fp-state">积分记录未公开</p>
    <p v-else-if="state === 'missing'" class="fp-state">该用户不存在或不可访问。</p>
    <div v-else-if="state === 'error'" class="fp-state" role="alert">
      积分记录暂不可用 <button class="fp-control" type="button" @click="load()">重试</button>
    </div>
    <template v-else-if="result">
      <MemberRecordsTable v-if="result.list.length" heading="积分记录" :columns="['时间', '类型', '积分变动', '余额']">
        <tr v-for="(item, index) in result.list" :key="index">
          <td><time :datetime="new Date(item.time).toISOString()">{{ pointTime(item.time) }}</time></td>
          <td>{{ item.displayType || '积分变动' }}</td>
          <td :class="{ income: Number(pointChange(item)) > 0 }">{{ pointChange(item) }}</td>
          <td>{{ item.balance.toLocaleString() }}</td>
        </tr>
      </MemberRecordsTable>
      <p v-else class="fp-state">本页暂无积分记录。</p>
      <nav v-if="page > 1 || result.pageCount > 1" class="fp-pagination" aria-label="积分记录分页">
        <button class="fp-control" type="button" :disabled="page <= 1" @click="load(page - 1)">上一页</button>
        <span>第 {{ page }} 页</span>
        <button class="fp-control" type="button" :disabled="page >= result.pageCount" @click="load(page + 1)">下一页</button>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.records-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; margin-block-end: 12px; }
h1 { margin: 0; font-size: 20px; }
.records-header a { font-size: 13px; }
.income { color: var(--fp-primary); font-weight: 650; }
</style>
