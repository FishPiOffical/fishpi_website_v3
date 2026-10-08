<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchArticleFeed,
  fetchBreezemoons,
  fetchChatHistory,
  fetchChatOnlineUsers,
  fetchCheckinRank,
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
  type LiteUser,
  type RankUser,
  type RepeaterItem,
  type TagItem,
} from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import { useHomeLayoutStore } from '@/stores/homeLayout'
import AdSlot from '@/components/ads/AdSlot.vue'
import CheckinPanel from '@/components/home/CheckinPanel.vue'
import HomePersonalize from '@/components/home/HomePersonalize.vue'
import HomeRepeaterStation from '@/components/home/HomeRepeaterStation.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { consumeFeedPayload, consumeHomeExtrasPayload } from '@/seo/payload'
import { SITE_DEFAULT_DESC, SITE_NAME } from '@/seo/site'

const auth = useAuthStore()
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
const topModules = computed(() => layout.modulesIn('top'))
const longModules = computed(() => layout.modulesIn('long'))
const midModules = computed(() => layout.modulesIn('middle'))
/** Live long zone: 最近更新 + 热门专栏 (column JSON 未开放时用长篇/热议帖近似). */
const longRecentShelf = computed(() => longArticles.value.slice(0, 8))
const longHotShelf = computed(() => {
  const withCol = hot.value.filter((a) => a.columnTitle)
  if (withCol.length) return withCol.slice(0, 8)
  return (hot.value.length ? hot.value : longArticles.value).slice(0, 8)
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
  if (bootExtra.recentUsers?.length) recentUsers.value = bootExtra.recentUsers.slice(0, 12)
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

async function load() {
  error.value = ''
  const needArticles = left.value.length === 0
  if (needArticles) loading.value = true
  try {
    const [articles, checkinRank, onlineRank, hotList, longList, regs, tagData, breezes, chats, reps, onlineSnap] =
      await Promise.all([
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
      ])
    if (needArticles) splitArticles(articles)
    checkin.value = checkinRank.slice(0, 8)
    online.value = onlineRank.slice(0, 8)
    hot.value = hotList.slice(0, 12)
    longArticles.value = longList.slice(0, 12)
    recentUsers.value = regs.slice(0, 12)
    tags.value = tagData.tags.slice(0, 24)
    moons.value = breezes.slice(0, 8)
    chatLines.value = chats.slice(0, 10)
    repeaterItems.value = reps
    onlineChatCnt.value = typeof onlineSnap.onlineChatCnt === 'number' ? onlineSnap.onlineChatCnt : null
    discussing.value = onlineSnap.discussing || ''
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

function heat(a: ArticleSummary) {
  return a.articleHeat ?? a.articleCommentCount ?? views(a)
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

function chatPreview(item: ChatHistoryItem) {
  if (typeof item.content === 'string') return stripHtml(item.content, 80)
  if (item.content && typeof item.content === 'object') return '[红包]'
  return ''
}

function chatAvatar(item: ChatHistoryItem) {
  return item.userAvatarURL || ''
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
  if (!el) return
  el.scrollBy({ left: dir * 240, behavior: 'smooth' })
}
</script>

<template>
  <div class="home">
    <HomePersonalize />
    <p v-if="usingMock" class="banner">
      匿名列表接口尚未开放，当前展示与 <code>GET /api/articles/recent</code> 对齐的 mock。
      <RouterLink v-if="!isLoggedIn" to="/login">登录</RouterLink>
      后走真实数据。
    </p>
    <p v-else-if="error" class="err">{{ error }}</p>

    <div v-if="topModules.length" class="board zone-top" data-home-zone="top">
      <template v-for="mod in topModules" :key="mod.id">
        <section v-if="mod.id === 'recentA'" class="col" data-home-module="recentA" data-home-title="最新一">
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
                  :style="
                    item.articleAuthorThumbnailURL48
                      ? { backgroundImage: `url('${item.articleAuthorThumbnailURL48}')` }
                      : undefined
                  "
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

        <section v-else-if="mod.id === 'recentB'" class="col" data-home-module="recentB" data-home-title="最新二">
          <div class="index-head">
            <b>&nbsp;</b>
            <RouterLink to="/recent">更多</RouterLink>
          </div>
          <p v-if="loading && !right.length" class="hint">加载中…</p>
          <ol class="module-list">
            <li v-for="item in right" :key="item.oId">
              <RouterLink v-if="item.articleAuthorName" :to="`/member/${item.articleAuthorName}`">
                <span
                  class="avatar-small"
                  :style="
                    item.articleAuthorThumbnailURL48
                      ? { backgroundImage: `url('${item.articleAuthorThumbnailURL48}')` }
                      : undefined
                  "
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

        <aside v-else-if="mod.id === 'rank'" class="col side" data-home-module="rank" data-home-title="排行">
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
                  :style="avatarOf(u) ? { backgroundImage: `url('${avatarOf(u)}')` } : undefined"
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
                  :style="avatarOf(u) ? { backgroundImage: `url('${avatarOf(u)}')` } : undefined"
                />
              </RouterLink>
              <RouterLink class="title fn-ellipsis" :to="`/member/${u.userName}`">{{ u.userName }}</RouterLink>
              <span class="count">{{ Number(u.onlineMinute || 0).toLocaleString() }} 分钟</span>
            </li>
          </ol>
        </aside>

      </template>
    </div>

    <template v-for="mod in longModules" :key="'long-' + mod.id">
      <section v-if="mod.id === 'long'" class="long-zone" data-home-module="long" data-home-title="长篇专区">
        <div class="long-head">
          <b>长篇专区</b>
          <RouterLink to="/column">更多</RouterLink>
        </div>

        <div class="long-row">
          <div class="long-row-head">
            <span class="badge">最近更新</span>
            <div class="long-nav">
              <button type="button" aria-label="向左滚动" @click="scrollShelf('long-recent', -1)">‹</button>
              <button type="button" aria-label="向右滚动" @click="scrollShelf('long-recent', 1)">›</button>
            </div>
          </div>
          <div id="long-recent" class="long-shelf">
            <article v-for="item in longRecentShelf" :key="item.oId" class="long-card">
              <RouterLink class="long-title" :to="`/article/${item.oId}`">{{
                item.articleTitleEmoj || item.articleTitle
              }}</RouterLink>
              <div class="long-meta">
                <span v-if="item.columnTitle">{{ item.columnTitle }}</span>
                <RouterLink v-else-if="item.articleAuthorName" :to="`/member/${item.articleAuthorName}`">
                  {{ item.articleAuthorName }}
                </RouterLink>
                <span>{{ views(item) }}</span>
              </div>
            </article>
            <p v-if="!longRecentShelf.length && !loading" class="hint long-empty">暂无长篇</p>
          </div>
        </div>

        <div class="long-row">
          <div class="long-row-head">
            <span class="badge hot">热门专栏</span>
            <div class="long-nav">
              <button type="button" aria-label="向左滚动" @click="scrollShelf('long-hot', -1)">‹</button>
              <button type="button" aria-label="向右滚动" @click="scrollShelf('long-hot', 1)">›</button>
            </div>
          </div>
          <div id="long-hot" class="long-shelf">
            <article v-for="item in longHotShelf" :key="'hot-' + item.oId" class="long-card hot">
              <RouterLink class="long-title" :to="`/article/${item.oId}`">{{
                item.articleTitleEmoj || item.articleTitle
              }}</RouterLink>
              <div class="long-meta">
                <span v-if="item.columnTitle">{{ item.columnTitle }}</span>
                <RouterLink v-else-if="item.articleAuthorName" :to="`/member/${item.articleAuthorName}`">
                  {{ item.articleAuthorName }}
                </RouterLink>
                <span class="heat">🔥 {{ heat(item) }}</span>
              </div>
            </article>
            <p v-if="!longHotShelf.length && !loading" class="hint long-empty">暂无热门</p>
          </div>
        </div>
      </section>
    </template>

    <div v-if="midModules.length" class="board zone-mid" data-home-zone="middle">
      <template v-for="mod in midModules" :key="mod.id">
        <section v-if="mod.id === 'chat'" class="col" data-home-module="chat" data-home-title="聊天室">
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
                  :style="chatAvatar(m) ? { backgroundImage: `url('${chatAvatar(m)}')` } : undefined"
                  :aria-label="m.userName"
                />
              </RouterLink>
              <div class="chat-body">
                <RouterLink v-if="m.userName" class="chat-who" :to="`/member/${m.userName}`">
                  {{ m.userNickname || m.userName }}
                  <span v-if="m.userNickname && m.userName" class="chat-uname">({{ m.userName }})</span>
                </RouterLink>
                <div class="chat-text">{{ chatPreview(m) }}</div>
              </div>
            </li>
            <li v-if="!chatLines.length && !loading" class="hint-li">暂无消息，去聊天室看看</li>
          </ol>
        </section>

        <section v-else-if="mod.id === 'hotQna'" class="col" data-home-module="hotQna" data-home-title="热议问答">
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
                  :style="
                    item.articleAuthorThumbnailURL48
                      ? { backgroundImage: `url('${item.articleAuthorThumbnailURL48}')` }
                      : undefined
                  "
                />
              </RouterLink>
              <RouterLink class="title fn-ellipsis" :to="`/article/${item.oId}`">{{
                item.articleTitleEmoj || item.articleTitle
              }}</RouterLink>
              <span class="count heat">🔥 {{ heat(item) }}</span>
            </li>
            <li v-if="!hotPanel.length && !loading" class="hint-li">暂无内容</li>
          </ol>
        </section>

        <aside v-else-if="mod.id === 'community'" class="col side" data-home-module="community" data-home-title="社区">
          <HomeRepeaterStation :initial="repeaterItems" />

          <div class="index-head spaced-sm">
            <b>最新注册</b>
            <RouterLink v-if="welcomeUser" :to="`/member/${welcomeUser.userName}`" class="welcome">
              欢迎新人 <b>{{ welcomeUser.userNickname || welcomeUser.userName }}</b>
            </RouterLink>
          </div>
          <ul class="people">
            <li v-for="u in recentUsers" :key="u.oId || u.userName">
              <RouterLink :to="`/member/${u.userName}`">
                <span
                  class="avatar-mid"
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

      </template>
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
  align-items: baseline;
  font-size: 13px;
  margin: 5px 10px 10px;
  color: var(--fp-head);
  gap: 8px;
}
.index-head.spaced {
  margin-top: 18px;
}
.index-head.spaced-sm {
  margin-top: 12px;
}
.index-head b {
  font-weight: 700;
  color: var(--fp-head);
}
.index-head a {
  color: var(--fp-link);
  text-decoration: none;
  flex-shrink: 0;
}
.online {
  font-weight: 500;
  color: var(--fp-muted);
  margin-left: 2px;
}
.discuss {
  margin: 0 15px 8px;
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
  font-weight: 700;
}
.hot-switch button {
  border: 0;
  background: transparent;
  color: var(--fp-muted);
  cursor: pointer;
  padding: 0;
  font-weight: 700;
}
.hot-switch button.on {
  color: var(--fp-head);
}
.hot-switch .sep {
  color: var(--fp-border);
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
.count.heat {
  color: var(--fp-accent);
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
.green:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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

.long-zone {
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  border-radius: 10px;
  padding: 12px 0 16px;
}
.long-head {
  display: flex;
  justify-content: space-between;
  margin: 5px 16px 8px;
  font-size: 13px;
  color: var(--fp-head);
}
.long-head b {
  font-weight: 700;
}
.long-head a {
  color: var(--fp-link);
  text-decoration: none;
}
.long-row {
  margin-top: 8px;
}
.long-row-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 16px 8px;
}
.badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  color: var(--fp-head);
  background: var(--fp-hover);
  border: 1px solid var(--fp-border);
  border-radius: 4px;
  padding: 2px 8px;
}
.badge.hot {
  color: var(--fp-accent);
}
.long-nav {
  display: flex;
  gap: 4px;
}
.long-nav button {
  width: 28px;
  height: 24px;
  border: 1px solid var(--fp-border);
  background: var(--fp-hover);
  color: var(--fp-text);
  border-radius: 4px;
  cursor: pointer;
  line-height: 1;
}
.long-shelf {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 0 16px 4px;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
}
.long-card {
  flex: 0 0 220px;
  scroll-snap-align: start;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  padding: 12px;
  background: var(--fp-hover);
}
.long-card.hot {
  border-color: rgba(210, 63, 49, 0.25);
}
.long-title {
  display: block;
  color: var(--fp-title);
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  line-height: 1.4;
  max-height: 2.8em;
  overflow: hidden;
}
.long-title:hover {
  color: var(--fp-link);
}
.long-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--fp-muted);
}
.long-meta a {
  color: var(--fp-link);
  text-decoration: none;
}
.long-meta .heat {
  color: var(--fp-accent);
}
.long-empty {
  padding: 8px 0;
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
    flex-direction: column;
  }
  .long-card {
    flex-basis: 180px;
  }
}
</style>
