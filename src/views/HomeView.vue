<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchCheckinRank,
  fetchOnlineRank,
  fetchRandomArticles,
  fetchRecentArticles,
  type ArticleSummary,
  type RankUser,
} from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import AdSlot from '@/components/ads/AdSlot.vue'
import CheckinPanel from '@/components/home/CheckinPanel.vue'

const auth = useAuthStore()
const { apiKey, isLoggedIn } = storeToRefs(auth)
const left = ref<ArticleSummary[]>([])
const right = ref<ArticleSummary[]>([])
const checkin = ref<RankUser[]>([])
const online = ref<RankUser[]>([])
const randoms = ref<ArticleSummary[]>([])
const error = ref('')
const loading = ref(false)

const usingMock = computed(() => left.value.some((a) => String(a.oId).startsWith('mock-')))

function splitArticles(articles: ArticleSummary[]) {
  const mid = Math.ceil(articles.length / 2)
  left.value = articles.slice(0, mid)
  right.value = articles.slice(mid)
}

async function load() {
  error.value = ''
  loading.value = true
  try {
    const [articles, checkinRank, onlineRank, randomList] = await Promise.all([
      fetchRecentArticles(apiKey.value, 1, 40),
      fetchCheckinRank(apiKey.value),
      fetchOnlineRank(apiKey.value),
      fetchRandomArticles(8, apiKey.value),
    ])
    splitArticles(articles)
    checkin.value = checkinRank.slice(0, 8)
    online.value = onlineRank.slice(0, 8)
    randoms.value = randomList
  } catch (e) {
    error.value = e instanceof Error ? e.message : '首页加载失败'
  } finally {
    loading.value = false
  }
}

watch(apiKey, () => void load(), { immediate: true })

function views(a: ArticleSummary) {
  return a.articleViewCntDisplayFormat || a.articleViewCount || ''
}
</script>

<template>
  <div class="home">
    <p v-if="usingMock" class="banner">
      匿名列表接口尚未开放，当前展示与 <code>GET /api/articles/recent</code> 对齐的 mock。
      <RouterLink v-if="!isLoggedIn" to="/login">登录</RouterLink>
      后走真实数据。
    </p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <div class="board">
      <section class="col">
        <header>
          <h2>最新</h2>
        </header>
        <p v-if="loading && !left.length" class="hint">加载最新帖子…</p>
        <ol>
          <li v-for="item in left" :key="item.oId">
            <span v-if="item.articleStick" class="pin" />
            <RouterLink :to="`/article/${item.oId}`">{{ item.articleTitleEmoj || item.articleTitle }}</RouterLink>
            <em>{{ views(item) }}</em>
          </li>
        </ol>
      </section>
      <section class="col">
        <header>
          <h2>更多</h2>
        </header>
        <p v-if="loading && !right.length" class="hint">加载中…</p>
        <ol>
          <li v-for="item in right" :key="item.oId">
            <RouterLink :to="`/article/${item.oId}`">{{ item.articleTitleEmoj || item.articleTitle }}</RouterLink>
            <em>{{ views(item) }}</em>
          </li>
        </ol>
      </section>
      <aside>
        <div class="card download">
          <strong>随时随地摸鱼？</strong>
          <p>下载摸鱼派客户端，想摸就摸！</p>
          <a href="https://fishpi.cn/download" target="_blank" rel="noreferrer">下载</a>
        </div>
        <AdSlot slot-key="home.sidebar" />
        <CheckinPanel />
        <div v-if="randoms.length" class="card">
          <header>
            <h3>随机帖子</h3>
          </header>
          <ol>
            <li v-for="item in randoms" :key="item.oId">
              <RouterLink :to="`/article/${item.oId}`">{{ item.articleTitleEmoj || item.articleTitle }}</RouterLink>
            </li>
          </ol>
        </div>
        <div class="card">
          <header>
            <h3>今日连签排行</h3>
          </header>
          <ol class="rank">
            <li v-for="(u, i) in checkin" :key="u.userName">
              <i>{{ i + 1 }}</i>
              <RouterLink :to="`/member/${u.userName}`">{{ u.userName }}</RouterLink>
              <em>{{ u.userCheckinStreak }}</em>
            </li>
          </ol>
        </div>
        <div class="card">
          <header>
            <h3>在线时间排行</h3>
          </header>
          <ol class="rank">
            <li v-for="(u, i) in online" :key="u.userName">
              <i>{{ i + 1 }}</i>
              <RouterLink :to="`/member/${u.userName}`">{{ u.userName }}</RouterLink>
              <em>{{ Number(u.onlineMinute || 0).toLocaleString() }} 分钟</em>
            </li>
          </ol>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.banner,
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.banner a,
.hint a {
  color: var(--fp-link);
}
.err {
  color: #e07a5f;
  font-size: 13px;
}
.board {
  display: grid;
  grid-template-columns: 1fr 1fr 280px;
  gap: 16px;
}
.col,
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  padding: 12px 14px;
}
header {
  display: flex;
  justify-content: space-between;
}
h2,
h3 {
  margin: 0 0 10px;
  font-size: 14px;
}
ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
.col li {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 7px 0;
  border-bottom: 1px solid var(--fp-border);
  font-size: 14px;
}
.col a {
  flex: 1;
  color: var(--fp-text);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
aside .card a {
  color: var(--fp-text);
  text-decoration: none;
  font-size: 13px;
}
aside .card li {
  padding: 6px 0;
  border-bottom: 1px solid var(--fp-border);
}
.col em,
.rank em {
  color: var(--fp-muted);
  font-style: normal;
  font-size: 12px;
}
.pin {
  width: 0;
  height: 0;
  border: 6px solid #999;
  border-right-color: transparent;
  border-bottom-color: transparent;
}
.income {
  text-align: center;
}
.income b {
  display: block;
  color: #3d9a8c;
  font-size: 28px;
}
.download a {
  display: inline-block;
  margin-top: 8px;
  background: #5aa65a;
  color: #fff;
  text-decoration: none;
  border-radius: 6px;
  padding: 4px 12px;
}
.rank li {
  display: flex;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
}
.rank a {
  flex: 1;
  color: inherit;
  text-decoration: none;
}
.rank i {
  font-style: normal;
  width: 18px;
  color: var(--fp-muted);
}
aside {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
@media (max-width: 960px) {
  .board {
    grid-template-columns: 1fr;
  }
}
</style>
