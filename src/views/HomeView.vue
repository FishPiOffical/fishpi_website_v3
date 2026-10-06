<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchCheckinRank,
  fetchOnlineRank,
  fetchRecentArticles,
  type ArticleSummary,
  type RankUser,
} from '@/api/fishpi'
import { MOCK_ARTICLES, MOCK_CHECKIN, MOCK_ONLINE } from '@/api/home.mock'
import { fetchPublicHome } from '@/api/publicHome'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { apiKey } = storeToRefs(auth)
const left = ref<ArticleSummary[]>([])
const right = ref<ArticleSummary[]>([])
const checkin = ref<RankUser[]>([])
const online = ref<RankUser[]>([])
const hint = ref('')
const income = ref(365)
const loading = ref(true)

function splitArticles(articles: ArticleSummary[]) {
  const mid = Math.ceil(articles.length / 2)
  left.value = articles.slice(0, mid)
  right.value = articles.slice(mid)
}

onMounted(async () => {
  hint.value = ''
  loading.value = true
  try {
    if (apiKey.value) {
      try {
        splitArticles(await fetchRecentArticles(apiKey.value, 1, 40))
      } catch {
        /* 登录态接口失败时改走公开首页 HTML */
      }
      try {
        checkin.value = (await fetchCheckinRank(apiKey.value)).slice(0, 8)
      } catch {
        checkin.value = []
      }
      try {
        online.value = (await fetchOnlineRank(apiKey.value)).slice(0, 8)
      } catch {
        online.value = []
      }
    }

    if (!left.value.length || !checkin.value.length || !online.value.length) {
      try {
        const pub = await fetchPublicHome()
        if (!left.value.length) splitArticles(pub.articles)
        if (!checkin.value.length) checkin.value = pub.checkin.slice(0, 8)
        if (!online.value.length) online.value = pub.online.slice(0, 8)
      } catch {
        hint.value = '暂时无法读取公开首页，以下为占位数据。'
        if (!left.value.length) {
          const mid = Math.ceil(MOCK_ARTICLES.length / 2)
          left.value = MOCK_ARTICLES
          right.value = MOCK_ARTICLES.slice(mid).concat(MOCK_ARTICLES.slice(0, mid))
        }
      }
    }

    if (!checkin.value.length) checkin.value = MOCK_CHECKIN
    if (!online.value.length) online.value = MOCK_ONLINE
  } finally {
    loading.value = false
  }
})

function views(a: ArticleSummary) {
  return a.articleViewCntDisplayFormat || a.articleViewCount || ''
}
</script>

<template>
  <div class="home">
    <p v-if="hint" class="hint">{{ hint }}</p>
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
        <div class="card income">
          <span>今日收入</span>
          <b>¥{{ income }}</b>
        </div>
        <div class="card">
          <header>
            <h3>今日连签排行</h3>
          </header>
          <ol class="rank">
            <li v-for="(u, i) in checkin" :key="u.userName">
              <i>{{ i + 1 }}</i>
              {{ u.userName }}
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
              {{ u.userName }}
              <em>{{ Number(u.onlineMinute || 0).toLocaleString() }} 分钟</em>
            </li>
          </ol>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.hint {
  color: var(--fp-muted);
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
