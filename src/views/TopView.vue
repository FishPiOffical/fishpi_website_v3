<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  fetchBalanceRank,
  fetchCheckinRank,
  fetchConsumptionRank,
  fetchOnlineRank,
  fetchProfessionRanking,
  type ProfessionRankEntry,
  type RankUser,
} from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeRanksPayload } from '@/seo/payload'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()
const { apiKey, isLoggedIn } = storeToRefs(auth)

const checkin = ref<RankUser[]>([])
const online = ref<RankUser[]>([])
const balance = ref<RankUser[]>([])
const consumption = ref<RankUser[]>([])
const jobs = ref<{ professionId?: string; displayName?: string; professionName?: string }[]>([])
const jobId = ref('')
const jobEntries = ref<ProfessionRankEntry[]>([])
const jobError = ref('')
const error = ref('')
const loading = ref(false)
const wealthHint = ref('')

const pageTitle = computed(() => {
  if (route.path === '/top/balance') return '财富榜'
  if (route.path === '/top/consumption') return '消费榜'
  if (route.path === '/top/checkin') return '连签榜'
  if (route.path === '/top/online') return '在线榜'
  return '总榜'
})

usePageSeo(() => ({
  title: pageTitle.value,
  path: route.path,
  description: '摸鱼派签到、在线、财富与消费榜',
}))

const usingMock = computed(
  () => checkin.value.some((u) => ['csfwff', 'Yui'].includes(u.userName) && checkin.value.length <= 8),
)

function pointOf(u: RankUser) {
  return Number(u.userPoint ?? u.point ?? 0)
}

function usedOf(u: RankUser) {
  return Number(u.userUsedPoint ?? u.point ?? u.userPoint ?? 0)
}

async function load() {
  error.value = ''
  wealthHint.value = ''
  loading.value = true
  try {
    const cached = consumeRanksPayload()
    if (cached) {
      checkin.value = cached.checkin
      online.value = cached.online
    } else {
      ;[checkin.value, online.value] = await Promise.all([
        fetchCheckinRank(apiKey.value),
        fetchOnlineRank(apiKey.value),
      ])
    }
    ;[balance.value, consumption.value] = await Promise.all([
      fetchBalanceRank(apiKey.value),
      fetchConsumptionRank(apiKey.value),
    ])
    if (!balance.value.length && !consumption.value.length && !apiKey.value) {
      wealthHint.value = '财富榜与消费榜需登录后查看（GET /api/top/balance|consumption）。'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '排行榜加载失败'
  } finally {
    loading.value = false
  }
  if (!import.meta.env.SSR) await loadJobs()
}

async function loadJobs() {
  jobError.value = ''
  try {
    const data = await fetchProfessionRanking(apiKey.value, jobId.value || undefined)
    jobs.value = data.professions || []
    jobEntries.value = data.entries || []
    const selected = data.selectedProfession?.professionId
    if (!jobId.value && selected) jobId.value = selected
  } catch (e) {
    jobError.value = e instanceof Error ? e.message : '职业榜加载失败'
    jobEntries.value = []
  }
}

watch(apiKey, () => void load(), { immediate: true })
</script>

<template>
  <div class="board">
    <nav class="tabs-top">
      <RouterLink to="/top/checkin" :class="{ on: route.path === '/top/checkin' || route.path === '/top' }">连签</RouterLink>
      <RouterLink to="/top/online" :class="{ on: route.path === '/top/online' }">在线</RouterLink>
      <RouterLink to="/top/balance" :class="{ on: route.path === '/top/balance' }">财富</RouterLink>
      <RouterLink to="/top/consumption" :class="{ on: route.path === '/top/consumption' }">消费</RouterLink>
    </nav>
    <p v-if="loading" class="banner">加载中…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <p v-else-if="usingMock && !apiKey" class="banner">
      匿名榜单接口尚未开放，当前为与 <code>/api/top/checkin|online</code> 对齐的 mock。
    </p>
    <p v-if="wealthHint" class="banner">
      {{ wealthHint }}
      <RouterLink v-if="!isLoggedIn" :to="{ path: '/login', query: { redirect: route.fullPath } }">去登录</RouterLink>
    </p>

    <section id="checkin" class="card">
      <h1>今日连签排行</h1>
      <ol>
        <li v-for="(u, i) in checkin" :key="'c-' + u.userName">
          <i>{{ i + 1 }}</i>
          <RouterLink :to="`/member/${u.userName}`">{{ u.userName }}</RouterLink>
          <em>{{ u.userCurrentCheckinStreak ?? u.userCheckinStreak }}</em>
        </li>
      </ol>
    </section>
    <section id="online" class="card">
      <h1>在线时间排行</h1>
      <ol>
        <li v-for="(u, i) in online" :key="'o-' + u.userName">
          <i>{{ i + 1 }}</i>
          <RouterLink :to="`/member/${u.userName}`">{{ u.userName }}</RouterLink>
          <em>{{ Number(u.onlineMinute || 0).toLocaleString() }} 分钟</em>
        </li>
      </ol>
    </section>
    <section id="balance" class="card">
      <h1>财富排行</h1>
      <ol>
        <li v-for="(u, i) in balance" :key="'b-' + u.userName">
          <i>{{ i + 1 }}</i>
          <RouterLink :to="`/member/${u.userName}`">{{ u.userName }}</RouterLink>
          <em>{{ pointOf(u).toLocaleString() }}</em>
        </li>
      </ol>
      <p v-if="!balance.length && !loading" class="hint">暂无数据</p>
    </section>
    <section id="consumption" class="card">
      <h1>消费排行</h1>
      <ol>
        <li v-for="(u, i) in consumption" :key="'u-' + u.userName">
          <i>{{ i + 1 }}</i>
          <RouterLink :to="`/member/${u.userName}`">{{ u.userName }}</RouterLink>
          <em>{{ usedOf(u).toLocaleString() }}</em>
        </li>
      </ol>
      <p v-if="!consumption.length && !loading" class="hint">暂无数据</p>
    </section>
    <section class="card jobs">
      <h1>职业成长榜</h1>
      <p v-if="jobError" class="err">{{ jobError }}</p>
      <div v-if="jobs.length" class="tabs">
        <button
          v-for="job in jobs"
          :key="job.professionId || job.displayName"
          type="button"
          :class="{ on: jobId === job.professionId }"
          @click="jobId = job.professionId || ''; void loadJobs()"
        >
          {{ job.displayName || job.professionName }}
        </button>
      </div>
      <ol>
        <li v-for="(u, i) in jobEntries" :key="(u.userName || '') + i">
          <i>{{ u.rank || i + 1 }}</i>
          <RouterLink v-if="u.userName" :to="`/member/${u.userName}`">{{ u.userNickname || u.userName }}</RouterLink>
          <span v-else>—</span>
          <em>{{ u.levelName }} {{ u.totalExperience != null ? u.totalExperience : '' }}</em>
        </li>
      </ol>
      <p v-if="!jobError && !jobEntries.length" class="hint">暂无职业榜数据。</p>
    </section>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.tabs-top {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tabs-top a {
  color: var(--fp-muted);
  text-decoration: none;
  border: 1px solid var(--fp-border);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 13px;
}
.tabs-top a.on {
  color: #fff;
  background: var(--fp-primary);
  border-color: transparent;
}
.jobs {
  grid-column: 1 / -1;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.tabs button {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-text);
  border-radius: 999px;
  padding: 4px 10px;
  cursor: pointer;
}
.tabs button.on {
  background: var(--fp-primary);
  color: #fff;
  border-color: transparent;
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.banner {
  grid-column: 1 / -1;
  color: var(--fp-muted);
  font-size: 13px;
}
.banner a {
  margin-left: 6px;
  color: var(--fp-link);
}
.card {
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  border-radius: 10px;
  padding: 15px;
}
h1 {
  margin: 0 0 12px;
  font-size: 16px;
}
ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
li {
  display: flex;
  gap: 8px;
  padding: 6px 0;
  font-size: 14px;
}
li a {
  flex: 1;
  color: inherit;
  text-decoration: none;
}
i,
em {
  font-style: normal;
  color: var(--fp-muted);
}
i {
  width: 20px;
}
@media (max-width: 800px) {
  .board {
    grid-template-columns: 1fr;
  }
}
.err {
  grid-column: 1 / -1;
  color: #e07a5f;
}
</style>
