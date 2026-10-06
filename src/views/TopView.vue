<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { fetchCheckinRank, fetchOnlineRank, type RankUser } from '@/api/fishpi'
import { fetchPublicHome } from '@/api/publicHome'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)
const checkin = ref<RankUser[]>([])
const online = ref<RankUser[]>([])
const error = ref('')

onMounted(async () => {
  try {
    if (apiKey.value) {
      checkin.value = await fetchCheckinRank(apiKey.value)
      online.value = await fetchOnlineRank(apiKey.value)
    }
    if (!checkin.value.length || !online.value.length) {
      const pub = await fetchPublicHome()
      if (!checkin.value.length) checkin.value = pub.checkin
      if (!online.value.length) online.value = pub.online
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '排行榜加载失败'
  }
})
</script>

<template>
  <div class="board">
    <p v-if="error" class="err">{{ error }}</p>
    <section class="card">
      <h1>今日连签排行</h1>
      <ol>
        <li v-for="(u, i) in checkin" :key="u.userName">
          <i>{{ i + 1 }}</i>
          {{ u.userName }}
          <em>{{ u.userCheckinStreak }}</em>
        </li>
      </ol>
    </section>
    <section class="card">
      <h1>在线时间排行</h1>
      <ol>
        <li v-for="(u, i) in online" :key="u.userName">
          <i>{{ i + 1 }}</i>
          {{ u.userName }}
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
