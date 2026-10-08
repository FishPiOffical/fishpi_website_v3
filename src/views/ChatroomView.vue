<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchBarrageCost, fetchChatRaw } from '@/api/fishpi'
import ChatSidebar from '@/chat/sidebar/ChatSidebar.vue'
import PaintPanel from '@/components/chat/PaintPanel.vue'
import EmojiPicker from '@/components/EmojiPicker.vue'
import MentionSuggest from '@/components/MentionSuggest.vue'
import ReactionBar from '@/components/ReactionBar.vue'
import ReportDialog from '@/components/ReportDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import type { ChatNodeOption } from '@/api/fishpi'

const auth = useAuthStore()
const chat = useChatStore()
const { account, isLoggedIn } = storeToRefs(auth)
const {
  messages,
  sending,
  loading,
  loadingMore,
  hasMore,
  error,
  lastPacket,
  packetDetail,
  connected,
  discuss,
  onlines,
  nodeName,
  nodeOptions,
} = storeToRefs(chat)

const draft = ref('')
const scroller = ref<HTMLElement | null>(null)
const packetMoney = ref(32)
const packetCount = ref(2)
const packetMsg = ref('摸鱼者，人品好！')
const packetType = ref('random')
const packetTo = ref('')
const gesture = ref(0)
const showPacket = ref(false)
const showBarrage = ref(false)
const showPaint = ref(false)
const showNodes = ref(false)
const barrageText = ref('')
const barrageCost = ref('')
const pendingGesture = ref<string | null>(null)
const rawText = ref('')
const rawLoading = ref(false)
const topicDraft = ref('')
const editingTopic = ref(false)
const quote = ref<{ userName: string; messageId: string; content: string } | null>(null)
const quoteBusy = ref('')
const quoteErr = ref('')

const me = computed(() => account.value?.userName)

function scrollToHash() {
  if (typeof location === 'undefined') return
  const id = location.hash.replace(/^#/, '')
  if (!id.startsWith('chatroom')) return
  const el = document.getElementById(id)
  el?.scrollIntoView({ block: 'center' })
}

onMounted(async () => {
  await chat.connect()
  await nextTick()
  scrollBottom()
  scrollToHash()
  if (auth.apiKey) {
    try {
      barrageCost.value = await fetchBarrageCost(auth.apiKey)
    } catch {
      barrageCost.value = ''
    }
  }
})

onUnmounted(() => chat.disconnect())

watch(
  () => messages.value.length,
  async () => {
    await nextTick()
    const el = scroller.value
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) scrollBottom()
  },
)

function scrollBottom() {
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

function buildQuoteSuffix() {
  const q = quote.value
  if (!q?.userName || !q.content) return ''
  const quoteMd = q.content.replace(/\n/g, '\n> ')
  return `\n\n##### 引用 @${q.userName} [↩](/cr#chatroom${q.messageId} "跳转至原消息")  \n> ${quoteMd}\n`
}

async function submit() {
  const text = draft.value
  const content = `${text}${buildQuoteSuffix()}`
  draft.value = ''
  quote.value = null
  await chat.send(content)
  await nextTick()
  scrollBottom()
}

async function quoteMessage(msg: { oId: string; userName: string }) {
  if (!auth.apiKey) return
  quoteBusy.value = msg.oId
  quoteErr.value = ''
  try {
    const content = await fetchChatRaw(auth.apiKey, msg.oId)
    quote.value = { userName: msg.userName, messageId: msg.oId, content: content.trim() }
    await nextTick()
    document.querySelector<HTMLTextAreaElement>('.compose-wrap textarea')?.focus()
  } catch (e) {
    quoteErr.value = e instanceof Error ? e.message : '读取原文失败'
  } finally {
    quoteBusy.value = ''
  }
}

function clearQuote() {
  quote.value = null
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

function onComposerKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void submit()
  }
}

async function onScroll() {
  const el = scroller.value
  if (!el || el.scrollTop > 40) return
  const prev = el.scrollHeight
  await chat.loadMore()
  await nextTick()
  el.scrollTop = el.scrollHeight - prev
}

async function sendPacket() {
  await chat.sendRedPacket({
    money: packetMoney.value,
    count: packetType.value === 'specify' ? 1 : packetCount.value,
    msg: packetMsg.value,
    type: packetType.value,
    recivers: packetType.value === 'specify' ? packetTo.value.split(/[,，\s]+/).filter(Boolean) : undefined,
    gesture: packetType.value === 'rockPaperScissors' ? gesture.value : undefined,
  })
  showPacket.value = false
  await nextTick()
  scrollBottom()
}

async function sendBarrage() {
  await chat.sendBarrage(barrageText.value)
  barrageText.value = ''
  showBarrage.value = false
  await nextTick()
  scrollBottom()
}

async function claim(oId: string, type?: string) {
  if (type === 'rockPaperScissors') {
    pendingGesture.value = oId
    return
  }
  await chat.openPacket(oId)
}

function packetLabel(type?: string) {
  if (type === 'average') return '平均红包'
  if (type === 'specify') return '专属红包'
  if (type === 'rockPaperScissors') return '猜拳红包'
  return '拼手气红包'
}

async function showRaw(oId: string) {
  if (!auth.apiKey) return
  rawLoading.value = true
  rawText.value = ''
  try {
    rawText.value = await fetchChatRaw(auth.apiKey, oId)
  } catch (e) {
    rawText.value = e instanceof Error ? e.message : '无法读取原文'
  } finally {
    rawLoading.value = false
  }
}

async function saveTopic() {
  if (!topicDraft.value.trim()) return
  await chat.setDiscuss(topicDraft.value.trim())
  editingTopic.value = false
  topicDraft.value = ''
}

function useTopic() {
  draft.value += ` # ${discuss.value} # `
}

function clearScreen() {
  chat.clearScreen()
}
</script>

<template>
  <div class="cr-page">
    <div class="cr-wrapper">
      <!-- 聊天室主体 -->
      <section class="cr-main-box">
        <!-- 顶部操作栏 (对齐现网 Rhythm chat-room__header) -->
        <header class="cr-header">
          <div class="cr-header-left">
            <button
              v-if="isLoggedIn"
              type="button"
              class="cr-top-btn node-select-btn"
              :title="nodeName || '选择大区'"
              @click="openNodePicker"
            >
              <span class="icon-server">🌐</span> {{ nodeName ? `大区: ${nodeName}` : '选择大区' }}
            </button>
            <span class="cr-status-tag" :class="{ on: connected }">
              <span class="status-dot" />
              {{ connected ? '已连接' : isLoggedIn ? '连接中' : '访客浏览' }}
            </span>
          </div>

          <div class="cr-header-right">
            <span v-if="error" class="top-error-tip">{{ error }}</span>
            <span v-if="lastPacket" class="top-packet-tip">{{ lastPacket }}</span>
            <button v-if="isLoggedIn" type="button" class="cr-top-btn" @click="clearScreen">
              清屏并置底
            </button>
            <span class="online-indicator">在线 <b>{{ onlines.length }}</b></span>
          </div>
        </header>

        <!-- 大区节点选择弹层 -->
        <div v-if="showNodes && isLoggedIn" class="node-panel">
          <div class="node-panel-head">
            <span class="muted">切换聊天室大区节点（人数供参考）</span>
            <button type="button" class="close-btn" @click="showNodes = false">✕</button>
          </div>
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
        </div>

        <!-- 聊天消息列表展示区 (置于上方，高度自适应滚动) -->
        <div ref="scroller" class="chat-messages-scroll" @scroll="onScroll">
          <button
            v-if="hasMore && messages.length"
            type="button"
            class="more-btn"
            :disabled="loadingMore"
            @click="onScroll"
          >
            {{ loadingMore ? '加载历史消息…' : '查看更早记录' }}
          </button>

          <p v-if="loading && !messages.length" class="empty-hint">正在连接聊天室并拉取消息…</p>
          <p v-else-if="!messages.length" class="empty-hint">暂无新消息，快来打破宁静吧！</p>

          <div class="messages-container">
            <article
              v-for="msg in messages"
              :id="`chatroom${msg.oId}`"
              :key="msg.oId"
              class="chat-bubble-row"
              :class="{ 'is-self': msg.userName === me }"
            >
              <RouterLink :to="`/member/${msg.userName}`" class="chat-avatar-link">
                <span
                  class="chat-avatar-img"
                  :style="msg.userAvatarURL ? { backgroundImage: `url('${msg.userAvatarURL}')` } : undefined"
                />
              </RouterLink>

              <div class="bubble-content-wrap">
                <div class="chat-meta">
                  <RouterLink :to="`/member/${msg.userName}`" class="meta-name">
                    {{ msg.userNickname || msg.userName }}
                  </RouterLink>
                  <time class="meta-time">{{ msg.time }}</time>
                  <div class="meta-actions">
                    <button v-if="msg.userName === me" type="button" class="action-btn" title="撤回" @click="chat.revoke(msg.oId)">
                      撤回
                    </button>
                    <button type="button" class="action-btn" title="查看上下文" @click="chat.loadAround(msg.oId)">
                      附近
                    </button>
                    <button
                      v-if="!msg.redPacket && auth.apiKey"
                      type="button"
                      class="action-btn"
                      :disabled="quoteBusy === msg.oId"
                      title="引用消息"
                      @click="quoteMessage(msg)"
                    >
                      {{ quoteBusy === msg.oId ? '…' : '引用' }}
                    </button>
                    <button v-if="!msg.redPacket && auth.apiKey" type="button" class="action-btn" title="消息原文" @click="showRaw(msg.oId)">
                      原文
                    </button>
                    <ReportDialog v-if="msg.userName !== me && auth.apiKey" :api-key="auth.apiKey" :data-id="msg.oId" :data-type="3" />
                  </div>
                </div>

                <!-- 消息气泡正文 -->
                <div v-if="msg.redPacket" class="chat-bubble packet-bubble">
                  <div class="packet-top">
                    <span class="packet-icon">🧧</span>
                    <strong>{{ packetLabel(msg.redPacket.type) }}</strong>
                  </div>
                  <p class="packet-desc">{{ msg.redPacket.msg || '大吉大利，摸鱼派！' }}</p>
                  <div class="packet-footer">
                    <small>已领 {{ msg.redPacket.got || 0 }} / {{ msg.redPacket.count || 0 }} 个</small>
                    <button v-if="isLoggedIn" type="button" class="claim-btn" @click="claim(msg.oId, msg.redPacket.type)">
                      领取红包
                    </button>
                  </div>
                </div>
                <div v-else class="chat-bubble text-bubble" v-html="msg.html || ''" />

                <!-- 动态表情反应条 -->
                <ReactionBar
                  :summary="msg.reactionSummary"
                  :current="msg.currentUserReaction"
                  :disabled="!auth.apiKey"
                  @toggle="(v) => chat.react(msg.oId, v)"
                />
              </div>
            </article>
          </div>

          <p v-if="!isLoggedIn && messages.length" class="guest-tip-bottom">
            登录摸鱼派后可实时收发消息、发弹幕抢红包。
          </p>
        </div>

        <!-- 弹窗/抽屉详情 (红包明细/原文) -->
        <div v-if="rawText || rawLoading" class="overlay-card">
          <div class="card-head">
            <strong>{{ rawLoading ? '正在读取消息原文…' : 'Markdown 原文' }}</strong>
            <button type="button" class="close-btn" @click="rawText = ''">✕</button>
          </div>
          <pre class="raw-pre">{{ rawText }}</pre>
        </div>

        <div v-if="packetDetail" class="overlay-card">
          <div class="card-head">
            <strong>{{ packetDetail.msg || '红包领取明细' }}</strong>
            <button type="button" class="close-btn" @click="chat.closePacketDetail()">✕</button>
          </div>
          <ul class="packet-detail-list">
            <li v-for="(r, i) in packetDetail.recivers" :key="i">
              <span class="user">{{ r.userName }}</span>
              <span class="money">{{ r.money }} 积分</span>
            </li>
          </ul>
        </div>

        <!-- 底部吸底输入与工具区 (对齐现网 Rhythm chat-room__input) -->
        <div class="cr-composer-panel">
          <div v-if="isLoggedIn" class="composer-inner">
            <!-- 引用预览条 -->
            <div v-if="quote" class="quote-preview-box">
              <div class="quote-info">
                <span class="quote-label">引用 @{{ quote.userName }}</span>
                <p class="quote-text">{{ quote.content.slice(0, 200) }}</p>
              </div>
              <button type="button" class="quote-cancel" title="取消引用" @click="clearQuote">✕</button>
            </div>

            <!-- 输入框主体 -->
            <div class="compose-field-wrap">
              <MentionSuggest v-model="draft" />
              <textarea
                v-model="draft"
                rows="3"
                placeholder="说点什么吧，支持 Markdown。Enter 发送，Shift+Enter 换行。@ 可快速提及鱼油…"
                @keydown="onComposerKey"
              />
            </div>

            <!-- 工具栏与操作行 -->
            <div class="cr-toolbar">
              <div class="tool-actions">
                <EmojiPicker @insert="(md) => (draft += md)" />
                <button
                  type="button"
                  class="tool-btn"
                  title="插入涂鸦图片"
                  @click="showPaint = !showPaint; showPacket = false; showBarrage = false"
                >
                  🎨 涂鸦
                </button>
                <button
                  type="button"
                  class="tool-btn"
                  title="发放积分红包"
                  @click="showPacket = !showPacket; showBarrage = false; showPaint = false"
                >
                  🧧 红包
                </button>
                <button
                  type="button"
                  class="tool-btn"
                  title="发射全屏弹幕"
                  @click="showBarrage = !showBarrage; showPacket = false; showPaint = false"
                >
                  💬 弹幕
                </button>
              </div>

              <!-- 话题与发送 -->
              <div class="composer-right">
                <div class="topic-chip" :title="discuss">
                  <span class="topic-prefix">话题:</span>
                  <em class="topic-text"># {{ discuss }} #</em>
                  <button type="button" class="topic-btn" @click="useTopic">插入</button>
                  <button type="button" class="topic-btn" @click="editingTopic = !editingTopic">改</button>
                </div>

                <button
                  type="button"
                  class="send-btn"
                  :disabled="sending || (!draft.trim() && !quote)"
                  @click="submit"
                >
                  {{ sending ? '发送中…' : '发 送' }}
                </button>
              </div>
            </div>

            <!-- 话题编辑表单 -->
            <form v-if="editingTopic" class="pop-sub-form" @submit.prevent="saveTopic">
              <input v-model="topicDraft" :placeholder="discuss || '输入新话题…'" />
              <button type="submit" class="pop-btn green">保存</button>
              <button type="button" class="pop-btn ghost" @click="editingTopic = false">取消</button>
            </form>

            <!-- 发红包表单 -->
            <form v-if="showPacket" class="pop-sub-form packet-sub-form" @submit.prevent="sendPacket">
              <select v-model="packetType">
                <option value="random">拼手气红包</option>
                <option value="average">普通均分红包</option>
                <option value="specify">专属定向红包</option>
                <option value="rockPaperScissors">猜拳胜利红包</option>
              </select>
              <label>积分: <input v-model.number="packetMoney" type="number" min="1" /></label>
              <label v-if="packetType !== 'specify'">个数: <input v-model.number="packetCount" type="number" min="1" /></label>
              <input v-if="packetType === 'specify'" v-model="packetTo" placeholder="指定接收用户名" />
              <select v-if="packetType === 'rockPaperScissors'" v-model.number="gesture">
                <option :value="0">✊ 石头</option>
                <option :value="1">✌️ 剪刀</option>
                <option :value="2">✋ 布</option>
              </select>
              <input v-model="packetMsg" placeholder="祝福语 (摸鱼者，人品好！)" />
              <button type="submit" class="pop-btn green" :disabled="sending">塞积分</button>
              <button type="button" class="pop-btn ghost" @click="showPacket = false">取消</button>
            </form>

            <!-- 弹幕表单 -->
            <form v-if="showBarrage" class="pop-sub-form" @submit.prevent="sendBarrage">
              <input v-model="barrageText" maxlength="32" placeholder="发一条高亮弹幕（最多 32 字）" />
              <button type="submit" class="pop-btn green" :disabled="sending || !barrageText.trim()">发射</button>
              <button type="button" class="pop-btn ghost" @click="showBarrage = false">取消</button>
              <span v-if="barrageCost" class="barrage-cost-hint">消耗约 {{ barrageCost }}</span>
            </form>

            <!-- 涂鸦面板 -->
            <PaintPanel v-if="showPaint" @insert="insertPaint" @close="showPaint = false" />
          </div>

          <!-- 未登录提示 -->
          <div v-else class="guest-bottom-bar">
            <span>您当前处于访客浏览模式，</span>
            <RouterLink :to="{ path: '/login', query: { redirect: '/cr' } }" class="login-link">
              立即登录
            </RouterLink>
            <span>即可实时发言、领红包与参与社区互动。</span>
          </div>
        </div>
      </section>

      <!-- 聊天室右侧侧栏挂件 -->
      <ChatSidebar />
    </div>
  </div>
</template>

<style scoped>
.cr-page {
  width: 92%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 0 20px;
}

.cr-wrapper {
  display: flex;
  gap: 16px;
  align-items: stretch;
  height: calc(100vh - var(--fp-nav-h) - 40px);
  min-height: 580px;
}

/* 聊天室主容器 (高度固定，内部上滚下吸) */
.cr-main-box {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  box-shadow: var(--fp-card-shadow);
  overflow: hidden;
  position: relative;
}

/* 1. 顶部操作栏 */
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

.top-error-tip {
  color: #e74c3c;
  font-size: 12px;
}

.top-packet-tip {
  color: #e59230;
  font-size: 12px;
}

.cr-top-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-title);
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cr-top-btn:hover {
  background: var(--fp-hover);
  border-color: var(--fp-accent);
  color: var(--fp-accent);
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

/* 节点面板 */
.node-panel {
  padding: 12px 16px;
  border-bottom: 1px solid var(--fp-border);
  background: var(--fp-hover);
  flex-shrink: 0;
}

.node-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.node-panel-head .muted {
  font-size: 12px;
  color: var(--fp-muted);
}

.node-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}

.node-opt {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border: 1px solid var(--fp-border);
  background: var(--fp-card);
  color: var(--fp-title);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.node-opt.current {
  border-color: var(--fp-accent);
  color: var(--fp-accent);
  font-weight: 600;
}

.node-opt em {
  font-style: normal;
  color: var(--fp-muted);
}

/* 2. 消息列表自适应滚动区 */
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
  gap: 16px;
}

/* 消息行排版 (对齐现代聊天室双列气泡) */
.chat-bubble-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.chat-bubble-row.is-self {
  flex-direction: row-reverse;
}

.chat-avatar-link {
  flex-shrink: 0;
}

.chat-avatar-img {
  display: block;
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background-size: cover;
  background-position: center;
  background-color: var(--fp-border);
  border: 1px solid var(--fp-border);
}

.bubble-content-wrap {
  max-width: 75%;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.chat-bubble-row.is-self .bubble-content-wrap {
  align-items: flex-end;
}

.chat-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
}

.chat-bubble-row.is-self .chat-meta {
  flex-direction: row-reverse;
}

.meta-name {
  font-weight: 600;
  color: var(--fp-title);
  text-decoration: none;
}

.meta-time {
  color: var(--fp-muted);
  font-size: 11px;
}

.meta-actions {
  opacity: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: opacity 0.15s ease;
}

.chat-bubble-row:hover .meta-actions {
  opacity: 1;
}

.action-btn {
  background: transparent;
  border: 0;
  color: var(--fp-muted);
  cursor: pointer;
  padding: 0 4px;
  font-size: 11px;
}

.action-btn:hover {
  color: var(--fp-accent);
}

/* 气泡正文样式 */
.chat-bubble {
  position: relative;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.55;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.text-bubble {
  background: var(--fp-hover);
  color: var(--fp-text);
  border: 1px solid var(--fp-border);
}

.chat-bubble-row.is-self .text-bubble {
  background: #e8f4fd;
  border-color: #b9dcf7;
  color: #1a4f78;
}

/* 红包气泡 */
.packet-bubble {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: #fff;
  min-width: 200px;
  box-shadow: 0 4px 12px rgba(231, 76, 60, 0.25);
}

.packet-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.packet-top strong {
  font-size: 14px;
}

.packet-desc {
  margin: 0 0 8px;
  font-size: 13px;
  opacity: 0.95;
}

.packet-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding-top: 6px;
}

.packet-footer small {
  font-size: 11px;
  opacity: 0.8;
}

.claim-btn {
  border: 0;
  background: #f1c40f;
  color: #7f5200;
  font-weight: 600;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.claim-btn:hover {
  background: #f39c12;
}

.guest-tip-bottom {
  text-align: center;
  margin-top: 16px;
  color: var(--fp-muted);
  font-size: 12px;
}

/* 抽屉浮层 */
.overlay-card {
  position: absolute;
  top: 50px;
  left: 20px;
  right: 20px;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  padding: 12px 16px;
  z-index: 100;
  max-height: 70%;
  overflow-y: auto;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.close-btn {
  background: transparent;
  border: 0;
  color: var(--fp-muted);
  font-size: 16px;
  cursor: pointer;
}

.raw-pre {
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 13px;
  background: var(--fp-hover);
  padding: 10px;
  border-radius: 6px;
  color: var(--fp-text);
}

.packet-detail-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.packet-detail-list li {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px dashed var(--fp-border);
  font-size: 13px;
}

.packet-detail-list .money {
  color: #e74c3c;
  font-weight: 600;
}

/* 3. 底部吸底输入与工具面板 (对齐现网 Rhythm PC) */
.cr-composer-panel {
  flex-shrink: 0;
  border-top: 1px solid var(--fp-border);
  background: var(--fp-card);
  padding: 10px 16px 14px;
}

.quote-preview-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--fp-hover);
  border-left: 3px solid var(--fp-accent);
  padding: 6px 10px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.quote-label {
  font-size: 11px;
  color: var(--fp-muted);
  display: block;
}

.quote-text {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--fp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 500px;
}

.quote-cancel {
  background: transparent;
  border: 0;
  color: var(--fp-muted);
  cursor: pointer;
  font-size: 14px;
}

.compose-field-wrap {
  position: relative;
}

.compose-field-wrap textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 64px;
  max-height: 180px;
  padding: 8px 10px;
  border: 1px solid var(--fp-border);
  background: var(--fp-bg);
  color: var(--fp-text);
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  outline: none;
  transition: border-color 0.15s ease;
}

.compose-field-wrap textarea:focus {
  border-color: var(--fp-accent);
}

/* 工具栏 */
.cr-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.tool-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
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

.composer-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.topic-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  background: var(--fp-hover);
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--fp-border);
  max-width: 320px;
}

.topic-prefix {
  color: var(--fp-muted);
}

.topic-text {
  font-style: normal;
  color: var(--fp-accent);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topic-btn {
  background: transparent;
  border: 0;
  color: var(--fp-link);
  cursor: pointer;
  font-size: 11px;
  padding: 0 2px;
}

.send-btn {
  border: 0;
  background: var(--fp-accent);
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  padding: 6px 18px;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 浮动辅助表单 */
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

.guest-bottom-bar {
  text-align: center;
  padding: 12px 0;
  font-size: 13px;
  color: var(--fp-muted);
}

.login-link {
  color: var(--fp-accent);
  font-weight: 600;
  text-decoration: underline;
  margin: 0 4px;
}

@media (max-width: 960px) {
  .cr-page {
    width: 96%;
  }
  .cr-wrapper {
    flex-direction: column;
    height: auto;
  }
  .cr-main-box {
    height: calc(100vh - var(--fp-nav-h) - 30px);
  }
}
</style>
