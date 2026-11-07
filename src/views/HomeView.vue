<script setup lang="ts">
import HomePreferenceRedirect from '@/components/home/HomePreferenceRedirect.vue'
import RecentMembers from '@/components/discovery/RecentMembers.vue'
import RankingBoard from '@/components/RankingBoard.vue'
import HomeReadStatus from '@/components/home/HomeReadStatus.vue'
import { consumeHomeRankingPayload, consumeHomeReadsPayload, consumeRepeaterPayload } from '@/seo/payload'
import { getAuthContextVersion } from '@/api/http'
import { useHomeRead } from '@/composables/useHomeRead'
import VipNickname from '@/components/user/VipNickname.vue'
import ChatPublicationRecovery from '@/components/chat/ChatPublicationRecovery.vue'
import { useV3ChatPublicationStore } from '@/stores/v3ChatPublication'
import BreezemoonPanel from '@/components/breezemoons/BreezemoonPanel.vue'
import { articleTitle, decodeEntities } from '@/utils/text'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import type { ArticleSummary, ChatHistoryItem, TagItem } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useHomeLayoutStore, type HomeRowView } from '@/stores/homeLayout'
import { useHomeDrag } from '@/home/useHomeDrag'
import PersonInfoCard from '@/components/sidebar/PersonInfoCard.vue'
import CheckinPanel from '@/components/home/CheckinPanel.vue'
import HomeSideWidgets from '@/components/home/HomeSideWidgets.vue'
import HomeRepeaterStation from '@/components/home/HomeRepeaterStation.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { SITE_DEFAULT_DESC, SITE_NAME } from '@/seo/site'
import { chatAppearanceSnapshot } from '@/utils/chatAppearance'
import { avatarStyle, avatarUrl } from '@/utils/avatar'

const auth = useAuthStore(), chat = useChatStore(), publication = useV3ChatPublicationStore(), layout = useHomeLayoutStore()
const { accessToken, isLoggedIn } = storeToRefs(auth)
const boot = consumeHomeReadsPayload()
const recentRead = useHomeRead('recent', boot.recent), hotRead = useHomeRead('hot', boot.hot), tagsRead = useHomeRead('tags', boot.tags)
const columnsRecentRead = useHomeRead('columnsRecent', boot.columnsRecent), columnsHotRead = useHomeRead('columnsHot', boot.columnsHot)
const homeReady = ref(false)
onMounted(() => { homeReady.value = true })
const compactHome = computed(() => layout.mode !== 'classic')
const left = computed(() => { const rows = recentRead.data || []; return rows.slice(0, compactHome.value ? 8 : Math.ceil(rows.length / 2)) })
const right = computed(() => { const rows = recentRead.data || []; return compactHome.value ? rows.slice(8, 16) : rows.slice(Math.ceil(rows.length / 2)) })
const hot = computed(() => hotRead.data || []), tags = computed(() => tagsRead.data || [])
const repeaterItems = ref(consumeRepeaterPayload() || undefined)
const homeRanks = ref(consumeHomeRankingPayload())
onMounted(() => { homeRanks.value = { checkin: null, online: null }; repeaterItems.value = undefined })
const chatLines = ref<ChatHistoryItem[]>([]), chatDraft = ref(''), chatBusy = ref(false), chatMsg = ref('')
const onlineChatCnt = computed(() => chat.onlineTotal), discussing = computed(() => chat.discuss)
const hotMode = ref<'hot' | 'column'>('hot'), activeLongShelf = ref<'recent' | 'hot'>('recent')
const hotState = computed(() => hotMode.value === 'hot' ? hotRead : columnsRecentRead)
const activeColumnsRead = computed(() => activeLongShelf.value === 'recent' ? columnsRecentRead : columnsHotRead)
const activeColumnsShelf = computed(() => activeColumnsRead.value.data || [])
const failedCovers = ref(new Set<string>())
watch(() => [columnsRecentRead.data, columnsHotRead.data], () => { failedCovers.value = new Set() })
const { editing } = storeToRefs(layout)
const { dragging, onDragStart, onDragEnd, onModuleOver, onGapOver, onDrop, edgeOf, gapActive } = useHomeDrag()
const { messages: liveChatMessages } = storeToRefs(chat)
let homeMounted = false, longShelfTimer: ReturnType<typeof setInterval> | undefined
function syncLiveChatMessages() {
  chatLines.value = liveChatMessages.value.slice(-10).reverse().map(line => ({ appearance:line.appearance, oId: line.oId, userOId: line.userOId, userName: line.userName,
    userNickname: line.userNickname, userAvatarURL: line.userAvatarURL,
    content: line.redPacket || (line.card?.msgType === 'music' ? line.card.title || '音乐分享' : line.card ? '天气信息' : line.html || ''), time: line.time }))
}
watch(liveChatMessages, syncLiveChatMessages, { immediate: true })
watch(() => JSON.stringify([getAuthContextVersion(), !!accessToken.value, auth.account?.oId || '']), () => { chatDraft.value = ''; chatLines.value = []; chatMsg.value = '' }, { flush: 'sync' })
watch(accessToken, () => { chatLines.value = []; if (homeMounted) { if (accessToken.value) void chat.connect(); else chat.disconnect() } }, { flush: 'sync' })
onMounted(() => { homeMounted = true; if (accessToken.value) void chat.connect(); longShelfTimer = setInterval(() => scrollShelf('long-active', 1), 6000) })
onUnmounted(() => { homeMounted = false; editing.value = false; if (longShelfTimer) clearInterval(longShelfTimer); if (!chat.floatingChatroomOpen) chat.disconnect() })
function isBareRow(row: HomeRowView) { return row.cells.length === 1 && row.cells[0].modules.every(m => m.id === 'long') }
watch(activeLongShelf, async () => { await nextTick(); document.getElementById('long-active')?.scrollTo({ left: 0 }) })
usePageSeo(() => ({ title: SITE_NAME, description: SITE_DEFAULT_DESC, path: '/' }))

function views(a: ArticleSummary) {
  return a.articleViewCntDisplayFormat ?? a.articleViewCount ?? ''
}

function tagPath(tag: TagItem) {
  const uri = tag.tagURI || tag.tagTitle
  try {
    return `/tag/${encodeURIComponent(decodeURIComponent(uri))}`
  } catch {
    return `/tag/${encodeURIComponent(uri)}`
  }
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

async function postChat(){
 const content=chatDraft.value.trim()
 if(!content||!accessToken.value||chatBusy.value||publication.pending)return
 chatBusy.value=true;chatMsg.value='';const reader=JSON.stringify([getAuthContextVersion(),!!accessToken.value,auth.account?.oId||''])
 try{if(await chat.send(content)&&reader===JSON.stringify([getAuthContextVersion(),!!accessToken.value,auth.account?.oId||'']))acceptHomeChat(content)}finally{chatBusy.value=false}
}
function acceptHomeChat(content:string){if(chatDraft.value.trim()===content)chatDraft.value=''}

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
  <div class="home" :data-public-content="recentRead.data ? 'ready' : undefined" :class="{ editing, 'is-classic': !compactHome }">
    <h1 class="home-a11y-title">摸鱼派社区动态</h1>
    <HomePreferenceRedirect />
    <div v-if="editing" class="edit-bar" role="toolbar" aria-label="首页布局编辑">
      <span>拖动模块到任意位置：模块上下半部插入同一列，左右边缘新开一列，行间空隙新起一行</span>
      <button type="button" @click="layout.resetPositions()">恢复默认位置</button>
      <button type="button" class="green" @click="editing = false">完成</button>
    </div>
    <template v-for="row in layout.visibleRows" :key="row.key">
      <div
        v-if="editing"
        class="row-gap"
        :class="{ on: gapActive(row.cells[0].modules[0].id) }"
        @dragover="onGapOver($event, row.cells[0].modules[0].id)"
        @drop="onDrop"
      />
      <div class="board" :class="{ bare: isBareRow(row) }" :style="{ gridTemplateColumns: row.columns }">
        <div v-for="cell in row.cells" :key="cell.key" class="cell" :class="{ 'cell--narrow': cell.narrow, 'cell--feed': cell.modules.some(m => m.id === 'recentA') }">
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
                <RouterLink to="/recent">全部帖子</RouterLink>
              </div>
              <HomeReadStatus label="最新文章" :loading="recentRead.loading" :error="recentRead.error" :ready="recentRead.data !== null" :empty="!left.length" empty-text="暂无可见文章。" @retry="recentRead.read" />
              <ol class="module-list">
                <li v-for="item in left" :key="item.oId">
                  <span v-if="item.stick?.active" class="cb-stick" title="置顶" />
                  <RouterLink v-if="item.articleAnonymous !== 1 && item.articleAuthorId && item.articleAuthorName" :to="`/member/${encodeURIComponent(item.articleAuthorName)}`">
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
                <b>{{ compactHome ? '更多最新' : '\u00a0' }}</b>
                <RouterLink to="/recent">更多</RouterLink>
              </div>
              <HomeReadStatus label="最新文章（续）" :loading="recentRead.loading" :error="recentRead.error" :ready="recentRead.data !== null" :empty="!right.length" :empty-text="left.length ? '本列暂无文章。' : '暂无可见文章。'" @retry="recentRead.read" />
              <ol class="module-list">
                <li v-for="item in right" :key="item.oId">
                  <span v-if="item.stick?.active" class="cb-stick" title="置顶" />
                  <RouterLink v-if="item.articleAnonymous !== 1 && item.articleAuthorId && item.articleAuthorName" :to="`/member/${encodeURIComponent(item.articleAuthorName)}`">
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
              <div v-if="!compactHome" class="download"><img src="https://file.fishpi.cn/logo_app.png" width="35" height="35" alt="" /><div><b>随时随地摸鱼？</b><p>下载摸鱼派客户端，想摸就摸！</p></div><RouterLink to="/download" class="green-link">下载</RouterLink></div>
              <div v-if="compactHome && homeReady" class="home-person"><PersonInfoCard /></div>
              <CheckinPanel />
              <div class="index-head">
                <b>今日连签排行</b>
                <RouterLink to="/top/checkin">更多</RouterLink>
              </div>
              <RankingBoard type="checkin" :initial="homeRanks.checkin" compact />
              <div class="index-head spaced">
                <b>在线时间排行</b>
                <RouterLink to="/top/online">更多</RouterLink>
              </div>
              <RankingBoard type="online" :initial="homeRanks.online" compact />
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
                  <button type="button" aria-label="向左滚动专栏" :disabled="!activeColumnsShelf.length || activeColumnsRead.loading" @click="scrollShelf('long-active', -1)">‹</button>
                  <button type="button" aria-label="向右滚动专栏" :disabled="!activeColumnsShelf.length || activeColumnsRead.loading" @click="scrollShelf('long-active', 1)">›</button>
                </div>
              </div>
              <div class="long-read-state"><HomeReadStatus :label="activeLongShelf === 'recent' ? '最近更新专栏' : '热门专栏'" :loading="activeColumnsRead.loading" :error="activeColumnsRead.error" :ready="activeColumnsRead.data !== null" :empty="!activeColumnsShelf.length" empty-text="暂无可见专栏。" @retry="activeColumnsRead.read" /></div>
              <div id="long-active" class="long-shelf">
                <article v-for="col in activeColumnsShelf" :key="activeLongShelf + '-' + col.id" class="long-card column">
                  <RouterLink class="long-cover" :to="`/column/${col.id}`" :aria-label="`阅读专栏：${decodeEntities(col.title)}`">
                    <img v-if="col.coverURL && !failedCovers.has(col.id)" :src="col.coverURL" alt="" loading="lazy" @error="failedCovers.add(col.id)"><span v-else class="column-cover-placeholder" aria-hidden="true">卷</span>
                  </RouterLink>
                  <div class="long-copy">
                    <RouterLink class="long-title" :to="`/column/${col.id}`">{{ decodeEntities(col.title) }}</RouterLink>
                    <RouterLink v-if="col.chapters[0]" class="long-summary" :to="`/article/${col.chapters[0]!.id}`">{{ decodeEntities(col.chapters[0]!.preview || col.chapters[0]!.title) }}</RouterLink>
                    <div class="long-meta"><span>{{ activeLongShelf === 'recent' ? '最近更新' : '热门专栏' }}</span><span>{{ col.articleCount }} 章</span></div>
                  </div>
                </article>
              </div>
            </section>
            <section v-else-if="mod.id === 'chat'" class="mod-body">
              <div class="index-head">
                <b>
                  聊天室
                  <span v-if="onlineChatCnt != null" class="online">(本次可见{{ onlineChatCnt }}人)</span>
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
                  :disabled="!isLoggedIn || chatBusy || !!publication.pending"
                  @keydown.enter.prevent="postChat"
                />
                <button v-if="isLoggedIn" type="button" class="green" :disabled="chatBusy || !!publication.pending || !chatDraft.trim()" @click="postChat">
                  发送
                </button>
                <RouterLink v-else class="green-link" to="/login">登录</RouterLink>
              </div>
              <ChatPublicationRecovery @confirmed="acceptHomeChat" />
              <p v-if="chat.error" role="alert">{{ chat.error }} <button type="button" :disabled="chat.loading" @click="chat.refreshMessages">重读聊天室消息</button></p>
              <p v-if="chatMsg" class="hint">{{ chatMsg }}</p>
              <ol class="module-list chat-list">
                <li v-for="m in chatLines" :key="m.oId" class="chat-item fp-msg is-room" data-appearance-snapshot="v1" :data-bubble="chatAppearanceSnapshot(m.appearance).bubbleId" :data-frame="chatAppearanceSnapshot(m.appearance).frameId">
                  <RouterLink v-if="m.userName" class="fp-avatar-frame" :to="`/member/${m.userName}`">
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
                    <div class="chat-text fp-bubble">{{ chatPreview(m) }}</div>
                  </div>
                </li>
                <li v-if="!chatLines.length&&!chat.loading&&!chat.error" class="hint-li">{{ isLoggedIn?'暂无消息，去聊天室看看':'登录后可读取聊天室消息' }}</li>
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
              <HomeReadStatus :label="hotMode === 'hot' ? '热议文章' : '专栏列表'" :loading="hotState.loading" :error="hotState.error" :ready="hotState.data !== null" :empty="!hotState.data?.length" :empty-text="hotMode === 'hot' ? '暂无可见热议文章。' : '暂无可见专栏。'" @retry="hotState.read" />
              <ol v-if="hotMode === 'hot'" class="module-list">
                <li v-for="item in hot" :key="item.oId">
                  <RouterLink v-if="item.articleAnonymous !== 1 && item.articleAuthorId && item.articleAuthorName" :to="`/member/${encodeURIComponent(item.articleAuthorName)}`"><span class="avatar-small" :style="avatarStyle(item.articleAuthorThumbnailURL48)" /></RouterLink>
                  <RouterLink class="title fn-ellipsis" :to="`/article/${item.oId}`">{{ articleTitle(item) }}</RouterLink><span class="count">{{ item.articleCommentCount }} 回帖</span>
                </li>
              </ol>
              <ol v-else class="module-list"><li v-for="col in columnsRecentRead.data || []" :key="col.id"><RouterLink class="title fn-ellipsis" :to="`/column/${col.id}`">{{ decodeEntities(col.title) }}</RouterLink><span class="count">{{ col.articleCount }} 章</span></li></ol>
            </section>

            <aside v-else-if="mod.id === 'community'" class="mod-body community-body">
            <div class="home-moons"><div class="index-head spaced">
              <b>清风明月</b>
              <RouterLink to="/breezemoons" title="清风明月是什么？">更多</RouterLink>
            </div>
            <BreezemoonPanel :size="8" :preview-limit="compactHome ? 3 : undefined" compact avatar-only ssr-scope="home" /></div>
              <HomeRepeaterStation :initial="repeaterItems" />

              <RecentMembers />

              <div class="index-head spaced">
                <b>标签</b>
                <RouterLink to="/tags">更多</RouterLink>
              </div>
              <HomeReadStatus label="标签" :loading="tagsRead.loading" :error="tagsRead.error" :ready="tagsRead.data !== null" :empty="!tags.length" empty-text="暂无标签。" @retry="tagsRead.read" />
              <div class="tags">
                <RouterLink v-for="t in tags" :key="t.tagURI || t.tagTitle" :to="tagPath(t)">
                  {{ t.tagTitle }}
                </RouterLink>
              </div>

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

<style scoped lang="scss">
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
  color: var(--fp-danger);
  font-size: 13px;
}
.home {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  border-radius: var(--fp-panel-radius);
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
  gap: 10px;
  background: transparent;
  box-shadow: none;
  border: 0;
  padding: 0;
}
.mod-body {
  padding: 10px;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  box-shadow: var(--fp-card-shadow);
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
  gap: 10px;
  min-width: 0;
  padding: 0;
}
.board.bare .cell {
  padding: 0;
}
.cell:not(:last-child) {
  border-right: 0;
}
.mod {
  position: relative;
  min-width: 0;
}
/* 模块按内容自然排布，避免相邻长列将整个首屏撑高。 */
.board { align-items: start; }
.home-person { margin-bottom: 10px; }
.home-person :deep(.person-head) { margin-bottom: 8px; gap: 8px; }
.home-person :deep(.person-avatar) { width: 34px; height: 34px; }
.home-person :deep(.person-stats) { padding-top: 6px; }
.home-person :deep(.stat-col span) { display: none; }
.home-person :deep(.person-sub) { font-size: 10px; }
.home-person :deep(.guest-slogan) { margin-bottom: 8px; }
.home-person :deep(.role-tag) { display: none; }
.home :deep(.checkin-panel) { margin: 10px 0 12px; }
.home :deep(.checkin-section) { padding: 7px 8px; }
.home :deep(.breezemoon-list .moon-body) { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }

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
  padding: 2px 4px 6px;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--fp-head);
  gap: 8px;
}
.index-head.spaced {
  margin-top: 12px;
}
.index-head.spaced-sm {
  margin-top: 10px;
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
  gap: 7px;
  padding: 4px 5px;
  min-height: 26px;
  font-size: 13.5px;
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
  font-size: 12px;
  padding: 8px 6px;
}
.title {
  flex: 1;
  color: var(--fp-title);
  text-decoration: none;
  min-width: 0;
  font-size: 13.5px;
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
  gap: 6px;
  padding: 2px 4px;
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

.long-read-state { margin: 0 var(--long-gutter); }
.column-cover-placeholder { width: 100%; height: 100%; display: grid; place-items: center; font-size: 26px; color: #fff8ec; background: linear-gradient(145deg, #b38c61, #695039); }
.long-zone {
  --long-gutter: 14px;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  box-shadow: var(--fp-card-shadow);
  border-radius: 8px;
  padding: 12px 0;
}
.long-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 var(--long-gutter) 8px;
  font-size: 13px;
  color: var(--fp-head);
}
.long-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.long-head b {
  font-weight: 600;
  font-size: 14px;
  color: var(--fp-title);
}
.long-heading > span {
  color: var(--fp-muted);
  font-size: 12px;
}
.long-head a {
  color: var(--fp-link);
  font-size: 12px;
  text-decoration: none;
}
.long-head a span {
  font-size: 15px;
  vertical-align: -1px;
}
.long-tabs {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  margin: 0 var(--long-gutter) 8px;
}
.long-tabs [role='tab'] {
  min-height: 26px;
  padding: 2px 10px;
  border: 1px solid transparent;
  border-radius: 5px;
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
  width: 26px;
  height: 24px;
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
  gap: 10px;
  overflow-x: auto;
  padding: 0 var(--long-gutter) 2px;
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
  flex: 0 0 calc((100% - 10px) / 2);
  grid-template-columns: 48px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 72px;
  padding: 4px 10px 4px 0;
  border-right: 1px solid var(--fp-border);
  scroll-snap-align: start;
}
.long-cover {
  display: block;
  width: 48px;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border-radius: 3px;
  background: var(--fp-hover);
  text-decoration: none;
  box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
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
  font-size: 13.5px;
  line-height: 1.35;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}
.long-summary {
  display: -webkit-box;
  overflow: hidden;
  margin: 5px 0 0;
  color: var(--fp-muted);
  font-size: 12px;
  line-height: 1.45;
  text-decoration: none;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}
.long-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 6px;
  font-size: 11.5px;
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
  gap: 6px;
  align-items: center;
  margin: 0 4px 6px;
}
.chat-form input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--fp-border);
  background: var(--fp-search-bg);
  color: var(--fp-text);
  border-radius: 4px;
  padding: 4px 8px;
  height: 28px;
  font-size: 12.5px;
}
.chat-form .green {
  margin-left: 0;
}
.green-link {
  color: var(--fp-green);
  text-decoration: none;
  font-weight: 600;
  font-size: 12.5px;
  white-space: nowrap;
}
.chat-list .chat-item {
  align-items: flex-start;
  padding: 4px 5px;
}
.avatar-mid {
  display: inline-block;
  width: 28px;
  height: 28px;
  border-radius: 4px;
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
.chat-item .fp-bubble { position:relative; }
.chat-text {
  margin-top: 2px;
  font-size: 13px;
  color: var(--fp-title);
  line-height: 1.4;
  word-break: break-word;
}

.community-body { display:flex; flex-direction:column; }
.is-classic {
  gap:12px;
  .board { align-items:stretch; gap:12px; }
  .cell { gap:12px; order:initial; }
  .mod-body { padding:12px 12px 14px; }
  .home-moons { order:1; }
  .mod:last-child { flex:1; display:flex; flex-direction:column; }
  .mod:last-child > .mod-body { flex:1; display:flex; flex-direction:column; }
  .mod[data-home-module='recentA']:last-child > .mod-body > .module-list:last-child,
  .mod[data-home-module='recentB']:last-child > .mod-body > .module-list:last-child { flex:1; display:flex; flex-direction:column; justify-content:space-between; }
  .module-list li { padding:5px 6px; min-height:30px; }
  .long-card { flex-basis:calc((100% - 36px) / 4); grid-template-columns:64px minmax(0,1fr); min-height:96px; }
  .long-cover { width:64px; }
  .long-summary { -webkit-line-clamp:2; }
  .home-moons :deep(.moon-body) { display:block; overflow:visible; }
  .download { display:flex; align-items:center; gap:10px; margin:2px 4px 10px; padding:8px 10px; border:1px solid var(--fp-border); border-radius:6px; background:var(--fp-hover); font-size:12px; }
  .download p { margin:2px 0 0; color:var(--fp-muted); }
  .download img { width:32px; height:32px; flex:none; }
  @media(max-width:1100px) { .long-card { flex-basis:calc((100% - 28px) / 3); } }
  @media(max-width:680px) { .long-card { flex-basis:82%; min-height:112px; }.long-cover { width:68px; } }
}

@media (max-width: 960px) {
  .board {
    grid-template-columns: minmax(0, 1fr) !important;
    padding: 0;
    gap: 10px;
  }
  .cell {
    padding: 0;
  }
  .cell:not(:last-child) {
    border-right: none;
    border-bottom: 0;
    padding-bottom: 0;
    margin-bottom: 0;
  }
  .long-zone {
    --long-gutter: 14px;
  }
  .long-card {
    flex-basis: calc((100% - 10px) / 2);
  }
  .long-card {
    flex-basis: calc((100% - 10px) / 2);
  }
  .long-heading > span {
    display: none;
  }
}

@media (max-width: 680px) {
  .cell--feed { order: -1; }
  .long-card {
    flex-basis: 82%;
    min-height: 72px;
  }
  .long-cover {
    width: 48px;
  }
}
.home-a11y-title{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
</style>
