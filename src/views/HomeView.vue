<script setup lang="ts">
import { useFunctionPreferencesStore } from '@/stores/functionPreferences'
import ImageLightbox from '@/components/ImageLightbox.vue'
import HomePreferenceRedirect from '@/components/home/HomePreferenceRedirect.vue'
import RecentMembers from '@/components/discovery/RecentMembers.vue'
import RankingBoard from '@/components/RankingBoard.vue'
import HomeReadStatus from '@/components/home/HomeReadStatus.vue'
import { consumeHomeRankingPayload, consumeHomeReadsPayload, consumeRepeaterPayload } from '@/seo/payload'
import { getAuthContextVersion, getHomeReadPause, resumeHomeReads } from '@/api/http'
import { useHomeRead } from '@/composables/useHomeRead'
import ChatPublicationRecovery from '@/components/chat/ChatPublicationRecovery.vue'
import { useV3ChatPublicationStore } from '@/stores/v3ChatPublication'
import BreezemoonPanel from '@/components/breezemoons/BreezemoonPanel.vue'
import { articleTitle, decodeEntities } from '@/utils/text'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import type { ArticleSummary, TagItem } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useHomeLayoutStore, type HomeRowView } from '@/stores/homeLayout'
import { useHomeDrag } from '@/home/useHomeDrag'
import DragGrip from '@/components/home/DragGrip.vue'
import PersonInfoCard from '@/components/sidebar/PersonInfoCard.vue'
import ClientDownloadCard from '@/components/sidebar/ClientDownloadCard.vue'
import CheckinPanel from '@/components/home/CheckinPanel.vue'
import HomeSideWidgets from '@/components/home/HomeSideWidgets.vue'
import HomeModuleDisclosure from '@/components/home/HomeModuleDisclosure.vue'
import HomeRepeaterStation from '@/components/home/HomeRepeaterStation.vue'
import { usePageSeo } from '@/composables/usePageSeo'
import { SITE_DEFAULT_DESC, SITE_NAME } from '@/seo/site'
import HomeChatPreview from '@/components/home/HomeChatPreview.vue'
import { avatarStyle, rhyPicThumbnail } from '@/utils/avatar'

const functionPreferences = useFunctionPreferencesStore()
const chatImagePreview = ref('')
const imagePreferencesMounted = ref(false)
onMounted(() => { imagePreferencesMounted.value = true })

const auth = useAuthStore(), chat = useChatStore(), publication = useV3ChatPublicationStore(), layout = useHomeLayoutStore()
const { accessToken, isLoggedIn } = storeToRefs(auth)
watch(() => JSON.stringify([getAuthContextVersion(), !!auth.accessToken, auth.account?.oId || '']), () => {
  chatImagePreview.value = ''
}, { flush: 'sync' })
const boot = consumeHomeReadsPayload()
const activeLongShelf = ref<'recent' | 'hot'>('recent')
const recentRead = useHomeRead('recent', boot.recent, boot.expires.recent), hotRead = useHomeRead('hot', boot.hot, boot.expires.hot), tagsRead = useHomeRead('tags', boot.tags, boot.expires.tags)
const columnsRecentRead = useHomeRead('columnsRecent', boot.columnsRecent, boot.expires.columnsRecent), columnsHotRead = useHomeRead('columnsHot', boot.columnsHot, boot.expires.columnsHot, () => activeLongShelf.value === 'hot')
const homeReady = ref(false)
const readPause = ref<ReturnType<typeof getHomeReadPause>>(null)
const retryTip = ref('')
function syncReadPause() { readPause.value = getHomeReadPause(); retryTip.value = '' }
function retryHomeReads() {
  if (!readPause.value) return
  if (!resumeHomeReads()) {
    retryTip.value = '请在 ' + new Date(readPause.value.until).toLocaleTimeString('zh-CN') + ' 后重试。'
    return
  }
  window.dispatchEvent(new Event('fp:retry-public'))
}
onMounted(() => {
  homeReady.value = true
  syncReadPause()
  if (typeof window !== 'undefined') window.addEventListener('fp:home-reads-paused', syncReadPause)
})
onUnmounted(() => { if (typeof window !== 'undefined') window.removeEventListener('fp:home-reads-paused', syncReadPause) })
const compactHome = computed(() => layout.mode !== 'classic')
const left = computed(() => (recentRead.data || []).slice(0, 20))
const right = computed(() => (recentRead.data || []).slice(20, 40))
const hot = computed(() => hotRead.data || []), tags = computed(() => tagsRead.data || [])
const repeaterItems = ref(consumeRepeaterPayload() || undefined)
const homeRanks = ref(consumeHomeRankingPayload())
let rankingSeedTimer: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  repeaterItems.value = undefined
  // A saved layout may mount a ranking after hydration; keep its SSR seed until it ages out.
  if (homeRanks.value.checkin || homeRanks.value.online) {
    rankingSeedTimer = setTimeout(() => { homeRanks.value = { checkin: null, online: null, expires: undefined } }, 300_000)
  }
})
const chatDraft = ref(''), chatBusy = ref(false), chatMsg = ref('')
const onlineChatCnt = computed(() => chat.onlineTotal), discussing = computed(() => chat.discuss)
const hotMode = ref<'hot' | 'column'>('hot')
const hotState = computed(() => hotMode.value === 'hot' ? hotRead : columnsRecentRead)
const activeColumnsRead = computed(() => activeLongShelf.value === 'recent' ? columnsRecentRead : columnsHotRead)
const activeColumnsShelf = computed(() => activeColumnsRead.value.data || [])
const failedCovers = ref(new Set<string>())
watch(() => [columnsRecentRead.data, columnsHotRead.data], () => { failedCovers.value = new Set() })
const { editing } = storeToRefs(layout)
const { dragging, onDragStart, onDragEnd, onModuleOver, onGapOver, onDrop, edgeOf, gapActive, dropLabel, onHandleKeydown } = useHomeDrag()
const { messages: liveChatMessages } = storeToRefs(chat)
let longShelfTimer: ReturnType<typeof setInterval> | undefined
const chatLines = computed(() => liveChatMessages.value.slice(-10).reverse())
watch(() => JSON.stringify([getAuthContextVersion(), !!accessToken.value, auth.account?.oId || '']), () => { chatDraft.value = ''; chatMsg.value = '' }, { flush: 'sync' })
onMounted(() => { chat.acquire('home'); longShelfTimer = setInterval(() => scrollShelf('long-active', 1), 6000) })
onUnmounted(() => { clearTimeout(rankingSeedTimer); editing.value = false; if (longShelfTimer) clearInterval(longShelfTimer); chat.release('home') })
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
  <ImageLightbox v-model="chatImagePreview" />
  <div class="home" :data-public-content="recentRead.data ? 'ready' : undefined" :class="{ editing, 'is-classic': !compactHome }">
    <h1 class="home-a11y-title">摸鱼派社区动态</h1>
    <HomePreferenceRedirect />
    <div v-if="readPause" class="home-read-pause" role="status">
      <span>{{ readPause.message }}{{ retryTip }}</span>
      <button type="button" class="green" @click="retryHomeReads">重试首页读取</button>
    </div>
    <div v-if="editing" class="edit-bar" role="toolbar" aria-label="首页布局编辑">
      <div class="edit-bar-copy"><strong>调整首页布局</strong><span>紧凑编辑 · 拖至屏幕边缘自动滚动 · 自动保存</span></div>
      <button type="button" @click="layout.resetPositions()">恢复默认位置</button>
      <button type="button" class="green" @click="editing = false">完成</button>
    </div>
    <template v-for="row in layout.visibleRows" :key="row.key">
      <div
        v-if="editing"
        class="row-gap"
        :data-home-row-gap="row.cells[0].modules[0].id"
        :class="{ on: gapActive(row.cells[0].modules[0].id) }"
        @dragover="onGapOver($event, row.cells[0].modules[0].id)"
        @drop="onDrop"
      ><span>＋ 放在这里，新建一行</span></div>
      <div class="board" :class="{ bare: isBareRow(row), 'board--aligned': row.cells.every(cell => cell.modules.length === 1) || row.cells[0]?.modules[0]?.id === 'recentA' }" :style="{ gridTemplateColumns: row.columns }">
        <div v-for="cell in row.cells" :key="cell.key" class="cell" :class="{ 'cell--narrow': cell.narrow, 'cell--feed': cell.modules.some(m => m.id === 'recentA') }">
          <div
            v-for="mod in cell.modules"
            :key="mod.id"
            class="mod"
            :class="[edgeOf(mod.id) ? `drop-${edgeOf(mod.id)}` : '', { dragging: dragging === mod.id }]"
            :data-home-module="mod.id"
            :data-home-title="mod.title"
            @dragover="onModuleOver($event, mod.id)"
            @drop="onDrop"
          >
            <button v-if="editing" type="button" class="mod-drag-bar" draggable="true"
              :aria-label="`移动${mod.title}，方向键调整位置，Escape 取消拖动`"
              title="拖动调整布局，或用方向键移动" @dragstart="onDragStart($event, mod.id)"
              @dragend="onDragEnd" @keydown="onHandleKeydown($event, mod.id)">
              <DragGrip /><span>{{ mod.title }}</span><small>移动</small>
            </button>
            <span v-if="edgeOf(mod.id)" class="drop-caption" aria-hidden="true">{{ dropLabel(mod.id) }}</span>
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
                      :style="avatarStyle(item.articleAuthorThumbnailURL48, 20)"
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
                <b class="recent-continuation">{{ compactHome ? '更多最新' : '最新 · 续' }}</b>
              </div>
              <HomeReadStatus label="最新文章（续）" :loading="recentRead.loading" :error="recentRead.error" :ready="recentRead.data !== null" :empty="!right.length" :empty-text="left.length ? '本列暂无文章。' : '暂无可见文章。'" @retry="recentRead.read" />
              <ol class="module-list">
                <li v-for="item in right" :key="item.oId">
                  <span v-if="item.stick?.active" class="cb-stick" title="置顶" />
                  <RouterLink v-if="item.articleAnonymous !== 1 && item.articleAuthorId && item.articleAuthorName" :to="`/member/${encodeURIComponent(item.articleAuthorName)}`">
                    <span
                      class="avatar-small"
                      :style="avatarStyle(item.articleAuthorThumbnailURL48, 20)"
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
              <HomeModuleDisclosure v-if="compactHome && homeReady" class="home-person" module-key="rank:profile" module-id="profile" title="我的资料">
                <PersonInfoCard :avatar-size="34" />
              </HomeModuleDisclosure>
              <div class="index-head">
                <b>今日连签排行</b>
                <RouterLink to="/top/checkin">更多</RouterLink>
              </div>
              <RankingBoard type="checkin" :initial="homeRanks.checkin" :initial-expires="homeRanks.expires?.checkin ?? 0" compact />
            </aside>

            <section v-else-if="mod.id === 'checkin'" class="mod-body home-tool home-checkin-tool">
              <HomeModuleDisclosure v-if="homeReady && isLoggedIn" class="home-checkin" fixed-open module-key="rank:checkin" module-id="checkin" title="今日活跃与签到">
                <template #default="{ reportSummary }">
                  <CheckinPanel @summary="reportSummary" />
                </template>
              </HomeModuleDisclosure>
              <div v-else class="home-checkin-guest">
                <strong>活跃与签到</strong>
                <p>登录后查看今日活跃与签到奖励</p>
                <RouterLink to="/login?goto=%2F">登录</RouterLink>
              </div>
            </section>
            <section v-else-if="mod.id === 'download'" class="mod-body home-download-tool">
              <ClientDownloadCard />
            </section>
            <section v-else-if="mod.id === 'onlineRank'" class="mod-body">
              <div class="index-head">
                <b>在线时间排行</b>
                <RouterLink to="/top/online">更多</RouterLink>
              </div>
              <RankingBoard type="online" :initial="homeRanks.online" :initial-expires="homeRanks.expires?.online ?? 0" compact />
            </section>

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
                    <img v-if="col.coverURL && !failedCovers.has(col.id)" :src="rhyPicThumbnail(col.coverURL, 136, 182)" alt="" loading="lazy" @error="failedCovers.add(col.id)"><span v-else class="column-cover-placeholder" aria-hidden="true">卷</span>
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
                  aria-label="聊天室消息"
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
                <li v-for="m in chatLines" :key="m.oId" class="chat-item">
                  <HomeChatPreview :message="m" :blur-images="imagePreferencesMounted && functionPreferences.blurChatImages" @preview="chatImagePreview = $event" />
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
                  <RouterLink v-if="item.articleAnonymous !== 1 && item.articleAuthorId && item.articleAuthorName" :to="`/member/${encodeURIComponent(item.articleAuthorName)}`"><span class="avatar-small" :style="avatarStyle(item.articleAuthorThumbnailURL48, 20)" /></RouterLink>
                  <RouterLink class="title fn-ellipsis" :to="`/article/${item.oId}`">{{ articleTitle(item) }}</RouterLink><span class="count">{{ item.articleCommentCount }} 回帖</span>
                </li>
              </ol>
              <ol v-else class="module-list"><li v-for="col in columnsRecentRead.data || []" :key="col.id"><RouterLink class="title fn-ellipsis" :to="`/column/${col.id}`">{{ decodeEntities(col.title) }}</RouterLink><span class="count">{{ col.articleCount }} 章</span></li></ol>
            </section>

            <aside v-else-if="mod.id === 'community'" class="mod-body community-body">
              <HomeModuleDisclosure class="home-moons" module-key="community:breezemoons" module-id="breezemoons" title="清风明月">
                <template #action>
                  <RouterLink to="/breezemoons" title="清风明月是什么？" class="home-moons-more">更多</RouterLink>
                </template>
                <template #default="{ reportSummary }">
                  <BreezemoonPanel :size="8" :preview-limit="compactHome ? 3 : undefined" compact avatar-only ssr-scope="home" @summary="reportSummary" />
                </template>
              </HomeModuleDisclosure>
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
    <div v-if="editing" class="row-gap end" data-home-row-gap="" :class="{ on: gapActive(null) }" @dragover="onGapOver($event, null)" @drop="onDrop">
      拖到这里新起一行
    </div>
  </div>
</template>

<style scoped lang="scss">
.home-read-pause {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 10px;
  margin-bottom: 12px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-card);
}

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
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius, 12px);
  background: color-mix(in srgb, var(--fp-card) 92%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: var(--fp-card-shadow);
  font-size: 13px;
  color: var(--fp-text);
}
.edit-bar-copy { display: grid; gap: 3px; flex: 1; min-width: 0; }
.edit-bar-copy strong { font-size: 14px; }
.edit-bar-copy span { color: var(--fp-muted); font-size: 12px; }
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
  gap: 12px;
  background: transparent;
  box-shadow: none;
  border: 0;
  padding: 0;
}
.mod-body {
  padding: clamp(12px, 1.1vw, 16px);
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius);
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
  gap: 12px;
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
@media (width > 960px) {
  .board { align-items: stretch; }
  /* 列保持等高，剩余留白放在卡片外，避免复读机等模块被拉长。 */
  .board:not(.bare) .cell > .mod { flex: 0 0 auto; }
  .board--aligned:not(.bare) .cell > .mod:only-child { flex: 1; display: flex; flex-direction: column; }
  .board--aligned:not(.bare) .cell > .mod:only-child > .mod-body { flex: 1; }
}
.is-classic .recent-continuation { visibility: visible; }
@media (max-width: 960px) { .is-classic .recent-continuation { visibility: visible; } }
/* 首页工具行共用紧凑间距，保留等高；不影响内页侧栏。 */
.home-tool { min-height: 0; }
.home .home-checkin-tool { padding: 0; }
.home-checkin-tool :deep(.disclosure-body) { padding: 0 12px 10px; }
.home-checkin-tool :deep(.disclosure-head) { margin-bottom: 0; }
.home [data-home-module="side:profile"] :deep(.person-head) { gap: 8px; margin-bottom: 8px; }
.home [data-home-module="side:profile"] :deep(.person-avatar) { width: 36px; height: 36px; }
.home [data-home-module="side:profile"] :deep(.person-stats) { padding-top: 6px; }
.home [data-home-module="side:profile"] :deep(.stat-col) { padding-block: 2px; }
.home :deep(.fixed-heading) { padding: 10px 12px; }

.board--aligned [data-home-module="side:income"] :deep(.home-side-widget),
.board--aligned [data-home-module="side:profile"] :deep(.home-side-widget) { flex: 1; min-height: 120px; }
.home-download-tool { display: flex; align-items: center; }
.home-download-tool :deep(.client-download) { width: 100%; border: 0; padding: 0; background: transparent; }
.home-checkin-tool :deep(.home-checkin), .home-checkin-tool :deep(.checkin-panel) { margin: 0; }
.home-checkin-tool :deep(.checkin-section) { border: 0; background: transparent; padding: 0; }
.home-checkin-tool :deep(.activity-ring) { width: 40px; height: 40px; }

.home-checkin-guest { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.home-checkin-guest strong { width: 100%; font-size: 14px; }
.home-checkin-guest p { flex: 1; color: var(--fp-muted); font-size: 12px; }
.home-checkin-guest a { color: var(--fp-primary); font-size: 12px; }
.home [data-home-module="side:income"] :deep(.hint) { display: none; }
.home [data-home-module="side:income"] :deep(.income) { display: grid; grid-template-columns: 1fr auto; align-items: center; text-align: left; }
.home [data-home-module="side:income"] :deep(.time) { grid-column: 1; font-size: 24px; }
.home [data-home-module="side:income"] :deep(.money) { grid-column: 2; grid-row: 1 / span 2; padding-left: 12px; border-left: 1px solid var(--fp-border); }
.home-person { margin-bottom: 10px; }
.home-person :deep(.person-head) { margin-bottom: 8px; gap: 8px; }
.home-person :deep(.person-avatar) { width: 34px; height: 34px; }
.home-person :deep(.person-stats) { padding-top: 6px; }
.home-person :deep(.stat-col span) { font-size: 10px; }
.home-person :deep(.person-sub) { font-size: 10px; }
.home-person :deep(.guest-slogan) { margin-bottom: 8px; }
.home-person :deep(.role-tag) { display: none; }
.home-checkin :deep(.checkin-head h3) { display: none; }
.home-download { margin-bottom: 12px; }
.home-checkin { margin-bottom: 12px; }
.home-checkin :deep(.checkin-head) { display: none; }
.home-moons { margin-block: 12px; }
.home-moons-more { flex: none; color: var(--fp-muted); font-size: 12px; text-decoration: none; }
.home-moons-more:hover { text-decoration: underline; }
.home :deep(.checkin-panel) { margin: 10px 0 12px; }
.home :deep(.checkin-section) { padding: 7px 8px; }
.home :deep(.breezemoon-list .moon-body) { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }

.home.editing .mod {
  border-radius: var(--fp-panel-radius, 12px);
  outline: 1px solid var(--fp-border);
  background: var(--fp-card);
  align-content: start;
}
/* 只隐藏内容，保留组件挂载、草稿和折叠状态；结束编辑即恢复。 */
.home.editing .board .cell > .mod {
  flex: 0 0 auto;
  display: block;
  min-height: 0;
}
.home.editing .board { align-items: start; }
.home.editing .mod > :not(.mod-drag-bar):not(.drop-caption) {
  display: none !important;
  pointer-events: none;
  user-select: none;
}
.home.editing .mod.dragging { opacity: 0.4; outline: 2px dashed var(--fp-primary); }
.mod-drag-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  padding: 10px 12px;
  border: 0;
  border-radius: var(--fp-panel-radius, 12px);
  color: var(--fp-text);
  background: var(--fp-surface-subtle, var(--fp-bg));
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: grab;
  transition: background 150ms, color 150ms;
}
.mod-drag-bar:hover, .mod-drag-bar:focus-visible { background: var(--fp-primary-soft); color: var(--fp-primary-ink); }
.mod-drag-bar:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 2px; }
.mod-drag-bar:active { cursor: grabbing; }
.mod-drag-bar span { flex: 1; }
.mod-drag-bar small { color: var(--fp-muted); font-size: 11px; }
.drop-caption {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  z-index: 4; padding: 6px 12px; border-radius: 8px; white-space: nowrap;
  background: var(--fp-primary-fill); color: #fff; font-size: 12px; pointer-events: none;
  box-shadow: var(--fp-card-shadow);
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
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  margin: -8px 0;
  border: 1px dashed var(--fp-border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--fp-muted);
  transition: background-color 150ms, border-color 150ms;
}
.row-gap.on {
  color: var(--fp-primary-ink);
  background: var(--fp-primary-soft);
  border-color: var(--fp-primary);
}
.row-gap.end { margin: 0; }
@media (max-width: 600px) {
  .edit-bar { flex-wrap: wrap; top: 64px; }
  .edit-bar-copy { flex-basis: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .mod-drag-bar, .row-gap { transition: none; }
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
  border-radius: var(--fp-avatar-radius);
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
.chat-list .chat-item { padding: 3px 0; min-width: 0; }

.community-body { display:flex; flex-direction:column; }
.is-classic {
  gap:12px;
  .board { gap:12px; }
  .cell { gap:12px; order:initial; }
  .mod-body { padding:12px 12px 14px; }
  .home-moons { order:1; }
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
