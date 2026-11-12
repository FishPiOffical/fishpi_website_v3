<script setup lang="ts">
import { useScrollPagination } from '@/composables/useScrollPagination'
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { RouterLink,useRoute,useRouter } from 'vue-router'
import ChatToolDialog from '@/components/chat/ChatToolDialog.vue'
import ChatContextPanel from '@/components/chat/ChatContextPanel.vue'
import BreezemoonQuotePreview from '@/components/chat/BreezemoonQuotePreview.vue'
import { breezemoonQuoteMarkdown, createBreezemoonQuote, type BreezemoonQuote, type BreezemoonQuoteSource } from '@/utils/breezemoonQuote'
import ChatConnectionStatus from '@/components/chat/ChatConnectionStatus.vue'
import { storeToRefs } from 'pinia'
import {useChatMessageSource} from '@/composables/useChatMessageSource'
import {getAuthContextVersion} from '@/api/http'
import {useV3ChatPublicationStore} from '@/stores/v3ChatPublication'
import ChatRepeatAction from '@/components/chat/ChatRepeatAction.vue'
import ChatRevokeAction from '@/components/chat/ChatRevokeAction.vue'
import ChatRevokeRecovery from '@/components/chat/ChatRevokeRecovery.vue'
import ChatPublicationRecovery from '@/components/chat/ChatPublicationRecovery.vue'
import ChatTopicEditor from '@/components/chat/ChatTopicEditor.vue'
import ChatTopicRecovery from '@/components/chat/ChatTopicRecovery.vue'
import ChatOnlineList from '@/components/chat/ChatOnlineList.vue'
import ChatSidebar from '@/chat/sidebar/ChatSidebar.vue'
import ChatRedPacketCard from '@/components/chat/ChatRedPacketCard.vue'
import ChatBubble from '@/components/ChatBubble.vue'
import ChatCard from '@/components/ChatCard.vue'
import ChatComposer from '@/components/ChatComposer.vue'
import V3ReactionBar from '@/components/V3ReactionBar.vue'
import ReportDialog from '@/components/ReportDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useChatPreferencesStore } from '@/stores/chatPreferences'
import { useChatFilterStore } from '@/stores/chatFilter'
import type { ChatNodeOption } from '@/api/fishpi'
import FpLoading from '@/components/FpLoading.vue'
import FpDialog from '@/components/FpDialog.vue'

const auth = useAuthStore()
const chat = useChatStore(),publication=useV3ChatPublicationStore()
const chatFilter = useChatFilterStore()
const chatPreferences = useChatPreferencesStore()
const { account, isLoggedIn, accessToken } = storeToRefs(auth)
const composerRef = ref<InstanceType<typeof ChatComposer> | null>(null)
const composerReady = ref(false)
const classicComposerArea = ref<HTMLElement | null>(null)
const classicComposerAboveView = ref(false)

watch(classicComposerArea, (area, _, onCleanup) => {
  classicComposerAboveView.value = false
  if (!area || typeof IntersectionObserver === 'undefined') return
  const observer = new IntersectionObserver(([entry]) => {
    classicComposerAboveView.value = !!entry && !entry.isIntersecting && entry.boundingClientRect.bottom <= 0
  })
  observer.observe(area)
  onCleanup(() => observer.disconnect())
}, { flush: 'post' })
const {
  messages,
  sending,
  loading,
  loadingMore,
  hasMore,
  error,
  discuss,
  onlineTotal,
  nodeName,
  nodeOptions,
  chatStyle,
} = storeToRefs(chat)
const visibleMessages = computed(() => messages.value.filter((line) => chatFilter.modeFor(line) === 'show'))

const route=useRoute(),router=useRouter(),contextId=ref('')
const classicHistoryEnd = ref<HTMLElement | null>(null)
useScrollPagination(
  classicHistoryEnd,
  () => chatStyle.value === 'classic' && !contextId.value && !loading.value && !loadingMore.value && !error.value && hasMore.value,
  () => chat.loadMore(),
  () => [route.fullPath, getAuthContextVersion(), account.value?.oId || ''].join(':'),
)

const draft = ref('')
const breezemoonQuotes = ref<BreezemoonQuote[]>([])
watch(()=>JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||'']),()=>{
  draft.value = ''
  breezemoonQuotes.value = []
},{flush:'sync'})
const scroller = ref<HTMLElement | null>(null)
const activeTool = ref<''|'packet'|'barrage'|'paint'>('')
const chatTools = [
  { id: 'packet', label: '红包', title: '发放红包', path: 'M5 3h14v18H5z M5 8l7 4 7-4 M9 15h6' },
  { id: 'paint', label: '涂鸦', title: '涂鸦画板', path: 'm14 5 5 5 M4 20l4-1L21 6l-4-4L4 15v5Z M13 20h8' },
  { id: 'barrage', label: '弹幕', title: '发送弹幕', path: 'M4 4h16v13H9l-5 4V4Z M8 9h8 M8 13h5' },
] as const
function toolOpen(id: typeof chatTools[number]['id']) { return activeTool.value === id }
function togglePanel(panel: typeof chatTools[number]['id']) { activeTool.value = activeTool.value === panel ? '' : panel }
watch(()=>JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||'']),()=>{activeTool.value=''},{flush:'sync'})

const showNodes = ref(false)
const {quote,quoteBusy,quoteErr,quoteMessage:readQuote,clearQuote,buildQuoteSuffix}=useChatMessageSource()
const editingTopic = ref(false)

const me = computed(() => account.value?.userName)

// 经典版：最新消息排在最上面！
const classicMessages = computed(() => [...visibleMessages.value].reverse())

function syncContextHash(){const match=/^#chatroom(\d{1,32})$/.exec(route.hash);contextId.value=accessToken.value&&account.value?.oId&&match?match[1]!:''}
watch(()=>JSON.stringify([route.hash,!!accessToken.value,account.value?.oId||'']),syncContextHash,{immediate:true})
function closeContext(){contextId.value='';if(/^#chatroom\d{1,32}$/.test(route.hash))void router.replace({hash:''})}
async function latestFromContext(){closeContext();await chat.refreshMessages();await nextTick();if(chatStyle.value==='modern')scrollBottom()}

onMounted(() => {
  composerReady.value = true
  if (!chat.connected && !chat.connecting && !chat.loading) void chat.connect()
})

onUnmounted(() => {
  if (!chat.floatingChatroomOpen) chat.disconnect()
})

const hasNewMessages = ref(false)
const sentMessageId = ref('')
let followingLatest = true
const firstVisibleId = computed(() => visibleMessages.value[0]?.oId)
const latestVisibleId = computed(() => visibleMessages.value.at(-1)?.oId)

function nearLatest(el: HTMLElement) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 100
}

watch(latestVisibleId, async (id, previous) => {
  const el = scroller.value
  if (!el) return
  if (!id) { hasNewMessages.value = false; return }
  // Measure against the previous layout before Vue inserts the new message.
  const follow = !previous || followingLatest
  await nextTick()
  if (el !== scroller.value || id !== latestVisibleId.value) return
  if (follow) scrollBottom()
  else if (visibleMessages.value.some(message => message.oId === previous)) hasNewMessages.value = true
})

watch(scroller, (el, _, onCleanup) => {
  scrollBottom()
  if (!el || typeof ResizeObserver === 'undefined') return
  // Images and editor expansion can change the scroll range after the message DOM is patched.
  let frame = 0
  const observer = new ResizeObserver(() => {
    if (frame || !followingLatest) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (el === scroller.value && followingLatest) scrollBottom()
    })
  })
  observer.observe(el)
  const content = el.querySelector('.messages-container')
  if (content) observer.observe(content)
  onCleanup(() => {
    observer.disconnect()
    cancelAnimationFrame(frame)
  })
}, { flush: 'post' })

function scrollBottom() {
  followingLatest = true
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
  hasNewMessages.value = false
}

watch(
  () => visibleMessages.value.find(message => message.oId === sentMessageId.value)?.oId,
  (id) => {
    if (!id) return
    sentMessageId.value = ''
    if (chatStyle.value === 'modern') scrollBottom()
    else document.getElementById(`chatroom${id}`)?.scrollIntoView({ block: 'nearest' })
  },
  { flush: 'post' },
)

function revealComposer() {
  composerRef.value?.reveal()
}

function composedContent() {
  const text = `${draft.value}${buildQuoteSuffix()}`
  return [text, ...breezemoonQuotes.value.map(breezemoonQuoteMarkdown)].filter(Boolean).join('\n\n')
}

async function submit() {
  const content = composedContent()
  if (!content.trim()) return
  const reader=JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||''])
  if(await chat.send(content)&&reader===JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||'']))acceptConfirmed(content.trim())
}

function acceptConfirmed(content: string) {
  if (composedContent().trim() !== content) return
  draft.value = ''
  breezemoonQuotes.value = []
  clearQuote()
  sentMessageId.value = publication.receipt?.id ?? ''
}

async function quoteMessage(msg:{oId:string}){
 await readQuote(msg.oId)
 if(quote.value?.messageId!==msg.oId)return
 await nextTick()
 if(quote.value?.messageId===msg.oId)composerRef.value?.reveal()
}

function quoteBreezemoon(source: BreezemoonQuoteSource) {
  if (!composerRef.value || !isLoggedIn.value) return
  const entry = createBreezemoonQuote(source, window.location.origin)
  if (!entry) return
  if (!breezemoonQuotes.value.some(quote => quote.href === entry.href)) breezemoonQuotes.value.push(entry)
  revealComposer()
}

function removeBreezemoonQuote(href: string) {
  breezemoonQuotes.value = breezemoonQuotes.value.filter(quote => quote.href !== href)
}

provide('quoteBreezemoonInChat', { enabled: isLoggedIn, insert: quoteBreezemoon })

function onBreezemoonDragOver(event: DragEvent) {
  if (event.dataTransfer?.types.includes('application/x-fishpi-breezemoon')) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }
}

function onBreezemoonDrop(event: DragEvent) {
  const payload = event.dataTransfer?.getData('application/x-fishpi-breezemoon')
  if (!payload) return
  event.preventDefault()
  event.stopPropagation()
  try {
    const source = JSON.parse(payload) as Partial<BreezemoonQuoteSource> | null
    if (source && typeof source.id === 'string' && typeof source.userName === 'string'
      && typeof source.nickname === 'string' && typeof source.excerpt === 'string') {
      quoteBreezemoon({ id: source.id, userName: source.userName, nickname: source.nickname, excerpt: source.excerpt })
    }
  } catch { /* Ignore malformed drag data. */ }
}

function insertPaint(md: string) {
  if (!syncComposer()) return
  draft.value += (draft.value && !draft.value.endsWith('\n') ? '\n' : '') + md
  activeTool.value = ''
}

async function pickNode(opt: ChatNodeOption) {
  showNodes.value = false
  await chat.switchNode(opt)
}

async function openNodePicker() {
  showNodes.value = !showNodes.value
  if (showNodes.value) await chat.refreshNodes()
}


function onModernScroll() {
  const el = scroller.value
  if (!el) return
  followingLatest = nearLatest(el)
  if (followingLatest) hasNewMessages.value = false
  else if (el.scrollTop <= 50) void loadOlder()
}

async function loadOlder() {
  const el = scroller.value
  if (!el || loading.value || loadingMore.value || !hasMore.value) return
  const first = firstVisibleId.value
  const anchor = first && document.getElementById(`chatroom${first}`)
  const offset = anchor && anchor.getBoundingClientRect().top - el.getBoundingClientRect().top
  await chat.loadMore()
  await nextTick()
  if (el === scroller.value && anchor && anchor.isConnected && first !== firstVisibleId.value && typeof offset === 'number') {
    el.scrollTop += anchor.getBoundingClientRect().top - el.getBoundingClientRect().top - offset
  }
}

function useTopic() {
  if (!syncComposer()) return
  draft.value += ` # ${discuss.value} # `
}

function syncComposer() {
  const value = composerRef.value?.flush()
  if (value === null) return false
  if (value !== undefined) draft.value = value
  return true
}

function toggleChatStyle() {
  if (!syncComposer()) return
  chat.toggleChatStyle()
}

function clearScreen() {
  chat.clearScreen()
}
</script>

<template>
  <div class="cr-page" :class="`theme-${chatStyle}`">
    <ChatContextPanel :message-id="contextId" @close="closeContext" @latest="latestFromContext" />
    <p v-if="isLoggedIn" class="timeline-controls"><button type="button" :disabled="loading" @click="chat.refreshMessages">重读当前消息</button><span v-if="chat.topicError" role="alert">{{ chat.topicError }}</span></p>
    <p v-else>登录后可读取聊天室消息。</p>
    <p v-if="quoteErr" role="alert">{{ quoteErr }}</p>
    <!-- ==================== 版本 A: 经典版本 (Classic，对齐现网 chat-room.ftl) ==================== -->
    <div v-if="chatStyle === 'classic'" class="cr-classic-layout">
      <main class="cr-classic-main">
        <!-- 整合在一个白色大卡片内，输入框在上，消息在下 -->
        <div class="cr-classic-card">
          <!-- 1. 顶部输入与控制区域 -->
          <section ref="classicComposerArea" class="cr-classic-reply" @dragover.capture="onBreezemoonDragOver" @drop.capture="onBreezemoonDrop">
            <ChatPublicationRecovery @confirmed="acceptConfirmed" />
            <ChatRevokeRecovery />
            <ChatComposer
              :height="100"
              v-if="composerReady && isLoggedIn"
              ref="composerRef"
              v-model="draft"
              :cache-id="account?.oId?`chatContent:${account.oId}`:''"
              placeholder="说点什么吧！"
              :sending="sending" :chat-send-shortcut="chatPreferences.sendShortcut"
              :disabled="!!publication.pending"
              :allow-empty="Boolean(quote) || breezemoonQuotes.length > 0"
              @submit="submit"
            >
              <template #top>
                <BreezemoonQuotePreview :quotes="breezemoonQuotes" @remove="removeBreezemoonQuote" />
              <div v-if="quote" class="quote-preview-box">
                <div class="quote-info">
                  <span class="quote-label">引用 @{{ quote.userName }}</span>
                  <div v-if="quote.html" class="vditor-reset quote-html" v-html="quote.html" />
                  <div v-else class="quote-html">{{ quote.label }}</div>
                </div>
                <button type="button" class="quote-cancel" title="取消引用" @click="clearQuote">✕</button>
              </div>
              </template>
              <template #tools>
                <button v-for="tool in chatTools" :key="tool.id" type="button" class="composer-tool-btn" :class="{'is-active':toolOpen(tool.id)}" :title="tool.title" :aria-label="tool.title" :aria-expanded="toolOpen(tool.id)" aria-haspopup="dialog" @click="togglePanel(tool.id)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="tool.path" /></svg><span>{{ tool.label }}</span>
                </button>
                <ChatConnectionStatus />
              </template>
              <template #context>
                <div class="classic-topic-pill" :title="discuss">
                  <span class="topic-label">话题</span>
                  <span class="topic-text">{{ discuss || '聊点什么？' }}</span>
                  <button type="button" class="topic-action-btn" title="引用话题" aria-label="引用话题" @click="useTopic">#</button>
                  <button type="button" class="topic-action-btn" title="编辑话题" aria-label="编辑话题" :aria-expanded="editingTopic" @click="editingTopic = !editingTopic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 4 5 5 M4 20l5-1L21 7l-4-4L5 15l-1 5Z" /></svg></button>
                </div>
              </template>
              <template #actions>
                <button type="button" v-if="nodeOptions.length" class="classic-btn" :title="nodeName || '选择大区'" @click="openNodePicker">
                  🌐 {{ nodeName ? `大区: ${nodeName}` : '选择大区' }}
                </button>
                <button type="button" class="classic-btn style-toggle" title="切换到简约气泡版本（输入框吸底）" @click="toggleChatStyle">
                  简约模式
                </button>
                <button type="button" class="classic-btn" @click="clearScreen">清屏</button>
              </template>
            </ChatComposer>
            <div v-else-if="composerReady" class="comment-login-hint">
              <RouterLink to="/login" class="login-link">登录</RouterLink>后参与讨论与收发消息
              <button type="button" class="classic-btn style-toggle" @click="toggleChatStyle">简约模式</button>
              <ChatConnectionStatus />
            </div>

            <!-- 话题编辑展开表单 -->
            <ChatTopicEditor v-if="editingTopic" @close="editingTopic=false" />
            <ChatTopicRecovery />


            <div v-if="isLoggedIn" class="classic-online-bar" aria-label="在线成员" role="region">
              <ChatOnlineList avatars-only />
            </div>
            <span v-if="error" class="top-error-tip">{{ error }}</span>
          </section>

          <!-- 2. 下方消息列表：与输入区在同一个卡片中，自上而下阅读，最新在最上方 -->
          <section class="cr-classic-list">
            <FpLoading v-if="(loading || chat.connecting) && !messages.length" />
            <p v-else-if="messages.length && !visibleMessages.length" class="empty-hint">当前消息已被屏蔽或移入隐藏会话</p>
            <p v-else-if="!messages.length" class="empty-hint">暂无消息，打破宁静发一条吧！</p>

            <ChatBubble
              v-for="msg in classicMessages"
              :id="`chatroom${msg.oId}`"
              :key="msg.oId"
              :user-id="msg.userOId"
              :user-name="msg.userName"
              :nickname="msg.userNickname"
              vip-nickname
              chatroom
              :standalone="Boolean(msg.redPacket)"
              :avatar="msg.userAvatarURL"
              :medals="msg.sysMetal"
              :appearance="msg.appearance"
              :time="msg.time"
              :html="msg.html || ''"
              :self="msg.userName === me"
            >
              <ChatRedPacketCard v-if="msg.redPacket" :packet="msg.redPacket" :packet-id="msg.oId" />
              <ChatCard v-else-if="msg.card" :card="msg.card" />
              <template #reactions>
                <V3ReactionBar kind="chat" :target-id="msg.oId" :initial-state="msg.reactions" :reactions-unavailable="msg.reactionsUnavailable" :initial-read-started="msg.reactionReadStarted" />
              </template>
              <template #actions>
                <ChatRepeatAction v-if="!msg.redPacket && !msg.card" :id="msg.oId" />
                <ChatRevokeAction :id="msg.oId" :author-id="msg.userOId" :red-packet="!!msg.redPacket" />
                <template v-if="!msg.redPacket && accessToken">
                  <button type="button" title="引用消息" :disabled="quoteBusy === msg.oId" @click="quoteMessage(msg)">
                    {{ quoteBusy === msg.oId ? '…' : '引用' }}
                  </button>
                </template>
                <ReportDialog v-if="msg.userOId !== auth.account?.oId && auth.accessToken" :data-id="msg.oId" :data-type="3" />
              </template>
            </ChatBubble>

            <!-- 底部查看更早记录 -->
            <div class="classic-load-bottom">
              <button
                v-if="hasMore && messages.length"
                ref="classicHistoryEnd"
                type="button"
                class="classic-more-btn"
                :disabled="loadingMore"
                @click="chat.loadMore"
              >
                {{ loadingMore ? '加载中…' : '查看更早记录' }}
              </button>
              <span v-else-if="messages.length" class="no-more-tip">已加载全部历史消息</span>
            </div>
          </section>
        </div>
      </main>

      <!-- 经典版右侧边栏（自然流式排布） -->
      <aside class="cr-sidebar-col classic-sidebar">
        <ChatSidebar />
      </aside>
    </div>

    <!-- ==================== 版本 B: 现代气泡版本 (Modern，对齐现网 chat-room-2.ftl) ==================== -->
    <div v-else class="cr-modern-layout">
      <section class="cr-modern-main">
        <!-- 顶部操作栏 -->
        <header class="cr-header">
          <div class="cr-header-left">
            <button
              v-if="isLoggedIn&&nodeOptions.length"
              type="button" class="cr-top-btn node-select-btn"
              :title="nodeName || '选择大区'"
              @click="openNodePicker"
            >
              🌐 {{ nodeName ? `大区: ${nodeName}` : '选择大区' }}
            </button>
          </div>

          <div class="cr-header-right">
            <span v-if="error" class="top-error-tip">{{ error }}</span>
            <button
              type="button"
              class="cr-top-btn style-toggle"
              title="切换到经典版本（输入框在顶部，新消息在最上）"
              @click="toggleChatStyle"
            >
              经典模式
            </button>
            <button v-if="isLoggedIn" type="button" class="cr-top-btn" @click="clearScreen">
              清屏置底
            </button>
            <span class="online-indicator">可见 <b>{{ onlineTotal===null?'—':onlineTotal }}</b></span>
          </div>
        </header>

        <!-- 现代消息滚动展示区 -->
        <div ref="scroller" class="chat-messages-scroll" @scroll="onModernScroll">
          <button
            v-if="hasMore && messages.length"
            type="button"
            class="more-btn"
            :disabled="loadingMore"
            @click="loadOlder"
          >
            {{ loadingMore ? '加载中…' : '查看更早记录' }}
          </button>

          <FpLoading v-if="(loading || chat.connecting) && !messages.length" />
          <p v-else-if="messages.length && !visibleMessages.length" class="empty-hint">当前消息已被屏蔽或移入隐藏会话</p>
          <p v-else-if="!messages.length" class="empty-hint">暂无新消息，快来打破宁静吧！</p>

          <div class="messages-container">
            <ChatBubble
              v-for="msg in visibleMessages"
              :id="`chatroom${msg.oId}`"
              :key="msg.oId"
              :user-id="msg.userOId"
              :user-name="msg.userName"
              :nickname="msg.userNickname"
              vip-nickname
              chatroom
              :standalone="Boolean(msg.redPacket)"
              :avatar="msg.userAvatarURL"
              :medals="msg.sysMetal"
              :appearance="msg.appearance"
              :time="msg.time"
              :html="msg.html || ''"
              :self="msg.userName === me"
            >
              <ChatRedPacketCard v-if="msg.redPacket" :packet="msg.redPacket" :packet-id="msg.oId" />
              <ChatCard v-else-if="msg.card" :card="msg.card" />
              <template #reactions>
                <V3ReactionBar kind="chat" :target-id="msg.oId" :initial-state="msg.reactions" :reactions-unavailable="msg.reactionsUnavailable" :initial-read-started="msg.reactionReadStarted" />
              </template>
              <template #actions>
                <ChatRepeatAction v-if="!msg.redPacket && !msg.card" :id="msg.oId" />
                <ChatRevokeAction :id="msg.oId" :author-id="msg.userOId" :red-packet="!!msg.redPacket" />
                <template v-if="!msg.redPacket && accessToken">
                  <button type="button" title="引用消息" :disabled="quoteBusy === msg.oId" @click="quoteMessage(msg)">
                    {{ quoteBusy === msg.oId ? '…' : '引用' }}
                  </button>
                </template>
                <ReportDialog v-if="msg.userOId !== auth.account?.oId && auth.accessToken" :data-id="msg.oId" :data-type="3" />
              </template>
            </ChatBubble>
          </div>

          <p v-if="!isLoggedIn && visibleMessages.length" class="guest-tip-bottom">
            登录摸鱼派后可实时收发消息、发弹幕抢红包。
          </p>
        </div>

        <!-- 底部吸底输入与工具区 -->
        <div class="cr-composer-panel" @dragover.capture="onBreezemoonDragOver" @drop.capture="onBreezemoonDrop">
          <button v-if="hasNewMessages" type="button" class="cr-top-btn jump-latest" @click="scrollBottom">↓ 查看新消息</button>
          <div v-if="composerReady && isLoggedIn" class="composer-inner">
            <ChatPublicationRecovery @confirmed="acceptConfirmed" />
            <ChatRevokeRecovery />
            <ChatComposer
              adaptive-height
              :height="150"
              ref="composerRef"
              v-model="draft"
              :cache-id="account?.oId?`chatContent:${account.oId}`:''"
              placeholder="说点什么吧！"
              :sending="sending" :chat-send-shortcut="chatPreferences.sendShortcut"
              :disabled="!!publication.pending"
              :allow-empty="Boolean(quote) || breezemoonQuotes.length > 0"
              @submit="submit"
            >
              <template #top>
                <BreezemoonQuotePreview :quotes="breezemoonQuotes" @remove="removeBreezemoonQuote" />
              <div v-if="quote" class="quote-preview-box">
                <div class="quote-info">
                  <span class="quote-label">引用 @{{ quote.userName }}</span>
                  <div v-if="quote.html" class="vditor-reset quote-html" v-html="quote.html" />
                  <div v-else class="quote-html">{{ quote.label }}</div>
                </div>
                <button type="button" class="quote-cancel" title="取消引用" @click="clearQuote">✕</button>
              </div>
              </template>
              <template #tools>
                <button v-for="tool in chatTools" :key="tool.id" type="button" class="composer-tool-btn" :class="{'is-active':toolOpen(tool.id)}" :title="tool.title" :aria-label="tool.title" :aria-expanded="toolOpen(tool.id)" aria-haspopup="dialog" @click="togglePanel(tool.id)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="tool.path" /></svg><span>{{ tool.label }}</span>
                </button>
                <ChatConnectionStatus />
              </template>
              <template #context>
                <div class="classic-topic-pill" :title="discuss">
                  <span class="topic-label">话题</span>
                  <span class="topic-text">{{ discuss || '聊点什么？' }}</span>
                  <button type="button" class="topic-action-btn" title="引用话题" aria-label="引用话题" @click="useTopic">#</button>
                  <button type="button" class="topic-action-btn" title="编辑话题" aria-label="编辑话题" :aria-expanded="editingTopic" @click="editingTopic = !editingTopic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 4 5 5 M4 20l5-1L21 7l-4-4L5 15l-1 5Z" /></svg></button>
                </div>
              </template>
            </ChatComposer>

            <!-- 话题编辑表单 -->
            <ChatTopicEditor v-if="editingTopic" @close="editingTopic=false" />
            <ChatTopicRecovery />

          </div>

          <div v-else-if="composerReady" class="guest-bottom-bar">
            <span>登录后即可参与发言、抢红包与互动。</span>
            <RouterLink to="/login" class="login-link">立即登录</RouterLink>
            <ChatConnectionStatus />
          </div>
        </div>
      </section>

      <!-- 现代版右侧侧边栏（内部滚动） -->
      <aside class="cr-sidebar-col modern-sidebar">
        <ChatSidebar />
      </aside>
    </div>

    <button
      v-if="composerReady && isLoggedIn && (chatStyle === 'modern' || classicComposerAboveView)"
      type="button"
      class="composer-return"
      aria-label="回到输入框"
      title="回到输入框"
      @click="revealComposer"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 15h4v6h6v-6h4l-7-8zM4 3h16v2H4z" /></svg>
    </button>

    <!-- ==================== 浮层与弹窗 ==================== -->
    <!-- 大区节点选择弹层 -->
    <ChatToolDialog v-if="isLoggedIn" :tool="activeTool" @close="activeTool=''" @insert="insertPaint" />
    <FpDialog :open="showNodes && isLoggedIn" title="切换聊天室大区节点" :width="520" @close="showNodes = false">
      <div class="node-grid">
        <button
          v-for="opt in nodeOptions"
          :key="opt.node + opt.name"
          type="button"
          class="node-opt"
          :class="{ current: opt.name === nodeName }"
          @click="pickNode(opt)"
        >
          <span class="opt-name">{{ opt.name }}</span>
          <em v-if="opt.online != null">{{ opt.online }} 人</em>
        </button>
      </div>
    </FpDialog>




  </div>
</template>

<style scoped lang="scss">
.timeline-controls {
  margin: 0;
}

.timeline-controls > button {
  display: none !important;
}

:deep(video),
:deep(iframe) {
  max-width: min(320px, 100%) !important;
  max-height: 200px !important;
  border-radius: 6px;
}

:deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--fp-bg);
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
}

:is(.cr-classic-layout, .cr-modern-layout) {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 3fr);
  gap: var(--fp-page-gap);
}

/* =========================================================
   版本 A：经典版本（Classic，对齐现网 chat-room.ftl）
   ========================================================= */
.cr-classic-layout {
  align-items: start;
  padding: 10px 0 30px;
}

.cr-classic-main {
  min-width: 0;
}

/* 统一的外层卡片（.module） */
.cr-classic-card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius);
  box-shadow: var(--fp-card-shadow);
}

/* 输入区域 */
.cr-classic-reply {
  padding: 16px var(--fp-panel-padding) 12px;
}

.classic-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  min-height: 34px; padding: 6px 10px; border: 1px solid transparent; border-radius: 8px;
  background: transparent; color: var(--fp-muted); font-size: 12px; cursor: pointer;
  transition: background-color .16s, color .16s;
  &:hover { background: var(--fp-hover); color: var(--fp-title); }
  &.style-toggle { background: var(--fp-surface-subtle,var(--fp-bg)); color: var(--fp-text); }
}

/* 输入框容器与文本域：100% 占满宽度 */

.comment-login-hint {
  text-align: center;
  padding: 20px 0;
  color: var(--fp-muted);
  font-size: 13px;
  background: var(--fp-bg);
  border-radius: 6px;
}

.login-link {
  color: var(--fp-accent);
  font-weight: 600;
  text-decoration: underline;
  margin: 0 4px;
}

/* 工具栏与操作行（经典版） */

.composer-tool-btn {
  display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 6px 9px;
  background: transparent; border: 1px solid transparent; color: var(--fp-muted); border-radius: 8px;
  font-size: 12px; cursor: pointer; transition: background-color .16s, color .16s;
  svg { width: 17px; height: 17px; flex: none; }
  &:hover { background: var(--fp-hover); color: var(--fp-title); }
  &.is-active { background: var(--fp-accent-soft,var(--fp-hover)); color: var(--fp-accent); }
}
.classic-topic-pill {
  display: flex; align-items: center; gap: 9px; min-width: 0; width: 100%; box-sizing: border-box;
  padding: 5px 8px 5px 10px; border-left: 2px solid var(--fp-accent); border-radius: 0 7px 7px 0;
  background: var(--fp-surface-subtle,var(--fp-bg)); font-size: 12px;
  .topic-label { color: var(--fp-muted); flex: none; font-size: 11px; }
  .topic-text { flex: 1; min-width: 0; color: var(--fp-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
}
.topic-action-btn {
  display: inline-flex; align-items: center; justify-content: center; flex: none; width: 26px; height: 26px;
  background: transparent; border: 0; border-radius: 6px; cursor: pointer; font-size: 16px; color: var(--fp-muted);
  svg { width: 14px; height: 14px; }
  &:hover, &[aria-expanded='true'] { background: var(--fp-hover); color: var(--fp-accent); }
}
@media(max-width:600px){.composer-tool-btn { padding: 6px 10px; gap: 0; span { display: none; } }.classic-topic-pill { gap: 6px; }}

.classic-online-bar {
  margin-top: 12px;
  border-top: 1px dashed var(--fp-border);
}

/* 下方消息列表 */
.cr-classic-list {
  border-top: 1px solid var(--fp-border);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* =========================================================

/* 消息气泡框 */

/* 气泡尖角 */

/* 经典版底部加载更多 */
.classic-load-bottom {
  display: flex;
  justify-content: center;
  align-items: center;
  padding-top: 16px;
  border-top: 1px dashed var(--fp-border);
}

.classic-more-btn {
  padding: 6px 20px;
  font-size: 12px;
  background: var(--fp-hover);
  border: 1px solid var(--fp-border);
  color: var(--fp-title);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.classic-more-btn:hover {
  border-color: var(--fp-accent);
  color: var(--fp-accent);
}

.no-more-tip {
  color: var(--fp-muted);
  font-size: 12px;
}

.classic-sidebar {
  position: sticky;
  top: calc(var(--fp-nav-h) + 12px);
  max-height: calc(100dvh - var(--fp-nav-h) - 24px);
  overflow-y: auto;
  scrollbar-width: thin;
  overflow-anchor: none;
}

/* =========================================================
   版本 B：现代气泡版本 (Modern，对齐现网 chat-room-2.ftl)
   ========================================================= */
.cr-modern-layout {
  height: calc(100dvh - var(--fp-nav-h) - 24px);
  min-height: 0;
  padding-bottom: 8px;
}

.cr-modern-main {
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius);
  box-shadow: var(--fp-card-shadow);
  position: relative;
}

.modern-sidebar {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
  scrollbar-width: thin;
  scrollbar-color: var(--fp-border) transparent;
  overflow-anchor: none;
}

.modern-sidebar::-webkit-scrollbar {
  width: 5px;
}

.modern-sidebar::-webkit-scrollbar-thumb {
  background: var(--fp-border);
  border-radius: 3px;
}

.cr-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--fp-border);
  background: var(--fp-card);
  flex-shrink: 0;
}

.cr-header-left,
.cr-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cr-top-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-title);
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cr-top-btn:hover {
  background: var(--fp-hover);
  border-color: var(--fp-accent);
  color: var(--fp-accent);
}

.cr-top-btn.style-toggle {
  background: var(--fp-hover);
  border-color: var(--fp-accent);
  color: var(--fp-accent);
  font-weight: 600;
}

.online-indicator {
  font-size: 13px;
  color: var(--fp-muted);
}

.online-indicator b {
  color: var(--fp-accent);
}

.top-error-tip {
  color: #e74c3c;
  font-size: 12px;
}

.top-packet-tip {
  color: #e59230;
  font-size: 12px;
}

/* 现代消息滚动区域 */
.chat-messages-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
}

.more-btn {
  align-self: center;
  margin-bottom: 14px;
  padding: 4px 14px;
  font-size: 12px;
  background: var(--fp-hover);
  border: 1px solid var(--fp-border);
  color: var(--fp-muted);
  border-radius: 12px;
  cursor: pointer;
}

.more-btn:hover {
  color: var(--fp-accent);
  border-color: var(--fp-accent);
}

.empty-hint {
  text-align: center;
  padding: 40px 0;
  color: var(--fp-muted);
  font-size: 13px;
}

.messages-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.guest-tip-bottom {
  text-align: center;
  color: var(--fp-muted);
  font-size: 12px;
  margin-top: 16px;
}

.composer-return {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  z-index: 20;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  color: var(--fp-text);
  cursor: pointer;
}
.composer-return:hover { background: var(--fp-hover); }
.composer-return svg { width: 18px; height: 18px; }
.jump-latest { position: absolute; right: 16px; bottom: calc(100% + 8px); }
/* 让工具栏菜单可以超出编辑器，同时避免内部背景盖住聚焦描边的圆角。 */
.cr-classic-reply :deep(.vditor:not(.vditor--fullscreen)),
.cr-composer-panel :deep(.vditor:not(.vditor--fullscreen)) {
  overflow: visible;
  > .vditor-toolbar { border-radius: 7px 7px 0 0; }
  > .vditor-content :is(.vditor-sv, .vditor-ir > pre, .vditor-wysiwyg > pre, .vditor-preview) {
    border-radius: 0 0 7px 7px;
  }
}
.cr-composer-panel :deep(.vditor:not(.vditor--fullscreen) .vditor-toolbar__item > .vditor-panel--arrow) {
  top: auto;
  bottom: 100%;
  margin-bottom: 6px;
}

/* 现代版吸底输入区域 */
.cr-composer-panel {
  position: relative;
  border-top: 1px solid var(--fp-border);
  background: var(--fp-card);
  padding: 12px 16px;
  flex-shrink: 0;
}

.composer-inner {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.guest-bottom-bar {
  text-align: center;
  padding: 12px 0;
  font-size: 13px;
  color: var(--fp-muted);
}

/* 引用预览 */
.quote-preview-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--fp-hover);
  border-left: 3px solid var(--fp-accent);
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 8px;
}

.quote-label {
  font-weight: 600;
  color: var(--fp-accent);
}

.quote-info {
  flex: 1;
  min-width: 0;
}

.quote-html {
  margin-top: 2px;
  max-height: 64px;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.5;
  color: var(--fp-muted);
  -webkit-mask-image: linear-gradient(180deg, #000 70%, transparent);
  mask-image: linear-gradient(180deg, #000 70%, transparent);
}

.quote-html :deep(p) {
  margin: 0;
}

.quote-html :deep(img:not(.emoji)) {
  max-height: 48px;
  max-width: 120px;
  vertical-align: middle;
}

.quote-html :deep(img.emoji) {
  width: 18px;
  height: 18px;
}

.quote-html :deep(blockquote),
.quote-html :deep(h5) {
  display: none;
}

.quote-cancel {
  border: 0;
  background: transparent;
  color: var(--fp-muted);
  font-size: 14px;
  cursor: pointer;
}

.quote-cancel:hover {
  color: #e74c3c;
}

/* 辅助表单与画板 */
.pop-sub-form {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 10px;
  background: var(--fp-hover);
  border-radius: 6px;
  font-size: 12px;
  flex-wrap: wrap;
}

.pop-sub-form input,
.pop-sub-form select {
  border: 1px solid var(--fp-border);
  background: var(--fp-card);
  color: var(--fp-text);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
}

.pop-btn {
  border: 0;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.pop-btn.green {
  background: var(--fp-accent);
  color: #fff;
}

.pop-btn.ghost {
  background: transparent;
  border: 1px solid var(--fp-border);
  color: var(--fp-muted);
}

.barrage-cost-hint {
  font-size: 11px;
  color: var(--fp-muted);
}

/* =========================================================
   弹窗与浮层
   ========================================================= */



.node-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.node-opt {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid var(--fp-border);
  background: var(--fp-bg);
  color: var(--fp-title);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.node-opt:hover {
  border-color: var(--fp-accent);
}

.node-opt.current {
  border-color: var(--fp-accent);
  background: var(--fp-hover);
  color: var(--fp-accent);
  font-weight: 600;
}

.node-opt em {
  font-style: normal;
  color: var(--fp-muted);
}







.packet-detail-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 240px;
  overflow-y: auto;
}

.packet-detail-list li {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--fp-border);
  font-size: 13px;
}

.packet-detail-list .money {
  color: var(--fp-accent);
  font-weight: 600;
}

/* 响应式适配 */
@media (max-width: 960px) {
  :is(.cr-classic-layout, .cr-modern-layout) {
    grid-template-columns: minmax(0, 1fr);
  }

  .classic-sidebar {
    position: static;
    max-height: none;
    overflow: visible;
  }

  .cr-modern-layout {
    height: auto;
  }

  .cr-modern-main {
    height: calc(100dvh - var(--fp-nav-h) - 20px);
  }

  .cr-composer-panel :deep(.bar) {
    padding-right: calc(52px + env(safe-area-inset-right));
  }

  .modern-sidebar {
    height: auto;
  }
}
</style>
