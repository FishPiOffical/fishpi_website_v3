<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchChatRaw,
} from '@/api/fishpi'
import ChatSidebar from '@/chat/sidebar/ChatSidebar.vue'
import EmojiPicker from '@/components/EmojiPicker.vue'
import MentionSuggest from '@/components/MentionSuggest.vue'
import ReactionBar from '@/components/ReactionBar.vue'
import ReportDialog from '@/components/ReportDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

const auth = useAuthStore()
const chat = useChatStore()
const { account } = storeToRefs(auth)
const { messages, sending, loading, loadingMore, hasMore, error, lastPacket, packetDetail, connected } =
  storeToRefs(chat)
const draft = ref('')
const scroller = ref<HTMLElement | null>(null)
const packetMoney = ref(32)
const packetCount = ref(2)
const packetMsg = ref('摸鱼者，人品好！')
const packetType = ref('random')
const packetTo = ref('')
const gesture = ref(0)
const showPacket = ref(false)
const pendingGesture = ref<string | null>(null)
const rawText = ref('')
const rawLoading = ref(false)

const me = computed(() => account.value?.userName)

onMounted(async () => {
  await chat.connect()
  await nextTick()
  scrollBottom()
})

onUnmounted(() => chat.disconnect())

function scrollBottom() {
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

async function submit() {
  const text = draft.value
  draft.value = ''
  await chat.send(text)
  await nextTick()
  scrollBottom()
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
</script>

<template>
  <div class="cr">
    <section class="main">
      <header>
        <strong>聊天室</strong>
        <span :class="{ on: connected }">{{ connected ? '已连接' : '未连接' }}</span>
      </header>
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
          <li v-for="(r, i) in packetDetail.recivers" :key="i">
            {{ r.userName }} · {{ r.money }}
          </li>
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
        <button type="button" @click="chat.openPacket(pendingGesture, gesture).then(() => (pendingGesture = null))">
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
              <button v-if="!msg.redPacket" type="button" class="ghost tiny" @click="showRaw(msg.oId)">原文</button>
              <ReportDialog v-if="msg.userName !== me && auth.apiKey" :api-key="auth.apiKey" :data-id="msg.oId" :data-type="3" />
            </div>
            <div v-if="msg.redPacket" class="fp-bubble packet">
              <strong>{{ packetLabel(msg.redPacket.type) }}</strong>
              <p>{{ msg.redPacket.msg || '红包' }}</p>
              <small>{{ msg.redPacket.got || 0 }}/{{ msg.redPacket.count || 0 }}</small>
              <button type="button" @click="claim(msg.oId, msg.redPacket.type)">领取</button>
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
      </div>
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
        <button type="submit" :disabled="sending">发出去</button>
        <button type="button" class="ghost" @click="showPacket = false">取消</button>
      </form>
      <form class="composer" @submit.prevent="submit">
        <div class="compose-wrap">
          <MentionSuggest v-model="draft" />
          <textarea
            v-model="draft"
            rows="3"
            placeholder="说点什么，支持 Markdown。Enter 发送，Shift+Enter 换行。@ 可补全用户"
            @keydown="onComposerKey"
          />
        </div>
        <div class="actions">
          <EmojiPicker @insert="(md) => (draft += md)" />
          <button type="button" class="ghost" @click="showPacket = !showPacket">红包</button>
          <button type="submit" :disabled="sending || !draft.trim()">发送</button>
        </div>
      </form>
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
  border-radius: 8px;
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  display: flex;
  flex-direction: column;
  min-height: 70vh;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  border-bottom: 1px solid var(--fp-border);
  font-size: 14px;
  font-weight: 600;
  color: var(--fp-head);
}
header span {
  font-size: 12px;
  font-weight: 400;
  color: var(--fp-muted);
}
header span.on {
  color: var(--fp-green);
}
.msgs {
  flex: 1;
  overflow: auto;
  padding: 12px 15px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 320px;
  max-height: none;
}
.more {
  align-self: center;
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-muted);
  border-radius: 999px;
  padding: 4px 12px;
  cursor: pointer;
}
.fp-msg {
  display: flex;
  gap: 10px;
  max-width: 86%;
}
.fp-msg.is-self {
  margin-left: auto;
  flex-direction: row-reverse;
}
.fp-bubble {
  padding: 8px 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.fp-bubble :deep(p) {
  margin: 0;
}
.fp-bubble :deep(img) {
  max-width: 240px;
}
.packet {
  background: linear-gradient(180deg, #c45c4a, #a33c2c);
  color: #fff;
  min-width: 160px;
}
.packet small {
  display: block;
  opacity: 0.85;
  margin: 4px 0 8px;
}
.meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--fp-muted);
  margin-bottom: 4px;
}
.composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 15px 12px;
  border-top: 1px solid var(--fp-border);
  background: var(--fp-card);
}
.actions {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
textarea {
  flex: 1;
  resize: vertical;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 3px;
  padding: 8px;
  min-height: 64px;
}
.composer button,
.packet button,
.packet-form button {
  border: 0;
  background: var(--fp-green);
  color: #fff;
  border-radius: 3px;
  padding: 6px 14px;
  cursor: pointer;
}
.ghost {
  background: transparent !important;
  color: var(--fp-text) !important;
  border: 1px solid var(--fp-border) !important;
}
.packet-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid var(--fp-border);
  align-items: center;
}
.packet-form input {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 6px;
  padding: 6px 8px;
  width: 88px;
}
.packet-form input[placeholder] {
  width: 180px;
}
.err {
  color: #e07a5f;
  padding: 0 14px;
}
.tip {
  color: var(--fp-muted);
  padding: 0 14px;
  font-size: 12px;
}
.compose-wrap {
  position: relative;
  flex: 1;
}
.compose-wrap textarea {
  width: 100%;
}
.tiny {
  padding: 0 6px !important;
  font-size: 12px;
}
.meta a {
  color: inherit;
  text-decoration: none;
}
.detail {
  margin: 8px 15px;
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
@media (max-width: 960px) {
  .cr {
    grid-template-columns: 1fr;
  }
}
</style>
