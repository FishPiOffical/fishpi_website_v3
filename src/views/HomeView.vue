<script setup lang="ts">
import VipNickname from '@/components/user/VipNickname.vue'
import { articleTitle } from '@/utils/text'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchArticleFeed,
  fetchBreezemoons,
  fetchChatHistory,
  fetchChatOnlineUsers,
  fetchCheckinRank,
  fetchHomeColumns,
  fetchOnlineRank,
  fetchRecentArticles,
  fetchRecentRegister,
  fetchRepeaterItems,
  fetchTags,
  postBreezemoon,
  sendChat,
  type ArticleSummary,
  type Breezemoon,
  type ChatHistoryItem,
  type HomeColumnCard,
  type LiteUser,
  type RankUser,
  type RepeaterItem,
  type TagItem,
} from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useHomeLayoutStore, type HomeRowView } from '@/stores/homeLayout'
import { useHomeDrag } from '@/home/useHomeDrag'
import AdSlot from '@/components/ads/AdSlot.vue'
import CheckinPanel from '@/components/home/CheckinPanel.vue'
import HomeSideWidgets from '@/components/home/HomeSideWidgets.vue'
import HomeRepeaterStation from '@/components/home/HomeRepeaterStation.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeFeedPayload, consumeHomeExtrasPayload } from '@/seo/payload'
import { SITE_DEFAULT_DESC, SITE_NAME, SITE_ORIGIN } from '@/seo/site'
import FpLoading from '@/components/FpLoading.vue'
import { readCache, writeCache } from '@/utils/swr'
import { avatarStyle, avatarUrl } from '@/utils/avatar'

const auth = useAuthStore()
const chat = useChatStore()
const layout = useHomeLayoutStore()
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
const chatLines = ref<ChatHistoryItem[]>([])
const repeaterItems = ref<RepeaterItem[]>([])
const onlineChatCnt = ref<number | null>(null)
const discussing = ref('')
const chatDraft = ref('')
const chatBusy = ref(false)
const chatMsg = ref('')
const moonDraft = ref('')
const moonBusy = ref(false)
const moonMsg = ref('')
const hotMode = ref<'hot' | 'column'>('hot')
const error = ref('')
const loading = ref(true)

const usingMock = computed(() => left.value.some((a) => String(a.oId).startsWith('mock-')))
const hotPanel = computed(() => (hotMode.value === 'hot' ? hot.value : longArticles.value))
const welcomeUser = computed(() => recentUsers.value[0] || null)
const REG_PER_ROW = 10
const regGrid = computed(() => {
  const list = recentUsers.value
  const full = Math.floor(list.length / REG_PER_ROW) * REG_PER_ROW
  return full ? list.slice(0, full) : list
})
const { editing } = storeToRefs(layout)
const { dragging, onDragStart, onDragEnd, onModuleOver, onGapOver, onDrop, edgeOf, gapActive } = useHomeDrag()
onUnmounted(() => (editing.value = false))
const { messages: liveChatMessages } = storeToRefs(chat)
let homeMounted = false
let longShelfTimer: ReturnType<typeof setInterval> | undefined
const activeLongShelf = ref<'recent' | 'hot'>('recent')

function syncLiveChatMessages() {
  if (!liveChatMessages.value.length) return
  chatLines.value = liveChatMessages.value.slice(-10).reverse().map((line) => ({
    oId: line.oId,
    userOId: line.userOId,
    userName: line.userName,
    userNickname: line.userNickname,
    userAvatarURL: line.userAvatarURL,
    content: line.redPacket || (line.card?.msgType === 'music' ? line.card.title || '音乐分享' : line.card ? '天气信息' : line.html || ''),
    time: line.time,
  }))
}

watch(() => liveChatMessages.value.length, syncLiveChatMessages)
onMounted(() => {
  homeMounted = true
  if (apiKey.value) void chat.connect()
  longShelfTimer = setInterval(() => {
    scrollShelf('long-active', 1)
  }, 6000)
})
onUnmounted(() => {
  homeMounted = false
  if (longShelfTimer) clearInterval(longShelfTimer)
  if (!chat.floatingChatroomOpen) chat.disconnect()
})
/** 长篇专区自带卡片样式，独占一行时不再套外框 */
function isBareRow(row: HomeRowView) {
  return row.cells.length === 1 && row.cells[0].modules.every((m) => m.id === 'long')
}
/** 专栏货架：优先 /api/columns/*，否则 gaps.mock；再否则长篇帖近似. */
const homeColumnsRecent = ref<HomeColumnCard[]>([])
const homeColumnsHot = ref<HomeColumnCard[]>([])
const longRecentShelf = computed(() => longArticles.value.slice(0, 8))
const defaultColumnCover = `${SITE_ORIGIN}/images/holiday/book-bg.jpg`
const longHotShelf = computed(() => {
  const withCol = hot.value.filter((a) => a.columnTitle)
  if (withCol.length) return withCol.slice(0, 8)
  return (hot.value.length ? hot.value : longArticles.value).slice(0, 8)
})
const activeColumnsShelf = computed(() =>
  (activeLongShelf.value === 'recent' ? homeColumnsRecent.value : homeColumnsHot.value).slice(0, 8),
)
const activeArticlesShelf = computed(() =>
  activeLongShelf.value === 'recent' ? longRecentShelf.value : longHotShelf.value,
)
watch(activeLongShelf, async () => {
  await nextTick()
  document.getElementById('long-active')?.scrollTo({ left: 0 })
})
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

const bootFeed = consumeFeedPayload('recent')
if (bootFeed?.length) {
  splitArticles(bootFeed)
  loading.value = false
}
const bootExtra = consumeHomeExtrasPayload()
if (bootExtra) {
  if (bootExtra.hot?.length) hot.value = bootExtra.hot.slice(0, 12)
  if (bootExtra.long?.length) longArticles.value = bootExtra.long.slice(0, 12)
  if (bootExtra.checkin?.length) checkin.value = bootExtra.checkin.slice(0, 8)
  if (bootExtra.online?.length) online.value = bootExtra.online.slice(0, 8)
  if (bootExtra.recentUsers?.length) recentUsers.value = bootExtra.recentUsers.slice(0, 20)
  if (bootExtra.tags?.length) tags.value = bootExtra.tags.slice(0, 24)
  if (bootExtra.breezemoons?.length) moons.value = bootExtra.breezemoons.slice(0, 8)
  if (bootExtra.chatFeed?.length) chatLines.value = bootExtra.chatFeed.slice(0, 10)
  if (bootExtra.repeater?.length) repeaterItems.value = bootExtra.repeater
  if (bootExtra.chatOnline) {
    if (typeof bootExtra.chatOnline.onlineChatCnt === 'number') {
      onlineChatCnt.value = bootExtra.chatOnline.onlineChatCnt
    }
    if (bootExtra.chatOnline.discussing) discussing.value = bootExtra.chatOnline.discussing
  }
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p
  } catch {
    return fallback
  }
}

interface HomeSnapshot {
  articles: ArticleSummary[]
  checkin: RankUser[]
  online: RankUser[]
  hot: ArticleSummary[]
  long: ArticleSummary[]
  recentUsers: LiteUser[]
  tags: TagItem[]
  moons: Breezemoon[]
  chatLines: ChatHistoryItem[]
  repeater: RepeaterItem[]
  onlineChatCnt: number | null
  discussing: string
  columnsRecent: HomeColumnCard[]
  columnsHot: HomeColumnCard[]
}
const HOME_CACHE_KEY = 'home'

function applySnapshot(s: HomeSnapshot) {
  splitArticles(s.articles)
  checkin.value = s.checkin
  online.value = s.online
  hot.value = s.hot
  longArticles.value = s.long
  recentUsers.value = s.recentUsers
  tags.value = s.tags
  moons.value = s.moons
  chatLines.value = s.chatLines
  repeaterItems.value = s.repeater
  onlineChatCnt.value = s.onlineChatCnt
  discussing.value = s.discussing
  homeColumnsRecent.value = s.columnsRecent
  homeColumnsHot.value = s.columnsHot
}

const homeCached = !bootFeed?.length ? readCache<HomeSnapshot>(HOME_CACHE_KEY) : undefined
if (homeCached) {
  applySnapshot(homeCached)
  loading.value = false
}

async function load() {
  error.value = ''
  const needArticles = left.value.length === 0 || Boolean(homeCached)
  if (left.value.length === 0) loading.value = true
  try {
    const [
      articles,
      checkinRank,
      onlineRank,
      hotList,
      longList,
      regs,
      tagData,
      breezes,
      chats,
      reps,
      onlineSnap,
      columns,
    ] = await Promise.all([
      needArticles
        ? fetchRecentArticles(apiKey.value, 1, 40)
        : Promise.resolve(left.value.concat(right.value)),
      safe(fetchCheckinRank(apiKey.value), []),
      safe(fetchOnlineRank(apiKey.value), []),
      safe(fetchArticleFeed('hot', apiKey.value, 1, 12), []),
      safe(fetchArticleFeed('long', apiKey.value, 1, 12), []),
      safe(fetchRecentRegister(apiKey.value), []),
      safe(fetchTags(apiKey.value, 1, 24), { tags: [], total: 0 }),
      safe(fetchBreezemoons(1, 8), []),
      safe(fetchChatHistory(apiKey.value, 1), []),
      safe(fetchRepeaterItems(apiKey.value), []),
      safe(fetchChatOnlineUsers(apiKey.value), {}),
      safe(fetchHomeColumns(), { recent: [], hot: [] }),
    ])
    const snap: HomeSnapshot = {
      articles,
      checkin: checkinRank.slice(0, 8),
      online: onlineRank.slice(0, 8),
      hot: hotList.slice(0, 12),
      long: longList.slice(0, 12),
      recentUsers: regs.slice(0, 20),
      tags: tagData.tags.slice(0, 24),
      moons: breezes.slice(0, 8),
      chatLines: chats.slice(0, 10),
      repeater: reps,
      onlineChatCnt: typeof onlineSnap.onlineChatCnt === 'number' ? onlineSnap.onlineChatCnt : null,
      discussing: onlineSnap.discussing || '',
      columnsRecent: columns.recent || [],
      columnsHot: columns.hot || [],
    }
    applySnapshot(snap)
    writeCache(HOME_CACHE_KEY, snap)
  } catch (e) {
    if (!left.value.length) error.value = e instanceof Error ? e.message : '首页加载失败'
  } finally {
    loading.value = false
  }
}

watch(apiKey, () => {
  void load()
  if (homeMounted) {
    if (apiKey.value) void chat.connect()
    else chat.disconnect()
  }
}, { immediate: true })

function views(a: ArticleSummary) {
  return a.articleViewCntDisplayFormat || a.articleViewCount || ''
}

function heat(a: ArticleSummary) {
  return a.articleHeat ?? a.articleCommentCount ?? views(a)
}

function avatarOf(u: RankUser | LiteUser) {
  return avatarUrl(u)
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

function chatPreview(item: ChatHistoryItem) {
  if (typeof item.content === 'string') return stripHtml(item.content, 80)
  if (item.content && typeof item.content === 'object') return '[红包]'
  return ''
}

function chatAvatar(item: ChatHistoryItem) {
  return avatarUrl(item)
}

async function postChat() {
  const content = chatDraft.value.trim()
  if (!content || !apiKey.value || chatBusy.value) return
  chatBusy.value = true
  chatMsg.value = ''
  try {
    await sendChat(apiKey.value, content)
    chatDraft.value = ''
    const [chats, onlineSnap] = await Promise.all([
      safe(fetchChatHistory(apiKey.value, 1), []),
      safe(fetchChatOnlineUsers(apiKey.value), {}),
    ])
    chatLines.value = chats.slice(0, 10)
    onlineChatCnt.value = typeof onlineSnap.onlineChatCnt === 'number' ? onlineSnap.onlineChatCnt : onlineChatCnt.value
    discussing.value = onlineSnap.discussing || discussing.value
  } catch (e) {
    chatMsg.value = e instanceof Error ? e.message : '发送失败'
  } finally {
    chatBusy.value = false
  }
}

async function postMoon() {
  const content = moonDraft.value.trim()
  if (!content || !apiKey.value || moonBusy.value) return
  moonBusy.value = true
  moonMsg.value = ''
  try {
    await postBreezemoon(apiKey.value, content)
    moonDraft.value = ''
    moons.value = (await safe(fetchBreezemoons(1, 8), [])).slice(0, 8)
    moonMsg.value = '已发布'
  } catch (e) {
    moonMsg.value = e instanceof Error ? e.message : '发布失败'
  } finally {
    moonBusy.value = false
  }
}

function scrollShelf(id: string, dir: -1 | 1) {
  const el = document.getElementById(id)
  if (!el || (dir > 0 && el.matches(':hover')) || document.visibilityState !== 'visible') return
  const firstCard = el.querySelector<HTMLElement>('.long-card')
  const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0
  const step = (firstCard?.getBoundingClientRect().width || el.clientWidth) + gap
  if (dir > 0 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) {
    el.scrollTo({ left: 0, behavior: 'smooth' })
    return
  }
  el.scrollBy({ left: dir * step, behavior: 'smooth' })
}

</script>

<template>
  <div class="home" :class="{ editing }">
    <div v-if="editing" class="edit-bar" role="toolbar" aria-label="首页布局编辑">
      <span>拖动模块到任意位置：模块上下半部插入同一列，左右边缘新开一列，行间空隙新起一行</span>
      <button type="button" @click="layout.resetPositions()">恢复默认位置</button>
      <button type="button" class="green" @click="editing = false">完成</button>
    </div>
    <p v-if="usingMock" class="banner">
      匿名列表接口尚未开放，当前展示与 <code>GET /api/articles/recent</code> 对齐的 mock。
      <RouterLink v-if="!isLoggedIn" to="/login">登录</RouterLink>
      后走真实数据。
    </p>
    <p v-else-if="error" class="err">{{ error }}</p>

    <template v-for="row in layout.visibleRows" :key="row.key">
      <div
        v-if="editing"
        class="row-gap"
        :class="{ on: gapActive(row.cells[0].modules[0].id) }"
        @dragover="onGapOver($event, row.cells[0].modules[0].id)"
        @drop="onDrop"
      />
      <div class="board" :class="{ bare: isBareRow(row) }" :style="{ gridTemplateColumns: row.columns }">
        <div v-for="cell in row.cells" :key="cell.key" class="cell" :class="{ 'cell--narrow': cell.narrow }">
          <div
            v-for="mod in cell.modules"
            :key="mod.id"
            class="mod"
            :class="[edgeOf(mod.id) ? `drop-${edgeOf(mod.id)}` : '', { dragging: dragging === mod.id }]"
            :draggable="editing"
            :data-home-module="mod.id"
            :data-home-title="mod.title"
            @dragstart="onDragStart($event, mod.id)"
            @dragend="onDragEnd"
            @dragover="onModuleOver($event, mod.id)"
            @drop="onDrop"
          >
            <span v-if="editing" class="mod-badge">⠿ {{ mod.title }}</span>
            <section v-if="mod.id === 'recentA'" class="mod-body">
              <div class="index-head">
                <b>最新</b>
              </div>
              <FpLoading v-if="loading && !left.length" :rows="6" />
              <ol class="module-list">
                <li v-for="item in left" :key="item.oId">
                  <span v-if="item.articleStick" class="cb-stick" title="置顶" />
                  <RouterLink v-if="item.articleAuthorName" :to="`/member/${item.articleAuthorName}`">
                    <span
                      class="avatar-small"
                      :style="avatarStyle(item.articleAuthorThumbnailURL48)"
                      :aria-label="item.articleAuthorName"
                    />
                  </RouterLink>
                  <RouterLink class="title fn-ellipsis" :to="`/article/${item.oId}`">{{
                    articleTitle(item)
                  }}</RouterLink>
                  <span class="count">{{ views(item) }}</span>
                </li>
              </ol>
            </section>

            <section v-else-if="mod.id === 'recentB'" class="mod-body">
              <div class="index-head">
                <b>&nbsp;</b>
                <RouterLink to="/recent">更多</RouterLink>
              </div>
              <FpLoading v-if="loading && !right.length" :rows="6" />
              <ol class="module-list">
                <li v-for="item in right" :key="item.oId">
                  <RouterLink v-if="item.articleAuthorName" :to="`/member/${item.articleAuthorName}`">
                    <span
                      class="avatar-small"
                      :style="avatarStyle(item.articleAuthorThumbnailURL48)"
                      :aria-label="item.articleAuthorName"
                    />
                  </RouterLink>
                  <RouterLink class="title fn-ellipsis" :to="`/article/${item.oId}`">{{
                    articleTitle(item)
                  }}</RouterLink>
                  <span class="count">{{ views(item) }}</span>
                </li>
              </ol>
            </section>

            <aside v-else-if="mod.id === 'rank'" class="mod-body">
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
                <RouterLink to="/top/checkin">更多</RouterLink>
              </div>
              <ol class="module-list rank">
                <li v-for="(u, i) in checkin" :key="u.userName">
                  <span class="cb-stick gold"><span class="icon-pin-rank">{{ i + 1 }}</span></span>
                  <RouterLink :to="`/member/${u.userName}`">
                    <span
                      class="avatar-small"
                      :style="avatarStyle(avatarOf(u))"
                    />
                  </RouterLink>
                  <RouterLink class="title fn-ellipsis" :to="`/member/${u.userName}`">{{ u.userName }}</RouterLink>
                  <span class="count">{{ streakOf(u) }}天</span>
                </li>
              </ol>
              <div class="index-head spaced">
                <b>在线时间排行</b>
                <RouterLink to="/top/online">更多</RouterLink>
              </div>
              <ol class="module-list rank">
                <li v-for="(u, i) in online" :key="u.userName">
                  <span class="cb-stick gold"><span class="icon-pin-rank">{{ i + 1 }}</span></span>
                  <RouterLink :to="`/member/${u.userName}`">
                    <span
                      class="avatar-small"
                      :style="avatarStyle(avatarOf(u))"
                    />
                  </RouterLink>
                  <RouterLink class="title fn-ellipsis" :to="`/member/${u.userName}`">{{ u.userName }}</RouterLink>
                  <span class="count">{{ Number(u.onlineMinute || 0).toLocaleString() }} 分钟</span>
                </li>
              </ol>
            </aside>

            <section v-else-if="mod.id === 'long'" class="long-zone">
              <div class="long-head">
                <div class="long-heading">
                  <b>长篇专区</b>
                  <span>发现值得追更的故事</span>
                </div>
                <RouterLink to="/column">全部专栏 <span aria-hidden="true">›</span></RouterLink>
              </div>

              <div class="long-tabs" role="tablist" aria-label="长篇专栏分类">
                <button
                  type="button"
                  role="tab"
                  :aria-selected="activeLongShelf === 'recent'"
                  :class="{ active: activeLongShelf === 'recent' }"
                  @click="activeLongShelf = 'recent'"
                >最近更新</button>
                <button
                  type="button"
                  role="tab"
                  :aria-selected="activeLongShelf === 'hot'"
                  :class="{ active: activeLongShelf === 'hot' }"
                  @click="activeLongShelf = 'hot'"
                >热门专栏</button>
                <div class="long-nav">
                  <button type="button" aria-label="向左滚动专栏" @click="scrollShelf('long-active', -1)">‹</button>
                  <button type="button" aria-label="向右滚动专栏" @click="scrollShelf('long-active', 1)">›</button>
                </div>
              </div>
              <div id="long-active" class="long-shelf">
                <template v-if="activeColumnsShelf.length">
                  <article v-for="col in activeColumnsShelf" :key="activeLongShelf + '-' + col.columnId" class="long-card column">
                    <RouterLink class="long-cover" :to="`/column/${col.columnId}`" :aria-label="`阅读专栏：${col.columnTitle}`">
                      <img :src="col.columnCoverURL || defaultColumnCover" alt="" loading="lazy">
                    </RouterLink>
                    <div class="long-copy">
                      <RouterLink class="long-title" :to="`/column/${col.columnId}`">{{ col.columnTitle }}</RouterLink>
                      <RouterLink
                        v-if="col.latestChapter?.articleId"
                        class="long-summary"
                        :to="`/article/${col.latestChapter.articleId}`"
                      >{{ col.latestChapter.preview || col.latestChapter.title }}</RouterLink>
                      <p v-else class="long-summary">{{ col.latestChapter?.title || '持续更新中' }}</p>
                      <div class="long-meta">
                        <span>{{ activeLongShelf === 'recent' ? '最近更新' : '热门连载' }}</span>
                        <span>{{ col.columnArticleCount }} 章</span>
                      </div>
                    </div>
                  </article>
                </template>
                <template v-else>
                  <article v-for="item in activeArticlesShelf" :key="activeLongShelf + '-' + item.oId" class="long-card">
                    <RouterLink class="long-cover" :to="`/article/${item.oId}`" :aria-label="`阅读：${articleTitle(item)}`">
                      <img :src="defaultColumnCover" alt="" loading="lazy">
                    </RouterLink>
                    <div class="long-copy">
                      <RouterLink class="long-title" :to="`/article/${item.oId}`">{{ articleTitle(item) }}</RouterLink>
                      <p class="long-summary">{{ item.articlePreviewContent || item.articleTitle }}</p>
                      <div class="long-meta">
                        <RouterLink v-if="item.articleAuthorName" :to="`/member/${item.articleAuthorName}`">{{ item.articleAuthorName }}</RouterLink>
                        <span v-else>长篇连载</span>
                        <span>{{ activeLongShelf === 'hot' ? `热度 ${heat(item)}` : item.timeAgo || '最近更新' }}</span>
                      </div>
                    </div>
                  </article>
                </template>
                <p v-if="!activeColumnsShelf.length && !activeArticlesShelf.length && !loading" class="hint long-empty">暂无内容</p>
              </div>
            </section>
            <section v-else-if="mod.id === 'chat'" class="mod-body">
              <div class="index-head">
                <b>
                  聊天室
                  <span v-if="onlineChatCnt != null" class="online">({{ onlineChatCnt }}人在线)</span>
                </b>
                <RouterLink to="/cr">进入完整版聊天室</RouterLink>
              </div>
              <p v-if="discussing" class="discuss">当前话题：{{ discussing }}</p>
              <div class="chat-form">
                <input
                  v-model="chatDraft"
                  type="text"
                  maxlength="512"
                  :placeholder="isLoggedIn ? '说点什么...' : '登录后发言'"
                  :disabled="!isLoggedIn || chatBusy"
                  @keydown.enter.prevent="postChat"
                />
                <button v-if="isLoggedIn" type="button" class="green" :disabled="chatBusy || !chatDraft.trim()" @click="postChat">
                  发送
                </button>
                <RouterLink v-else class="green-link" to="/login">登录</RouterLink>
              </div>
              <p v-if="chatMsg" class="hint">{{ chatMsg }}</p>
              <ol class="module-list chat-list">
                <li v-for="m in chatLines" :key="m.oId" class="chat-item">
                  <RouterLink v-if="m.userName" :to="`/member/${m.userName}`">
                    <span
                      class="avatar-mid"
                      :style="avatarStyle(chatAvatar(m))"
                      :aria-label="m.userName"
                    />
                  </RouterLink>
                  <div class="chat-body">
                    <RouterLink v-if="m.userName" class="chat-who" :to="`/member/${m.userName}`">
                      <VipNickname :user-name="m.userName">{{ m.userNickname || m.userName }}</VipNickname>
                      <span v-if="m.userNickname && m.userName" class="chat-uname">({{ m.userName }})</span>
                    </RouterLink>
                    <div class="chat-text">{{ chatPreview(m) }}</div>
                  </div>
                </li>
                <li v-if="!chatLines.length && !loading" class="hint-li">暂无消息，去聊天室看看</li>
              </ol>
            </section>

            <section v-else-if="mod.id === 'hotQna'" class="mod-body">
              <div class="index-head">
                <b class="hot-switch">
                  <button type="button" :class="{ on: hotMode === 'hot' }" @click="hotMode = 'hot'">热议</button>
                  <span class="sep">|</span>
                  <button type="button" :class="{ on: hotMode === 'column' }" @click="hotMode = 'column'">专栏</button>
                </b>
                <RouterLink :to="hotMode === 'hot' ? '/hot' : '/column'">更多</RouterLink>
              </div>
              <ol class="module-list">
                <li v-for="item in hotPanel" :key="item.oId">
                  <RouterLink v-if="item.articleAuthorName" :to="`/member/${item.articleAuthorName}`">
                    <span
                      class="avatar-small"
                      :style="avatarStyle(item.articleAuthorThumbnailURL48)"
                    />
                  </RouterLink>
                  <RouterLink class="title fn-ellipsis" :to="`/article/${item.oId}`">{{
                    articleTitle(item)
                  }}</RouterLink>
                  <span class="count heat">🔥 {{ heat(item) }}</span>
                </li>
                <li v-if="!hotPanel.length && !loading" class="hint-li">暂无内容</li>
              </ol>
            </section>

            <aside v-else-if="mod.id === 'community'" class="mod-body">
              <HomeRepeaterStation :initial="repeaterItems" />

              <div class="index-head spaced-sm">
                <b>最新注册</b>
                <RouterLink v-if="welcomeUser" :to="`/member/${welcomeUser.userName}`" class="welcome">
                  欢迎新人 <b>{{ welcomeUser.userNickname || welcomeUser.userName }}</b>
                </RouterLink>
              </div>
              <div class="recent-reg-avatars">
                <RouterLink
                  v-for="u in regGrid"
                  :key="u.oId || u.userName"
                  :to="`/member/${u.userName}`"
                  class="reg-avatar-link"
                  :title="u.userNickname ? `${u.userNickname} (@${u.userName})` : u.userName"
                >
                  <span
                    class="avatar-tile"
                    :style="avatarStyle(avatarOf(u))"
                  />
                </RouterLink>
                <span v-if="!recentUsers.length && !loading" class="hint">暂无最新注册</span>
              </div>

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
              <RouterLink to="/breezemoons" title="清风明月是什么？">更多</RouterLink>
            </div>
            <div class="moon-form">
              <input
                v-model="moonDraft"
                type="text"
                maxlength="128"
                :placeholder="isLoggedIn ? '清风明月' : '登录后发布清风明月'"
                :disabled="!isLoggedIn || moonBusy"
                @keydown.enter.prevent="postMoon"
              />
              <button v-if="isLoggedIn" type="button" class="green" :disabled="moonBusy || !moonDraft.trim()" @click="postMoon">
                发布
              </button>
              <RouterLink v-else class="green-link" to="/login">登录</RouterLink>
            </div>
            <p v-if="moonMsg" class="hint moon-msg">{{ moonMsg }}</p>
            <ul class="moons">
              <li v-for="m in moons" :key="m.oId">
                <RouterLink v-if="m.breezemoonAuthorName" class="who" :to="`/member/${m.breezemoonAuthorName}`">
                  {{ m.breezemoonAuthorName }}
                </RouterLink>
                <span>{{ stripHtml(m.breezemoonContent || '') }}</span>
              </li>
              <li v-if="!moons.length && !loading" class="hint-li">暂无动态</li>
            </ul>
            </aside>
            <HomeSideWidgets v-else-if="mod.sidebarId" :modules="[mod]" />
          </div>
        </div>
      </div>
    </template>
    <div v-if="editing" class="row-gap end" :class="{ on: gapActive(null) }" @dragover="onGapOver($event, null)" @drop="onDrop">
      拖到这里新起一行
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
  gap: 18px;
}
.edit-bar {
  position: sticky;
  top: 60px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--fp-link);
  border-radius: 10px;
  background: color-mix(in srgb, var(--fp-card) 92%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: var(--fp-card-shadow);
  font-size: 13px;
  color: var(--fp-text);
}
.edit-bar span {
  flex: 1;
  min-width: 0;
}
.edit-bar button {
  border: 1px solid var(--fp-border);
  border-radius: 6px;
  background: var(--fp-card);
  color: var(--fp-text);
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}
.edit-bar button.green {
  border-color: transparent;
  background: var(--fp-primary);
  color: #fff;
}
.board {
  display: grid;
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  border: 1px solid var(--fp-border);
  padding: 16px 14px 20px;
  border-radius: 8px;
}
.board.bare {
  display: block;
  background: transparent;
  box-shadow: none;
  border: 0;
  padding: 0;
}
.cell {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  padding: 0 10px;
}
.board.bare .cell {
  padding: 0;
}
.cell:not(:last-child) {
  border-right: 1px solid var(--fp-border);
}
.mod {
  position: relative;
  min-width: 0;
}
/* 列内最后一个模块撑满剩余高度，列表均匀铺开，避免与相邻列高度不齐时底部留白 */
.mod:last-child {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.mod:last-child > .mod-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}
/* 仅「最新」两栏把列表行距拉开；热议/专栏等保持自然高度，底部留白 */
.mod[data-home-module='recentA']:last-child > .mod-body > .module-list:last-child,
.mod[data-home-module='recentB']:last-child > .mod-body > .module-list:last-child {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.home.editing .mod {
  cursor: grab;
  border-radius: 8px;
  outline: 1px dashed color-mix(in srgb, var(--fp-link) 55%, transparent);
  outline-offset: 4px;
}
.home.editing .mod > :not(.mod-badge) {
  pointer-events: none;
  user-select: none;
}
.home.editing .mod.dragging {
  opacity: 0.35;
}
.mod-badge {
  position: absolute;
  top: -12px;
  left: 6px;
  z-index: 2;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--fp-link);
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  pointer-events: none;
}
.mod::after {
  content: '';
  position: absolute;
  z-index: 3;
  border-radius: 3px;
  background: var(--fp-link);
  pointer-events: none;
  opacity: 0;
}
.mod.drop-top::after,
.mod.drop-bottom::after {
  left: 0;
  right: 0;
  height: 4px;
  opacity: 1;
}
.mod.drop-top::after {
  top: -10px;
}
.mod.drop-bottom::after {
  bottom: -10px;
}
.mod.drop-left::after,
.mod.drop-right::after {
  top: 0;
  bottom: 0;
  width: 4px;
  opacity: 1;
}
.mod.drop-left::after {
  left: -12px;
}
.mod.drop-right::after {
  right: -12px;
}
.row-gap {
  height: 14px;
  margin: -16px 0;
  border-radius: 8px;
  transition:
    height 0.15s,
    background-color 0.15s;
}
.row-gap.on {
  height: 40px;
  margin: -6px 0;
  background: color-mix(in srgb, var(--fp-link) 18%, transparent);
  outline: 2px dashed var(--fp-link);
}
.row-gap.end {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  margin: 0;
  border: 1px dashed var(--fp-border);
  color: var(--fp-muted);
  font-size: 12px;
}
.row-gap.end.on {
  color: var(--fp-link);
}
.index-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--fp-border);
  padding: 4px 6px 8px;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--fp-head);
  gap: 8px;
}
.index-head.spaced {
  margin-top: 20px;
}
.index-head.spaced-sm {
  margin-top: 14px;
}
.index-head b {
  font-size: 14px;
  font-weight: 600;
  color: var(--fp-title);
}
.index-head a {
  color: var(--fp-link);
  font-size: 12px;
  text-decoration: none;
  flex-shrink: 0;
}
.index-head a:hover {
  text-decoration: underline;
}
.online {
  font-weight: normal;
  font-size: 12px;
  color: var(--fp-muted);
  margin-left: 4px;
}
.discuss {
  margin: 0 8px 10px;
  font-size: 12px;
  color: var(--fp-muted);
}
.welcome {
  font-size: 12px;
  color: var(--fp-muted) !important;
}
.welcome b {
  color: var(--fp-title);
  font-weight: 600;
}
.hot-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.hot-switch button {
  border: 0;
  background: transparent;
  color: var(--fp-muted);
  cursor: pointer;
  padding: 0;
  font-size: 14px;
  font-weight: 600;
  transition: color 0.15s ease;
}
.hot-switch button.on {
  color: var(--fp-title);
}
.hot-switch .sep {
  color: var(--fp-border);
  font-weight: normal;
}
.module-list,
.moons {
  list-style: none;
  margin: 0;
  padding: 0;
}
.module-list li,
.moons li {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  min-height: 36px;
  font-size: 14px;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}
.module-list li:hover,
.moons li:hover {
  background-color: var(--fp-hover);
}
.module-list.rank li {
  padding-left: 20px;
}
.hint-li {
  color: var(--fp-muted);
  font-size: 13px;
  padding: 12px 8px;
}
.title {
  flex: 1;
  color: var(--fp-title);
  text-decoration: none;
  min-width: 0;
  font-size: 14px;
}
.title:hover {
  text-decoration: underline;
}
.count {
  color: var(--fp-muted);
  font-size: 12px;
  margin-left: auto;
  flex-shrink: 0;
  background: var(--fp-hover);
  padding: 1px 6px;
  border-radius: 9px;
}
.count.heat {
  color: var(--fp-accent);
  background: transparent;
}
.download {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 4px 6px 14px;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--fp-title);
  background: var(--fp-hover);
  border: 1px solid var(--fp-border);
  border-radius: 6px;
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
.green:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.recent-reg-avatars {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 5px;
  padding: 4px 8px 12px;
}

.reg-avatar-link {
  display: block;
  line-height: 0;
  transition: transform 0.15s ease;
}

.reg-avatar-link:hover {
  transform: scale(1.12);
}

.avatar-tile {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 4px;
  background-size: cover;
  background-position: center;
  background-color: var(--fp-border);
  border: 1px solid var(--fp-border);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
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
  word-break: break-all;
  overflow-wrap: anywhere;
}
.moons li span {
  word-break: break-all;
  overflow-wrap: anywhere;
}
.moons .who {
  color: var(--fp-link);
  text-decoration: none;
  font-size: 12px;
}

.long-zone {
  --long-gutter: 20px;
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  border-radius: 10px;
  padding: 16px 0 18px;
}
.long-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 var(--long-gutter) 16px;
  font-size: 13px;
  color: var(--fp-head);
}
.long-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.long-head b {
  font-weight: 700;
  font-size: 16px;
  color: var(--fp-title);
}
.long-heading > span {
  color: var(--fp-muted);
  font-size: 12px;
}
.long-head a {
  color: var(--fp-link);
  text-decoration: none;
}
.long-head a span {
  font-size: 17px;
  vertical-align: -1px;
}
.long-tabs {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 7px;
  margin: 0 var(--long-gutter) 10px;
}
.long-tabs [role='tab'] {
  min-height: 28px;
  padding: 3px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--fp-muted);
  font-size: 12px;
  cursor: pointer;
}
.long-tabs [role='tab'].active {
  border-color: var(--fp-border);
  background: var(--fp-hover);
  color: var(--fp-title);
  font-weight: 600;
}
.long-nav {
  display: flex;
  gap: 5px;
  margin-left: auto;
}
.long-nav button {
  width: 27px;
  height: 25px;
  border: 1px solid var(--fp-border);
  border-radius: 5px;
  background: var(--fp-card);
  color: var(--fp-muted);
  cursor: pointer;
}
.long-nav button:hover {
  background: var(--fp-hover);
}
.long-shelf {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  padding: 0 var(--long-gutter) 7px;
  scroll-padding-inline: var(--long-gutter);
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  scrollbar-width: none;
  overscroll-behavior-inline: contain;
}
.long-shelf::-webkit-scrollbar {
  display: none;
}
.long-card {
  display: grid;
  flex: 0 0 calc((100% - 42px) / 4);
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-width: 0;
  min-height: 120px;
  padding: 8px 10px 8px 0;
  border-right: 1px solid var(--fp-border);
  scroll-snap-align: start;
}
.long-cover {
  display: block;
  width: 72px;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border-radius: 2px;
  background: var(--fp-hover);
  text-decoration: none;
  box-shadow: 0 3px 10px rgb(0 0 0 / 15%);
}
.long-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.long-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  align-self: stretch;
}
.long-title {
  display: -webkit-box;
  color: var(--fp-title);
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  line-height: 1.4;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.long-summary {
  display: -webkit-box;
  overflow: hidden;
  margin: 9px 0 0;
  color: var(--fp-muted);
  font-size: 13px;
  line-height: 1.6;
  text-decoration: none;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.long-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 9px;
  font-size: 12px;
  color: var(--fp-muted);
}
.long-meta a {
  color: var(--fp-muted);
  text-decoration: none;
}
.long-empty {
  flex: 0 0 100%;
  padding: 18px 0;
}
.moon-form {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0 15px 6px;
}
.moon-form input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--fp-border);
  background: var(--fp-search-bg);
  color: var(--fp-text);
  border-radius: 4px;
  padding: 6px 10px;
  height: 32px;
}
.moon-form .green {
  margin-left: 0;
}
.moon-msg {
  margin: 0 15px 6px;
}

.chat-form {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0 15px 8px;
}
.chat-form input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--fp-border);
  background: var(--fp-search-bg);
  color: var(--fp-text);
  border-radius: 4px;
  padding: 6px 10px;
  height: 32px;
}
.chat-form .green {
  margin-left: 0;
}
.green-link {
  color: var(--fp-green);
  text-decoration: none;
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
}
.chat-list .chat-item {
  align-items: flex-start;
}
.avatar-mid {
  display: inline-block;
  width: 36px;
  height: 36px;
  border-radius: 3px;
  background: var(--fp-border) center/cover no-repeat;
  flex-shrink: 0;
}
.chat-body {
  min-width: 0;
  flex: 1;
}
.chat-who {
  font-size: 12px;
  color: var(--fp-muted);
  text-decoration: none;
}
.chat-uname {
  opacity: 0.75;
}
.chat-text {
  margin-top: 2px;
  font-size: 13px;
  color: var(--fp-title);
  line-height: 1.4;
  word-break: break-word;
}

@media (max-width: 960px) {
  .board {
    grid-template-columns: minmax(0, 1fr) !important;
    padding: 12px 10px;
    gap: 12px;
  }
  .cell {
    padding: 0;
  }
  .cell:not(:last-child) {
    border-right: none;
    border-bottom: 1px solid var(--fp-border);
    padding-bottom: 14px;
    margin-bottom: 8px;
  }
  .long-zone {
    --long-gutter: 14px;
  }
  .long-card {
    flex-basis: calc((100% - 28px) / 3);
  }
  .long-card {
    flex-basis: calc((100% - 28px) / 3);
  }
  .long-heading > span {
    display: none;
  }
}

@media (max-width: 680px) {
  .long-card {
    flex-basis: 82%;
    min-height: 112px;
  }
  .long-cover {
    width: 68px;
  }
}
</style>
