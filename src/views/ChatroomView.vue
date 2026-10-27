<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink,useRoute,useRouter } from 'vue-router'
import ChatContextPanel from '@/components/chat/ChatContextPanel.vue'
import { storeToRefs } from 'pinia'
import ChatWeatherEditor from '@/components/chat/ChatWeatherEditor.vue'
import ChatWeatherRecovery from '@/components/chat/ChatWeatherRecovery.vue'
import ChatMusicEditor from '@/components/chat/ChatMusicEditor.vue'
import ChatMusicRecovery from '@/components/chat/ChatMusicRecovery.vue'
import ChatBarrageEditor from '@/components/chat/ChatBarrageEditor.vue'
import ChatBarrageRecovery from '@/components/chat/ChatBarrageRecovery.vue'
import {useChatMessageSource} from '@/composables/useChatMessageSource'
import {getAuthContextVersion} from '@/api/http'
import {useV3ChatPublicationStore} from '@/stores/v3ChatPublication'
import ChatRevokeAction from '@/components/chat/ChatRevokeAction.vue'
import ChatRevokeRecovery from '@/components/chat/ChatRevokeRecovery.vue'
import ChatPublicationRecovery from '@/components/chat/ChatPublicationRecovery.vue'
import ChatTopicEditor from '@/components/chat/ChatTopicEditor.vue'
import ChatTopicRecovery from '@/components/chat/ChatTopicRecovery.vue'
import ChatOnlineList from '@/components/chat/ChatOnlineList.vue'
import ChatSidebar from '@/chat/sidebar/ChatSidebar.vue'
import PaintPanel from '@/components/chat/PaintPanel.vue'
import ChatRedPacketCard from '@/components/chat/ChatRedPacketCard.vue'
import ChatRedPacketEditor from '@/components/chat/ChatRedPacketEditor.vue'
import ChatBubble from '@/components/ChatBubble.vue'
import ChatCard from '@/components/ChatCard.vue'
import ChatComposer from '@/components/ChatComposer.vue'
import V3ReactionBar from '@/components/V3ReactionBar.vue'
import ReportDialog from '@/components/ReportDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useChatFilterStore } from '@/stores/chatFilter'
import type { ChatNodeOption } from '@/api/fishpi'
import FpLoading from '@/components/FpLoading.vue'
import FpDialog from '@/components/FpDialog.vue'

const auth = useAuthStore()
const chat = useChatStore(),publication=useV3ChatPublicationStore()
const chatFilter = useChatFilterStore()
const { account, isLoggedIn, apiKey, accessToken } = storeToRefs(auth)
const composerRef = ref<InstanceType<typeof ChatComposer> | null>(null)
const composerReady = ref(false)
const {
  messages,
  sending,
  loading,
  loadingMore,
  hasMore,
  error,
  connected,
  connecting,
  discuss,
  onlineTotal,
  nodeName,
  nodeOptions,
  chatStyle,
} = storeToRefs(chat)
const visibleMessages = computed(() => messages.value.filter((line) => chatFilter.modeFor(line) === 'show'))

const draft = ref('')
watch(()=>JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||'']),()=>{draft.value=''},{flush:'sync'})
const scroller = ref<HTMLElement | null>(null)
const showPacket = ref(false)
const showWeather=ref(false)
const showMusic=ref(false)
const showBarrage = ref(false)
const showPaint = ref(false)

function togglePanel(panel: 'packet' | 'barrage' | 'paint' | 'music' | 'weather') {
  showPacket.value = panel === 'packet' && !showPacket.value
  showBarrage.value = panel === 'barrage' && !showBarrage.value
  showPaint.value = panel === 'paint' && !showPaint.value
  showMusic.value = panel === 'music' && !showMusic.value
  showWeather.value = panel === 'weather' && !showWeather.value
}

const showNodes = ref(false)
const showClassicOnlines = ref(false)
const {quote,quoteBusy,quoteErr,rawText,rawError,rawLoading,rawOpen,quoteMessage:readQuote,showRaw,clearQuote,closeRaw,buildQuoteSuffix}=useChatMessageSource()
const editingTopic = ref(false)

const me = computed(() => account.value?.userName)

// 经典版：最新消息排在最上面！
const classicMessages = computed(() => [...visibleMessages.value].reverse())

const route=useRoute(),router=useRouter(),contextId=ref('')
function syncContextHash(){const match=/^#chatroom(\d{1,32})$/.exec(route.hash);contextId.value=accessToken.value&&account.value?.oId&&match?match[1]!:''}
watch(()=>JSON.stringify([route.hash,!!accessToken.value,account.value?.oId||'']),syncContextHash,{immediate:true})
function openContext(id:string){void router.push({hash:'#chatroom'+id})}
function closeContext(){contextId.value='';if(/^#chatroom\d{1,32}$/.test(route.hash))void router.replace({hash:''})}
async function latestFromContext(){closeContext();await chat.refreshMessages();await nextTick();if(chatStyle.value==='modern')scrollBottom()}

onMounted(async () => {
  composerReady.value = true
  if (!chat.connected && !chat.connecting && !chat.loading) await chat.connect()
  await nextTick()
  if (chatStyle.value === 'modern') {
    scrollBottom()
  }

})

onUnmounted(() => {
  if (!chat.floatingChatroomOpen) chat.disconnect()
})

watch(
  () => messages.value.length,
  async () => {
    if (chatStyle.value === 'modern') {
      await nextTick()
      const el = scroller.value
      if (!el) return
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
        scrollBottom()
      }
    }
  },
)

watch(chatStyle, async (newVal) => {
  if (newVal === 'modern') {
    await nextTick()
    scrollBottom()
  }
})

function scrollBottom() {
  if (scroller.value) {
    scroller.value.scrollTop = scroller.value.scrollHeight
  }
}

async function submit() {
  const text = draft.value
  if (!text.trim() && !quote.value) return
  const content = `${text}${buildQuoteSuffix()}`,reader=JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||''])
  if(await chat.send(content)&&reader===JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||'']))acceptConfirmed(content.trim())
  if (chatStyle.value === 'modern') {
    await nextTick()
    scrollBottom()
  }
}

function acceptConfirmed(content:string){if(`${draft.value}${buildQuoteSuffix()}`.trim()===content){draft.value='';clearQuote()}}

async function quoteMessage(msg:{oId:string}){
 await readQuote(msg.oId)
 if(quote.value?.messageId!==msg.oId)return
 await nextTick()
 if(quote.value?.messageId===msg.oId)composerRef.value?.reveal()
}

function insertPaint(md: string) {
  draft.value += (draft.value && !draft.value.endsWith('\n') ? '\n' : '') + md
  showPaint.value = false
}

async function pickNode(opt: ChatNodeOption) {
  showNodes.value = false
  await chat.switchNode(opt)
}

async function openNodePicker() {
  showNodes.value = !showNodes.value
  if (showNodes.value) await chat.refreshNodes()
}


async function onModernScroll() {
  const el = scroller.value
  if (!el || el.scrollTop > 50 || loadingMore.value || !hasMore.value) return
  const prev = el.scrollHeight
  await chat.loadMore()
  await nextTick()
  el.scrollTop = el.scrollHeight - prev
}

function useTopic() {
  draft.value += ` # ${discuss.value} # `
}

function clearScreen() {
  chat.clearScreen()
}
</script>

<template>
  <div class="cr-page" :class="`theme-${chatStyle}`">
    <ChatPublicationRecovery @confirmed="acceptConfirmed" />
    <ChatRevokeRecovery />
    <ChatTopicRecovery />
    <ChatBarrageRecovery />
    <ChatMusicRecovery />
    <ChatWeatherRecovery />
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
          <section class="cr-classic-reply">
            <ChatComposer
              v-if="composerReady && isLoggedIn"
              ref="composerRef"
              v-model="draft"
              :api-key="apiKey"
              :cache-id="account?.oId?`chatContent:${account.oId}`:''"
              placeholder="说点什么吧！"
              :sending="sending"
              :disabled="!!publication.pending"
              :allow-empty="Boolean(quote)"
              @submit="submit"
            >
              <template #top>
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
                <button type="button" class="classic-tool-btn" title="发放红包" @click="togglePanel('packet')">🧧 红包</button>
                <button type="button" class="classic-tool-btn" title="涂鸦画板" @click="togglePanel('paint')">🎨 涂鸦</button>
                <button type="button" class="classic-tool-btn" title="发送弹幕" @click="togglePanel('barrage')">💬 弹幕</button>
                <button type="button" class="classic-tool-btn" title="分享音乐" @click="togglePanel('music')">♫ 音乐</button>
                <button type="button" class="classic-tool-btn" title="分享天气" @click="togglePanel('weather')">☀ 天气</button>
                <div class="classic-topic-pill" :title="discuss">
                  <span class="topic-label">话题：</span>
                  <span class="topic-text"># {{ discuss }} #</span>
                  <button type="button" class="topic-action-btn" title="引用话题" @click="useTopic">#</button>
                  <button type="button" class="topic-action-btn" title="编辑话题" @click="editingTopic = !editingTopic">✏️</button>
                </div>
              </template>
              <template #actions>
                <button type="button" v-if="nodeOptions.length" class="classic-btn" :title="nodeName || '选择大区'" @click="openNodePicker">
                  🌐 {{ nodeName ? `大区: ${nodeName}` : '选择大区' }}
                </button>
                <button type="button" class="classic-btn style-toggle" title="切换到简约气泡版本（输入框吸底）" @click="chat.toggleChatStyle()">
                  切换样式：简约
                </button>
                <button type="button" class="classic-btn" @click="clearScreen">清屏</button>
              </template>
            </ChatComposer>
            <div v-else-if="composerReady" class="comment-login-hint">
              <RouterLink to="/login" class="login-link">登录</RouterLink>后参与讨论与收发消息
              <button type="button" class="classic-btn style-toggle" @click="chat.toggleChatStyle()">切换样式：简约</button>
            </div>

            <!-- 话题编辑展开表单 -->
            <ChatTopicEditor v-if="editingTopic" @close="editingTopic=false" />

            <!-- 发红包展开表单 -->
            <ChatRedPacketEditor v-if="showPacket" @close="showPacket=false" />

            <!-- 弹幕展开表单 -->
            <ChatBarrageEditor v-if="showBarrage" @close="showBarrage=false" />
            <ChatMusicEditor v-if="showMusic" @close="showMusic=false" />
            <ChatWeatherEditor v-if="showWeather" @close="showWeather=false" />

            <!-- 涂鸦面板 -->
            <div v-if="showPaint" class="paint-box-wrap">
              <PaintPanel @insert="insertPaint" @close="showPaint = false" />
            </div>

            <!-- 在线人数条与折叠面板 -->
            <div class="classic-online-bar">
              <div class="online-stat">
                <span>本次可见人数: <b>{{ onlineTotal===null?'—':onlineTotal }}</b></span>
                <button
                  type="button"
                  class="online-toggle-btn"
                  @click="showClassicOnlines = !showClassicOnlines"
                >
                  {{ showClassicOnlines ? '收起在线列表 ▲' : '展开在线列表 ▼' }}
                </button>
              </div>
              <span v-if="error" class="top-error-tip">{{ error }}</span>
            </div>

            <div v-if="showClassicOnlines"><ChatOnlineList /></div>
          </section>

          <!-- 2. 下方消息列表：与输入区在同一个卡片中，自上而下阅读，最新在最上方 -->
          <section class="cr-classic-list">
            <FpLoading v-if="loading && !messages.length" />
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
              :time="msg.time"
              :html="msg.html || ''"
              :self="msg.userName === me"
            >
              <ChatRedPacketCard v-if="msg.redPacket" :packet="msg.redPacket" :packet-id="msg.oId" />
              <ChatCard v-else-if="msg.card" :card="msg.card" />
              <template #reactions>
                <V3ReactionBar kind="chat" :target-id="msg.oId" />
              </template>
              <template #actions>
                <button type="button" @click="openContext(msg.oId)">上下文</button>
                <ChatRevokeAction :id="msg.oId" :author-id="msg.userOId" :red-packet="!!msg.redPacket" />
                <template v-if="!msg.redPacket && accessToken">
                  <button type="button" title="引用消息" :disabled="quoteBusy === msg.oId" @click="quoteMessage(msg)">
                    {{ quoteBusy === msg.oId ? '…' : '引用' }}
                  </button>
                  <button type="button" title="查看原文" @click="showRaw(msg.oId)">原文</button>
                </template>
                <ReportDialog v-if="msg.userOId !== auth.account?.oId && auth.accessToken" :data-id="msg.oId" :data-type="3" />
              </template>
            </ChatBubble>

            <!-- 底部查看更早记录 -->
            <div class="classic-load-bottom">
              <button
                v-if="hasMore && messages.length"
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
            <span class="cr-status-tag" :class="{ on: connected }">
              <span class="status-dot" />
              {{ connected?'已连接':connecting?'连接中':'未连接' }}
            </span>
          </div>

          <div class="cr-header-right">
            <span v-if="error" class="top-error-tip">{{ error }}</span>
            <button
              type="button"
              class="cr-top-btn style-toggle"
              title="切换到经典版本（输入框在顶部，新消息在最上）"
              @click="chat.toggleChatStyle()"
            >
              切换样式：经典
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
            @click="onModernScroll"
          >
            {{ loadingMore ? '加载中…' : '查看更早记录' }}
          </button>

          <FpLoading v-if="loading && !messages.length" />
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
              :time="msg.time"
              :html="msg.html || ''"
              :self="msg.userName === me"
            >
              <ChatRedPacketCard v-if="msg.redPacket" :packet="msg.redPacket" :packet-id="msg.oId" />
              <ChatCard v-else-if="msg.card" :card="msg.card" />
              <template #reactions>
                <V3ReactionBar kind="chat" :target-id="msg.oId" />
              </template>
              <template #actions>
                <button type="button" @click="openContext(msg.oId)">上下文</button>
                <ChatRevokeAction :id="msg.oId" :author-id="msg.userOId" :red-packet="!!msg.redPacket" />
                <template v-if="!msg.redPacket && accessToken">
                  <button type="button" title="引用消息" :disabled="quoteBusy === msg.oId" @click="quoteMessage(msg)">
                    {{ quoteBusy === msg.oId ? '…' : '引用' }}
                  </button>
                  <button type="button" title="查看原文" @click="showRaw(msg.oId)">原文</button>
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
        <div class="cr-composer-panel">
          <div v-if="composerReady && isLoggedIn" class="composer-inner">
            <ChatComposer
              ref="composerRef"
              v-model="draft"
              :api-key="apiKey"
              :cache-id="account?.oId?`chatContent:${account.oId}`:''"
              placeholder="说点什么吧！"
              :sending="sending"
              :disabled="!!publication.pending"
              :allow-empty="Boolean(quote)"
              @submit="submit"
            >
              <template #top>
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
                <button type="button" class="tool-btn" title="插入涂鸦图片" @click="togglePanel('paint')">🎨 涂鸦</button>
                <button type="button" class="tool-btn" title="发放积分红包" @click="togglePanel('packet')">🧧 红包</button>
                <button type="button" class="tool-btn" title="发射全屏弹幕" @click="togglePanel('barrage')">💬 弹幕</button>
                <button type="button" class="tool-btn" title="分享音乐" @click="togglePanel('music')">♫ 音乐</button>
                <button type="button" class="tool-btn" title="分享天气" @click="togglePanel('weather')">☀ 天气</button>
              </template>
              <template #actions>
                <div class="classic-topic-pill" :title="discuss">
                  <span class="topic-label">话题:</span>
                  <span class="topic-text"># {{ discuss }} #</span>
                  <button type="button" class="topic-action-btn" title="插入" @click="useTopic">#</button>
                  <button type="button" class="topic-action-btn" title="修改" @click="editingTopic = !editingTopic">✏️</button>
                </div>
              </template>
            </ChatComposer>

            <!-- 话题编辑表单 -->
            <ChatTopicEditor v-if="editingTopic" @close="editingTopic=false" />

            <!-- 发红包表单 -->
            <ChatRedPacketEditor v-if="showPacket" @close="showPacket=false" />

            <!-- 弹幕表单 -->
            <ChatBarrageEditor v-if="showBarrage" @close="showBarrage=false" />
            <ChatMusicEditor v-if="showMusic" @close="showMusic=false" />
            <ChatWeatherEditor v-if="showWeather" @close="showWeather=false" />

            <!-- 涂鸦面板 -->
            <div v-if="showPaint" class="paint-box-wrap">
              <PaintPanel @insert="insertPaint" @close="showPaint = false" />
            </div>
          </div>

          <div v-else-if="composerReady" class="guest-bottom-bar">
            <span>登录后即可参与发言、抢红包与互动。</span>
            <RouterLink to="/login" class="login-link">立即登录</RouterLink>
          </div>
        </div>
      </section>

      <!-- 现代版右侧侧边栏（内部滚动） -->
      <aside class="cr-sidebar-col modern-sidebar">
        <ChatSidebar />
      </aside>
    </div>

    <!-- ==================== 浮层与弹窗 ==================== -->
    <!-- 大区节点选择弹层 -->
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

    <!-- Markdown 原文弹窗 -->
    <FpDialog :open="rawOpen" title="消息原文 / 卡片公开摘要" :width="560" @close="closeRaw">
      <FpLoading v-if="rawLoading" small />
      <p v-else-if="rawError" role="alert">{{ rawError }}</p>
      <pre v-else class="raw-pre">{{ rawText||'当前消息原文为空。' }}</pre>
    </FpDialog>


  </div>
</template>

<style scoped>
.cr-page {
  width: 95%;
  max-width: 1400px;
  margin: 0 auto;
}

:deep(video),
:deep(iframe) {
  max-width: 320px !important;
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

/* =========================================================
   版本 A：经典版本（Classic，对齐现网 chat-room.ftl）
   ========================================================= */
.cr-classic-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  padding: 10px 0 30px;
}

.cr-classic-main {
  flex: 1;
  min-width: 0;
}

/* 统一的外层卡片（.module） */
.cr-classic-card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  box-shadow: var(--fp-card-shadow);
}

/* 输入区域 */
.cr-classic-reply {
  padding: 16px 20px 12px;
}

.classic-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-title);
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.classic-btn:hover {
  background: var(--fp-hover);
  border-color: var(--fp-accent);
  color: var(--fp-accent);
}

.classic-btn.style-toggle {
  background: var(--fp-hover);
  border-color: var(--fp-accent);
  color: var(--fp-accent);
  font-weight: 600;
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

.classic-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-title);
  border-radius: 4px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.classic-tool-btn:hover {
  background: var(--fp-hover);
  border-color: var(--fp-accent);
  color: var(--fp-accent);
}

.classic-topic-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--fp-hover);
  border: 1px solid var(--fp-border);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 12px;
  max-width: 300px;
}

.classic-topic-pill .topic-label {
  color: var(--fp-muted);
}

.classic-topic-pill .topic-text {
  color: var(--fp-accent);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-style: normal;
}

.topic-action-btn {
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
  color: var(--fp-link);
}

/* 在线人数条 */
.classic-online-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px dashed var(--fp-border);
  font-size: 12px;
  color: var(--fp-muted);
}

.online-stat b {
  color: var(--fp-accent);
}

.online-toggle-btn {
  background: transparent;
  border: 0;
  color: var(--fp-link);
  cursor: pointer;
  margin-left: 8px;
  font-size: 12px;
}

.classic-online-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  padding: 10px;
  background: var(--fp-bg);
  border-radius: 6px;
  max-height: 140px;
  overflow-y: auto;
}

.classic-online-user {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  font-size: 12px;
  color: var(--fp-title);
  text-decoration: none;
}

.avatar-tiny {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  background-size: cover;
  background-position: center;
  background-color: var(--fp-border);
}

/* 下方消息列表 */
.cr-classic-list {
  border-top: 1px solid var(--fp-border);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
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
  flex: 0 0 280px;
  width: 280px;
}

/* =========================================================
   版本 B：现代气泡版本 (Modern，对齐现网 chat-room-2.ftl)
   ========================================================= */
.cr-modern-layout {
  display: flex;
  gap: 16px;
  height: calc(100vh - var(--fp-nav-h) - 24px);
  min-height: 520px;
  overflow: hidden;
  padding-bottom: 8px;
}

.cr-modern-main {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  box-shadow: var(--fp-card-shadow);
  overflow: hidden;
  position: relative;
}

.modern-sidebar {
  flex: 0 0 280px;
  width: 280px;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
  scrollbar-width: thin;
  scrollbar-color: var(--fp-border) transparent;
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

.cr-status-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--fp-muted);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #bdc3c7;
}

.cr-status-tag.on {
  color: #27ae60;
}

.cr-status-tag.on .status-dot {
  background: #27ae60;
  box-shadow: 0 0 6px rgba(39, 174, 96, 0.5);
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
  gap: 18px;
}

.guest-tip-bottom {
  text-align: center;
  color: var(--fp-muted);
  font-size: 12px;
  margin-top: 16px;
}

/* 现代版吸底输入区域 */
.cr-composer-panel {
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

.tool-btn {
  display: inline-flex;
  align-items: center;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-title);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tool-btn:hover {
  background: var(--fp-hover);
  border-color: var(--fp-accent);
  color: var(--fp-accent);
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

.paint-box-wrap {
  margin-top: 10px;
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





.raw-pre {
  margin: 0;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  padding: 10px;
  border-radius: 6px;
  font-size: 12px;
  max-height: 50vh;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
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
  .cr-page {
    width: 96%;
  }

  .cr-classic-layout {
    flex-direction: column;
  }

  .classic-sidebar {
    width: 100%;
    flex: auto;
  }

  .cr-modern-layout {
    flex-direction: column;
    height: auto;
  }

  .cr-modern-main {
    height: calc(100vh - var(--fp-nav-h) - 20px);
  }

  .modern-sidebar {
    width: 100%;
    flex: auto;
    height: auto;
  }
}
</style>
