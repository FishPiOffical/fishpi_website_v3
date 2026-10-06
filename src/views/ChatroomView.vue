<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import ChatSidebar from '@/chat/sidebar/ChatSidebar.vue'
import EmojiPicker from '@/components/EmojiPicker.vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

const auth = useAuthStore()
const chat = useChatStore()
const { account } = storeToRefs(auth)
const { messages, sending, loading, loadingMore, hasMore, error, lastPacket, connected } =
  storeToRefs(chat)
const draft = ref('')
const scroller = ref<HTMLElement | null>(null)
const packetMoney = ref(32)
const packetCount = ref(2)
const packetMsg = ref('摸鱼者，人品好！')
const showPacket = ref(false)

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
    count: packetCount.value,
    msg: packetMsg.value,
  })
  showPacket.value = false
  await nextTick()
  scrollBottom()
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
              <b>{{ msg.userNickname || msg.userName }}</b>
              <time>{{ msg.time }}</time>
            </div>
            <div v-if="msg.redPacket" class="fp-bubble packet">
              <strong>积分红包</strong>
              <p>{{ msg.redPacket.msg || '红包' }}</p>
              <small>{{ msg.redPacket.got || 0 }}/{{ msg.redPacket.count || 0 }}</small>
              <button type="button" @click="chat.openPacket(msg.oId)">领取</button>
            </div>
            <div v-else class="fp-bubble" v-html="msg.html || ''" />
          </div>
        </article>
      </div>
      <form v-if="showPacket" class="packet-form" @submit.prevent="sendPacket">
        <label>积分 <input v-model.number="packetMoney" type="number" min="1" /></label>
        <label>个数 <input v-model.number="packetCount" type="number" min="1" /></label>
        <input v-model="packetMsg" placeholder="祝福语" />
        <button type="submit" :disabled="sending">发出去</button>
        <button type="button" class="ghost" @click="showPacket = false">取消</button>
      </form>
      <form class="composer" @submit.prevent="submit">
        <textarea
          v-model="draft"
          rows="3"
          placeholder="说点什么，支持 Markdown。Enter 发送，Shift+Enter 换行"
          @keydown="onComposerKey"
        />
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
  align-items: start;
}
.main {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  min-height: 70vh;
}
header {
  display: flex;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--fp-border);
}
header span {
  font-size: 12px;
  color: var(--fp-muted);
}
header span.on {
  color: var(--fp-primary);
}
.msgs {
  flex: 1;
  overflow: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 58vh;
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
  gap: 8px;
  padding: 10px;
  border-top: 1px solid var(--fp-border);
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
  border-radius: 8px;
  padding: 8px;
}
.composer button,
.packet button,
.packet-form button {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 8px;
  padding: 8px 16px;
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
@media (max-width: 960px) {
  .cr {
    grid-template-columns: 1fr;
  }
}
</style>
