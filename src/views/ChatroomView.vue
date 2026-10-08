<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchBarrageCost, fetchChatRaw } from '@/api/fishpi'
import ChatSidebar from '@/chat/sidebar/ChatSidebar.vue'
import EmojiPicker from '@/components/EmojiPicker.vue'
import MentionSuggest from '@/components/MentionSuggest.vue'
import ReactionBar from '@/components/ReactionBar.vue'
import ReportDialog from '@/components/ReportDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

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
  <div class="cr">
    <section class="main">
      <header class="top">
        <div>
          <strong>聊天室</strong>
          <span class="status" :class="{ on: connected }">
            {{ connected ? '已连接' : isLoggedIn ? '未连接' : '浏览模式' }}
          </span>
        </div>
        <span class="online">在线 {{ onlines.length }}</span>
      </header>

      <div v-if="isLoggedIn" class="reply">
        <p v-if="quoteErr" class="err">{{ quoteErr }}</p>
        <div v-if="quote" class="quote-bar">
          <div class="quote-meta">
            引用 <b>@{{ quote.userName }}</b>
            <button type="button" class="linkish" @click="clearQuote">取消</button>
          </div>
          <pre class="quote-preview">{{ quote.content.slice(0, 280) }}{{ quote.content.length > 280 ? '…' : '' }}</pre>
        </div>
        <div class="compose-wrap">
          <MentionSuggest v-model="draft" />
          <textarea
            v-model="draft"
            rows="4"
            placeholder="说点什么，支持 Markdown。Enter 发送，Shift+Enter 换行。@ 可补全用户"
            @keydown="onComposerKey"
          />
        </div>

        <div class="toolbar">
          <div class="tools">
            <EmojiPicker @insert="(md) => (draft += md)" />
            <button type="button" class="ghost" title="红包" @click="showPacket = !showPacket; showBarrage = false">
              红包
            </button>
            <button type="button" class="ghost" title="弹幕" @click="showBarrage = !showBarrage; showPacket = false">
              弹幕
            </button>
            <button type="button" class="ghost" @click="clearScreen">清屏</button>
          </div>
          <div class="topic">
            <span class="muted">当前话题：</span>
            <em># {{ discuss }} #</em>
            <button type="button" class="linkish" title="编辑话题" @click="editingTopic = !editingTopic">编辑</button>
            <button type="button" class="linkish" title="插入话题标签" @click="useTopic">话题</button>
          </div>
          <button type="button" class="green" :disabled="sending || (!draft.trim() && !quote)" @click="submit">
            发送
          </button>
        </div>

        <form v-if="editingTopic" class="inline-form" @submit.prevent="saveTopic">
          <input v-model="topicDraft" :placeholder="discuss || '新话题'" />
          <button type="submit" class="green">更新话题</button>
          <button type="button" class="ghost" @click="editingTopic = false">取消</button>
        </form>

        <form v-if="showPacket" class="packet-form" @submit.prevent="sendPacket">
          <select v-model="packetType">
            <option value="random">拼手气</option>
            <option value="average">平均</option>
            <option value="specify">专属</option>
            <option value="rockPaperScissors">猜拳</option>
          </select>
          <label>积分 <input v-model.number="packetMoney" type="number" min="1" /></label>
          <label v-if="packetType !== 'specify'">个数 <input v-model.number="packetCount" type="number" min="1" /></label>
          <input v-if="packetType === 'specify'" v-model="packetTo" placeholder="指定用户名" />
          <select v-if="packetType === 'rockPaperScissors'" v-model.number="gesture">
            <option :value="0">石头</option>
            <option :value="1">剪刀</option>
            <option :value="2">布</option>
          </select>
          <input v-model="packetMsg" placeholder="祝福语" />
          <button type="submit" class="green" :disabled="sending">发出去</button>
          <button type="button" class="ghost" @click="showPacket = false">取消</button>
        </form>

        <form v-if="showBarrage" class="barrage-form" @submit.prevent="sendBarrage">
          <input v-model="barrageText" maxlength="32" placeholder="友善弹幕，最多 32 字" />
          <button type="submit" class="green" :disabled="sending || !barrageText.trim()">发射</button>
          <button type="button" class="ghost" @click="showBarrage = false">取消</button>
          <span v-if="barrageCost" class="muted">约消耗 {{ barrageCost }}</span>
        </form>
      </div>

      <p v-else class="guest-bar">
        <RouterLink :to="{ path: '/login', query: { redirect: '/cr' } }">登录</RouterLink>
        后参与讨论；游客可浏览下方历史消息与侧边在线列表。
      </p>

      <p v-if="error" class="err">{{ error }}</p>
      <p v-if="lastPacket" class="tip">{{ lastPacket }}</p>

      <div v-if="rawText || rawLoading" class="detail">
        <p>{{ rawLoading ? '读取原文…' : '消息原文' }}</p>
        <pre>{{ rawText }}</pre>
        <button type="button" class="ghost" @click="rawText = ''">关闭</button>
      </div>
      <div v-if="packetDetail" class="detail">
        <p>{{ packetDetail.msg || '领取明细' }}</p>
        <ul>
          <li v-for="(r, i) in packetDetail.recivers" :key="i">{{ r.userName }} · {{ r.money }}</li>
        </ul>
        <button type="button" class="ghost" @click="chat.closePacketDetail()">关闭</button>
      </div>
      <div v-if="pendingGesture" class="packet-form">
        <span>出拳</span>
        <select v-model.number="gesture">
          <option :value="0">石头</option>
          <option :value="1">剪刀</option>
          <option :value="2">布</option>
        </select>
        <button type="button" class="green" @click="chat.openPacket(pendingGesture, gesture).then(() => (pendingGesture = null))">
          领取
        </button>
        <button type="button" class="ghost" @click="pendingGesture = null">取消</button>
      </div>

      <div ref="scroller" class="msgs" @scroll="onScroll">
        <button
          v-if="hasMore && messages.length"
          type="button"
          class="more"
          :disabled="loadingMore"
          @click="onScroll"
        >
          {{ loadingMore ? '加载中…' : '加载更早消息' }}
        </button>
        <p v-if="loading && !messages.length" class="tip">加载聊天记录…</p>
        <p v-else-if="!messages.length" class="tip">还没有消息，来说一句吧。</p>
        <article
          v-for="msg in messages"
          :id="`chatroom${msg.oId}`"
          :key="msg.oId"
          class="fp-msg"
          :class="{ 'is-self': msg.userName === me }"
        >
          <span class="fp-avatar-frame">
            <img class="fp-avatar" :src="msg.userAvatarURL || '/favicon.svg'" :alt="msg.userName" />
          </span>
          <div>
            <div class="meta">
              <b><RouterLink :to="`/member/${msg.userName}`">{{ msg.userNickname || msg.userName }}</RouterLink></b>
              <time>{{ msg.time }}</time>
              <button v-if="msg.userName === me" type="button" class="ghost tiny" @click="chat.revoke(msg.oId)">
                撤回
              </button>
              <button type="button" class="ghost tiny" @click="chat.loadAround(msg.oId)">附近</button>
              <button
                v-if="!msg.redPacket && auth.apiKey"
                type="button"
                class="ghost tiny"
                :disabled="quoteBusy === msg.oId"
                @click="quoteMessage(msg)"
              >
                {{ quoteBusy === msg.oId ? '…' : '引用' }}
              </button>
              <button v-if="!msg.redPacket && auth.apiKey" type="button" class="ghost tiny" @click="showRaw(msg.oId)">
                原文
              </button>
              <ReportDialog v-if="msg.userName !== me && auth.apiKey" :api-key="auth.apiKey" :data-id="msg.oId" :data-type="3" />
            </div>
            <div v-if="msg.redPacket" class="fp-bubble packet">
              <strong>{{ packetLabel(msg.redPacket.type) }}</strong>
              <p>{{ msg.redPacket.msg || '红包' }}</p>
              <small>{{ msg.redPacket.got || 0 }}/{{ msg.redPacket.count || 0 }}</small>
              <button v-if="isLoggedIn" type="button" @click="claim(msg.oId, msg.redPacket.type)">领取</button>
            </div>
            <div v-else class="fp-bubble" v-html="msg.html || ''" />
            <ReactionBar
              :summary="msg.reactionSummary"
              :current="msg.currentUserReaction"
              :disabled="!auth.apiKey"
              @toggle="(v) => chat.react(msg.oId, v)"
            />
          </div>
        </article>
        <p v-if="!isLoggedIn && messages.length" class="guest-more">登录后可实时收消息与发言</p>
      </div>
    </section>
    <ChatSidebar />
  </div>
</template>

<style scoped>
.cr {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
  align-items: stretch;
  min-height: calc(100vh - var(--fp-nav-h) - 70px);
}
.main {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  min-height: 0;
  overflow: hidden;
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  border-bottom: 1px solid var(--fp-border);
}
.top strong {
  margin-right: 8px;
  color: var(--fp-head);
}
.status {
  font-size: 12px;
  color: var(--fp-muted);
}
.status.on {
  color: var(--fp-primary);
}
.online {
  font-size: 13px;
  color: var(--fp-muted);
}
.reply {
  padding: 12px 15px 10px;
  border-bottom: 1px solid var(--fp-border);
}
.quote-bar {
  margin-bottom: 8px;
  padding: 8px 10px;
  border: 1px solid var(--fp-border);
  border-radius: 6px;
  background: var(--fp-bg);
}
.quote-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--fp-muted);
  margin-bottom: 4px;
}
.quote-preview {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  color: var(--fp-text);
  max-height: 72px;
  overflow: auto;
}
.compose-wrap {
  position: relative;
}
.compose-wrap textarea {
  width: 100%;
  min-height: 96px;
  resize: vertical;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 6px;
  padding: 10px;
  font: inherit;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.topic {
  flex: 1;
  min-width: 180px;
  font-size: 13px;
}
.topic em {
  font-style: normal;
  color: var(--fp-primary);
  margin-right: 6px;
}
.muted {
  color: var(--fp-muted);
  font-size: 12px;
}
.linkish {
  border: 0;
  background: none;
  color: var(--fp-link);
  cursor: pointer;
  padding: 0 4px;
  font-size: 12px;
}
.green,
.ghost,
.more {
  border: 0;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
}
.green {
  background: var(--fp-primary);
  color: #fff;
}
.ghost {
  background: transparent;
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
}
.inline-form,
.packet-form,
.barrage-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
  padding: 10px;
  background: var(--fp-hover);
  border-radius: 6px;
}
.inline-form input,
.packet-form input,
.barrage-form input,
.packet-form select {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 4px;
  padding: 6px 8px;
}
.barrage-form input {
  flex: 1;
  min-width: 160px;
}
.guest-bar {
  margin: 0;
  padding: 14px 15px;
  border-bottom: 1px solid var(--fp-border);
  color: var(--fp-muted);
  font-size: 13px;
}
.guest-bar a,
.guest-more a {
  color: var(--fp-link);
}
.err {
  margin: 8px 15px 0;
  color: #e07a5f;
  font-size: 13px;
}
.tip {
  margin: 8px 15px 0;
  color: var(--fp-muted);
  font-size: 13px;
}
.detail {
  margin: 8px 15px 0;
  padding: 8px 10px;
  background: var(--fp-hover);
  border-radius: 6px;
  font-size: 13px;
}
.detail ul {
  margin: 6px 0;
  padding-left: 18px;
}
.detail pre {
  white-space: pre-wrap;
  word-break: break-word;
  margin: 6px 0;
  max-height: 160px;
  overflow: auto;
}
.msgs {
  flex: 1;
  min-height: 280px;
  overflow: auto;
  padding: 12px 20px 16px;
}
.more {
  display: block;
  margin: 0 auto 12px;
  background: var(--fp-hover);
  color: var(--fp-text);
}
.fp-msg {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}
.fp-msg.is-self {
  flex-direction: row-reverse;
}
.fp-msg.is-self .meta {
  justify-content: flex-end;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--fp-muted);
}
.meta a {
  color: inherit;
  text-decoration: none;
  font-weight: 600;
}
.tiny {
  padding: 0 6px !important;
  font-size: 12px;
}
.packet {
  background: linear-gradient(180deg, #c45c4a, #a33c2c);
  color: #fff;
  padding: 10px 12px;
  border-radius: 8px;
}
.packet small {
  display: block;
  opacity: 0.85;
  margin: 4px 0;
}
.packet button {
  border: 0;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border-radius: 4px;
  padding: 4px 10px;
  cursor: pointer;
}
.guest-more {
  text-align: center;
  color: var(--fp-muted);
  font-size: 13px;
  padding: 12px 0;
}
@media (max-width: 960px) {
  .cr {
    grid-template-columns: 1fr;
  }
}
</style>
