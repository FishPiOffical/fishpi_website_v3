<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { fetchCheckinRank, fetchOnlineRank, type RankUser } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)
const checkin = ref<RankUser[]>([])
const online = ref<RankUser[]>([])
const error = ref('')
const loading = ref(false)

const usingMock = computed(() => checkin.value.some((u) => ['csfwff', 'Yui'].includes(u.userName) && checkin.value.length <= 8))

async function load() {
  error.value = ''
  loading.value = true
  try {
    ;[checkin.value, online.value] = await Promise.all([
      fetchCheckinRank(apiKey.value),
      fetchOnlineRank(apiKey.value),
    ])
  } catch (e) {
    error.value = e instanceof Error ? e.message : '排行榜加载失败'
  } finally {
    loading.value = false
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
          <em>{{ u.userCheckinStreak }}</em>
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
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.banner {
  grid-column: 1 / -1;
  color: var(--fp-muted);
  font-size: 13px;
}
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 18px 20px;
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
