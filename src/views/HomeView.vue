<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchArticleFeed,
  fetchBreezemoons,
  fetchCheckinRank,
  fetchOnlineRank,
  fetchRecentArticles,
  fetchRecentRegister,
  fetchTags,
  type ArticleSummary,
  type Breezemoon,
  type LiteUser,
  type RankUser,
  type TagItem,
} from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import AdSlot from '@/components/ads/AdSlot.vue'
import CheckinPanel from '@/components/home/CheckinPanel.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeFeedPayload, consumeHomeExtrasPayload } from '@/seo/payload'
import { SITE_DEFAULT_DESC, SITE_NAME } from '@/seo/site'

const auth = useAuthStore()
const router = useRouter()
const { apiKey, isLoggedIn } = storeToRefs(auth)
const left = ref<ArticleSummary[]>([])
const right = ref<ArticleSummary[]>([])
const hot = ref<ArticleSummary[]>([])
const longArticles = ref<ArticleSummary[]>([])
const checkin = ref<RankUser[]>([])
const online = ref<RankUser[]>([])
const recentUsers = ref<LiteUser[]>([])
const tags = ref<TagItem[]>([])
const moons = ref<Breezemoon[]>([])
const error = ref('')
const loading = ref(true)

const usingMock = computed(() => left.value.some((a) => String(a.oId).startsWith('mock-')))

usePageSeo(() => ({
  title: SITE_NAME,
  description: SITE_DEFAULT_DESC,
  path: '/',
}))

function splitArticles(articles: ArticleSummary[]) {
  const mid = Math.ceil(articles.length / 2)
  left.value = articles.slice(0, mid)
  right.value = articles.slice(mid)
}

// Apply SSR/client payload synchronously so first paint isn't stuck on "加载中".
const bootFeed = consumeFeedPayload('recent')
if (bootFeed?.length) {
  splitArticles(bootFeed)
  loading.value = false
}
const bootExtra = consumeHomeExtrasPayload()
if (bootExtra) {
  if (bootExtra.hot?.length) hot.value = bootExtra.hot.slice(0, 12)
  if (bootExtra.long?.length) longArticles.value = bootExtra.long.slice(0, 8)
  if (bootExtra.checkin?.length) checkin.value = bootExtra.checkin.slice(0, 8)
  if (bootExtra.online?.length) online.value = bootExtra.online.slice(0, 8)
  if (bootExtra.recentUsers?.length) recentUsers.value = bootExtra.recentUsers.slice(0, 12)
  if (bootExtra.tags?.length) tags.value = bootExtra.tags.slice(0, 24)
  if (bootExtra.breezemoons?.length) moons.value = bootExtra.breezemoons.slice(0, 8)
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p
  } catch {
    return fallback
  }
}

async function load() {
  error.value = ''
  const needArticles = left.value.length === 0
  if (needArticles) loading.value = true
  try {
    const [articles, checkinRank, onlineRank, hotList, longList, regs, tagData, breezes] = await Promise.all([
      needArticles
        ? fetchRecentArticles(apiKey.value, 1, 40)
        : Promise.resolve(left.value.concat(right.value)),
      safe(fetchCheckinRank(apiKey.value), []),
      safe(fetchOnlineRank(apiKey.value), []),
      safe(fetchArticleFeed('hot', apiKey.value, 1, 12), []),
      safe(fetchArticleFeed('long', apiKey.value, 1, 8), []),
      safe(fetchRecentRegister(apiKey.value), []),
      safe(fetchTags(apiKey.value, 1, 24), { tags: [], total: 0 }),
      safe(fetchBreezemoons(1, 8), []),
    ])
    if (needArticles) splitArticles(articles)
    checkin.value = checkinRank.slice(0, 8)
    online.value = onlineRank.slice(0, 8)
    hot.value = hotList.slice(0, 12)
    longArticles.value = longList.slice(0, 8)
    recentUsers.value = regs.slice(0, 12)
    tags.value = tagData.tags.slice(0, 24)
    moons.value = breezes.slice(0, 8)
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

function avatarOf(u: RankUser | LiteUser) {
  return (
    ('userAvatarURL20' in u && u.userAvatarURL20) ||
    u.userAvatarURL48 ||
    u.userAvatarURL ||
    ''
  )
}

function streakOf(u: RankUser) {
  return u.userCurrentCheckinStreak ?? u.userCheckinStreak ?? ''
}

function tagPath(tag: TagItem) {
  const uri = tag.tagURI || tag.tagTitle
  try {
    return `/tags/${encodeURIComponent(decodeURIComponent(uri))}`
  } catch {
    return `/tags/${encodeURIComponent(uri)}`
  }
}

function goDownload() {
  void router.push('/download')
}

function stripHtml(html: string, max = 60) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
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
            <RouterLink class="title fn-ellipsis" :to="`/article/${item.oId}`">{{
              item.articleTitleEmoj || item.articleTitle
            }}</RouterLink>
            <span class="count">{{ views(item) }}</span>
          </li>
        </ol>
      </section>

      <section class="col">
        <div class="index-head">
          <b>&nbsp;</b>
          <RouterLink to="/">更多</RouterLink>
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
            <RouterLink class="title fn-ellipsis" :to="`/article/${item.oId}`">{{
              item.articleTitleEmoj || item.articleTitle
            }}</RouterLink>
            <span class="count">{{ views(item) }}</span>
          </li>
        </ol>
      </section>

      <aside class="col side">
        <div class="download">
          <img src="https://file.fishpi.cn/logo_app.png" width="35" height="35" alt="" />
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
            <span class="cb-stick gold"><span class="icon-pin-rank">{{ i + 1 }}</span></span>
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
        <div class="index-head spaced">
          <b>在线时间排行</b>
          <RouterLink to="/top">更多</RouterLink>
        </div>
        <ol class="module-list rank">
          <li v-for="(u, i) in online" :key="u.userName">
            <span class="cb-stick gold"><span class="icon-pin-rank">{{ i + 1 }}</span></span>
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

    <div class="board row">
      <section class="col">
        <div class="index-head">
          <b>热议</b>
          <RouterLink to="/hot">更多</RouterLink>
        </div>
        <ol class="module-list">
          <li v-for="item in hot" :key="item.oId">
            <RouterLink v-if="item.articleAuthorName" :to="`/member/${item.articleAuthorName}`">
              <span
                class="avatar-small"
                :style="item.articleAuthorThumbnailURL48 ? { backgroundImage: `url('${item.articleAuthorThumbnailURL48}')` } : undefined"
              />
            </RouterLink>
            <RouterLink class="title fn-ellipsis" :to="`/article/${item.oId}`">{{
              item.articleTitleEmoj || item.articleTitle
            }}</RouterLink>
            <span class="count">{{ views(item) }}</span>
          </li>
          <li v-if="!hot.length && !loading" class="hint-li">暂无热议</li>
        </ol>
      </section>
      <section class="col">
        <div class="index-head">
          <b>长篇专区</b>
          <RouterLink to="/recent/long">更多</RouterLink>
        </div>
        <ol class="module-list">
          <li v-for="item in longArticles" :key="item.oId">
            <RouterLink class="title fn-ellipsis" :to="`/article/${item.oId}`">{{
              item.articleTitleEmoj || item.articleTitle
            }}</RouterLink>
            <span class="count">{{ item.articleAuthorName }}</span>
          </li>
          <li v-if="!longArticles.length && !loading" class="hint-li">暂无长篇</li>
        </ol>
      </section>
      <aside class="col side">
        <div class="index-head">
          <b>最新注册</b>
        </div>
        <ul class="people">
          <li v-for="u in recentUsers" :key="u.oId || u.userName">
            <RouterLink :to="`/member/${u.userName}`">
              <span
                class="avatar-small"
                :style="avatarOf(u) ? { backgroundImage: `url('${avatarOf(u)}')` } : undefined"
              />
              <em>{{ u.userNickname || u.userName }}</em>
            </RouterLink>
          </li>
          <li v-if="!recentUsers.length && !loading" class="hint-li">暂无</li>
        </ul>
        <div class="index-head spaced">
          <b>标签</b>
          <RouterLink to="/tags">更多</RouterLink>
        </div>
        <div class="tags">
          <RouterLink v-for="t in tags" :key="t.tagURI || t.tagTitle" :to="tagPath(t)">
            {{ t.tagTitle }}
          </RouterLink>
          <span v-if="!tags.length && !loading" class="hint">暂无标签</span>
        </div>
        <div class="index-head spaced">
          <b>清风明月</b>
          <RouterLink to="/breezemoons">更多</RouterLink>
        </div>
        <ul class="moons">
          <li v-for="m in moons" :key="m.oId">
            <RouterLink v-if="m.breezemoonAuthorName" class="who" :to="`/member/${m.breezemoonAuthorName}`">
              {{ m.breezemoonAuthorName }}
            </RouterLink>
            <span>{{ stripHtml(m.breezemoonContent || '') }}</span>
          </li>
          <li v-if="!moons.length && !loading" class="hint-li">暂无动态</li>
        </ul>
        <div class="chat-teaser">
          <b>聊天室</b>
          <RouterLink class="green-link" to="/cr">进入完整版聊天室</RouterLink>
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
.home {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.board {
  display: flex;
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  padding: 15px 0 20px;
  border-radius: 10px;
}
.board.row {
  margin-top: 0;
}
.col {
  flex: 1;
  min-width: 0;
}
.col.side {
  flex: 0.95;
}
.index-head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin: 5px 10px 10px;
  color: var(--fp-head);
}
.index-head.spaced {
  margin-top: 18px;
}
.index-head b {
  font-weight: 700;
  color: var(--fp-head);
}
.index-head a {
  color: var(--fp-link);
  text-decoration: none;
}
.module-list,
.people,
.moons {
  list-style: none;
  margin: 0;
  padding: 0;
}
.module-list li,
.people li,
.moons li {
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
.hint-li {
  color: var(--fp-muted);
  font-size: 13px;
}
.title {
  flex: 1;
  color: var(--fp-title);
  text-decoration: none;
  min-width: 0;
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
  flex-shrink: 0;
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
.people li a {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fp-title);
  text-decoration: none;
}
.people em {
  font-style: normal;
  font-size: 13px;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 15px;
}
.tags a {
  font-size: 12px;
  color: var(--fp-link);
  text-decoration: none;
  border: 1px solid var(--fp-border);
  border-radius: 999px;
  padding: 2px 8px;
}
.moons li {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  font-size: 13px;
  color: var(--fp-muted);
}
.moons .who {
  color: var(--fp-link);
  text-decoration: none;
  font-size: 12px;
}
.chat-teaser {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 16px 15px 0;
  padding: 10px 12px;
  border: 1px solid var(--fp-border);
  border-radius: 6px;
  font-size: 13px;
}
.green-link {
  color: var(--fp-green);
  text-decoration: none;
  font-weight: 600;
}
@media (max-width: 960px) {
  .board {
    flex-direction: column;
  }
}
</style>
