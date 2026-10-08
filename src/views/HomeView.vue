<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchCheckinRank,
  fetchOnlineRank,
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
    const [articles, checkinRank, onlineRank] = await Promise.all([
      fetchRecentArticles(apiKey.value, 1, 40),
      fetchCheckinRank(apiKey.value),
      fetchOnlineRank(apiKey.value),
    ])
    splitArticles(articles)
    checkin.value = checkinRank.slice(0, 8)
    online.value = onlineRank.slice(0, 8)
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

function avatarOf(u: RankUser) {
  return u.userAvatarURL20 || u.userAvatarURL48 || u.userAvatarURL
}

function streakOf(u: RankUser) {
  return u.userCurrentCheckinStreak ?? u.userCheckinStreak ?? ''
}

function goDownload() {
  window.open('https://fishpi.cn/download', '_blank', 'noreferrer')
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
        <div class="index-head">
          <b>最新</b>
        </div>
        <p v-if="loading && !left.length" class="hint">加载最新帖子…</p>
        <ol class="module-list">
          <li v-for="item in left" :key="item.oId">
            <span v-if="item.articleStick" class="cb-stick" title="置顶" />
            <RouterLink v-if="item.articleAuthorName" :to="`/member/${item.articleAuthorName}`">
              <span
                class="avatar-small"
                :style="item.articleAuthorThumbnailURL48 ? { backgroundImage: `url('${item.articleAuthorThumbnailURL48}')` } : undefined"
                :aria-label="item.articleAuthorName"
              />
            </RouterLink>
            <RouterLink class="title fn-ellipsis" :to="`/article/${item.oId}`">{{ item.articleTitleEmoj || item.articleTitle }}</RouterLink>
            <span class="count">{{ views(item) }}</span>
          </li>
        </ol>
      </section>
      <section class="col">
        <div class="index-head">
          <b>更多</b>
        </div>
        <p v-if="loading && !right.length" class="hint">加载中…</p>
        <ol class="module-list">
          <li v-for="item in right" :key="item.oId">
            <RouterLink v-if="item.articleAuthorName" :to="`/member/${item.articleAuthorName}`">
              <span
                class="avatar-small"
                :style="item.articleAuthorThumbnailURL48 ? { backgroundImage: `url('${item.articleAuthorThumbnailURL48}')` } : undefined"
                :aria-label="item.articleAuthorName"
              />
            </RouterLink>
            <RouterLink class="title fn-ellipsis" :to="`/article/${item.oId}`">{{ item.articleTitleEmoj || item.articleTitle }}</RouterLink>
            <span class="count">{{ views(item) }}</span>
          </li>
        </ol>
      </section>
      <aside class="col">
        <div class="download">
          <img src="https://file.fishpi.cn/logo_app.png" alt="" />
          <div>
            <b>随时随地摸鱼？</b>
            <p>下载摸鱼派客户端，想摸就摸！</p>
          </div>
          <button type="button" class="green" @click="goDownload">下载</button>
        </div>
        <AdSlot slot-key="home.sidebar" />
        <CheckinPanel />
        <div class="index-head">
          <b>今日连签排行</b>
          <RouterLink to="/top">更多</RouterLink>
        </div>
        <ol class="module-list rank">
          <li v-for="(u, i) in checkin" :key="u.userName">
            <span class="cb-stick gold">
              <span class="icon-pin-rank">{{ i + 1 }}</span>
            </span>
            <RouterLink :to="`/member/${u.userName}`">
              <span
                class="avatar-small"
                :style="avatarOf(u) ? { backgroundImage: `url('${avatarOf(u)}')` } : undefined"
              />
            </RouterLink>
            <RouterLink class="title fn-ellipsis" :to="`/member/${u.userName}`">{{ u.userName }}</RouterLink>
            <span class="count">{{ streakOf(u) }}天</span>
          </li>
        </ol>
        <div class="index-head">
          <b>在线时间排行</b>
          <RouterLink to="/top">更多</RouterLink>
        </div>
        <ol class="module-list rank">
          <li v-for="(u, i) in online" :key="u.userName">
            <span class="cb-stick gold">
              <span class="icon-pin-rank">{{ i + 1 }}</span>
            </span>
            <RouterLink :to="`/member/${u.userName}`">
              <span
                class="avatar-small"
                :style="avatarOf(u) ? { backgroundImage: `url('${avatarOf(u)}')` } : undefined"
              />
            </RouterLink>
            <RouterLink class="title fn-ellipsis" :to="`/member/${u.userName}`">{{ u.userName }}</RouterLink>
            <span class="count">{{ Number(u.onlineMinute || 0).toLocaleString() }} 分钟</span>
          </li>
        </ol>
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
  display: flex;
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  padding: 15px 0 20px;
  border-radius: 10px;
}
.col {
  flex: 1;
  min-width: 0;
}
.index-head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin: 5px 10px 10px;
  color: var(--fp-head);
}
.index-head b {
  font-weight: 700;
  color: var(--fp-head);
}
.index-head a {
  color: var(--fp-link);
  text-decoration: none;
}
.module-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.module-list li {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 15px;
  min-height: 40px;
  font-size: 14px;
}
.module-list.rank li {
  padding-left: 22px;
}
.title {
  flex: 1;
  color: var(--fp-title);
  text-decoration: none;
}
.title:hover {
  color: var(--fp-link);
}
.count {
  color: var(--fp-head);
  font-size: 12px;
  margin-left: auto;
  flex-shrink: 0;
}
.download {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 7px 15px 20px;
  padding: 10px;
  font-size: 13px;
  color: var(--fp-head);
  background: var(--fp-card);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}
.download img {
  width: 35px;
  height: 35px;
}
.download p {
  margin: 4px 0 0;
  color: var(--fp-muted);
}
.green {
  margin-left: auto;
  border: 0;
  background: var(--fp-green);
  color: #fff;
  border-radius: 3px;
  padding: 4px 12px;
  cursor: pointer;
  height: 28px;
  flex-shrink: 0;
}
@media (max-width: 960px) {
  .board {
    flex-direction: column;
  }
}
</style>
