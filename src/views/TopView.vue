<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  fetchCheckinRank,
  fetchOnlineRank,
  fetchProfessionRanking,
  type ProfessionRankEntry,
  type RankUser,
} from '@/api/fishpi'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeRanksPayload } from '@/seo/payload'
import { useAuthStore } from '@/stores/auth'

usePageSeo(() => ({ title: '总榜', path: '/top', description: '摸鱼派签到与活跃榜' }))

const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)
const checkin = ref<RankUser[]>([])
const online = ref<RankUser[]>([])
const jobs = ref<{ professionId?: string; displayName?: string; professionName?: string }[]>([])
const jobId = ref('')
const jobEntries = ref<ProfessionRankEntry[]>([])
const jobError = ref('')
const error = ref('')
const loading = ref(false)

const usingMock = computed(() => checkin.value.some((u) => ['csfwff', 'Yui'].includes(u.userName) && checkin.value.length <= 8))

async function load() {
  error.value = ''
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
    <p v-if="loading" class="banner">加载中…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <p v-else-if="usingMock && !apiKey" class="banner">
      匿名榜单接口尚未开放，当前为与 <code>/api/top/checkin|online</code> 对齐的 mock。
    </p>
    <section class="card">
      <h1>今日连签排行</h1>
      <ol>
        <li v-for="(u, i) in checkin" :key="u.userName">
          <i>{{ i + 1 }}</i>
          <RouterLink :to="`/member/${u.userName}`">{{ u.userName }}</RouterLink>
          <em>{{ u.userCurrentCheckinStreak ?? u.userCheckinStreak }}</em>
        </li>
      </ol>
    </section>
    <section class="card">
      <h1>在线时间排行</h1>
      <ol>
        <li v-for="(u, i) in online" :key="u.userName">
          <i>{{ i + 1 }}</i>
          <RouterLink :to="`/member/${u.userName}`">{{ u.userName }}</RouterLink>
          <em>{{ Number(u.onlineMinute || 0).toLocaleString() }} 分钟</em>
        </li>
      </ol>
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
