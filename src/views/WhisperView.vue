<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useWhisperStore } from '@/stores/whispers'
import type { WhisperMsg } from '@/api/fishpi'
import EmojiPicker from '@/components/EmojiPicker.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const whispers = useWhisperStore()
const { account, apiKey } = storeToRefs(auth)
const editorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const { list, listLoading, unreadBy, messages, sending, loading, error, connected, usingMock, hasMore, loadingMore } =
  storeToRefs(whispers)

const draft = ref('')
const toUser = ref('')
const scroller = ref<HTMLElement | null>(null)
const userName = computed(() => String(route.params.userName || ''))
const me = computed(() => account.value?.userName || '')

function peer(msg: WhisperMsg) {
  return whispers.peerOf(msg, me.value)
}

function peerAvatar(msg: WhisperMsg) {
  return (msg.senderUserName === me.value ? msg.receiverAvatar : msg.senderAvatar) || '/favicon.svg'
}

onMounted(() => {
  void whispers.loadList()
  if (userName.value) void whispers.open(userName.value)
})
onUnmounted(() => whispers.disconnect())

watch(userName, (name) => {
  draft.value = ''
  if (name) void whispers.open(name)
  else whispers.disconnect()
})
let stickToBottom = true

function toBottom() {
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

function onScroll() {
  const el = scroller.value
  if (el) stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

function onMediaLoad() {
  if (stickToBottom) toBottom()
}

let resizeObs: ResizeObserver | null = null
watch(scroller, (el, _, onCleanup) => {
  if (!el || typeof ResizeObserver === 'undefined') return
  resizeObs = new ResizeObserver(onMediaLoad)
  resizeObs.observe(el)
  onCleanup(() => resizeObs?.disconnect())
})

watch(
  messages,
  async () => {
    await nextTick()
    if (stickToBottom) toBottom()
  },
  { deep: true },
)
watch(userName, () => {
  stickToBottom = true
})

async function loadOlder() {
  const el = scroller.value
  const fromBottom = el ? el.scrollHeight - el.scrollTop : 0
  stickToBottom = false
  await whispers.loadMore()
  await nextTick()
  if (el) el.scrollTop = el.scrollHeight - fromBottom
}

function startChat() {
  const name = toUser.value.trim()
  if (!name) return
  toUser.value = ''
  void router.push(`/chat/${encodeURIComponent(name)}`)
}

async function submit() {
  const text = draft.value
  if (!text.trim() || sending.value) return
  draft.value = ''
  await whispers.send(text)
}
</script>

<template>
  <div class="whisper" :class="{ 'has-peer': userName }">
    <aside class="peers">
      <form class="start" @submit.prevent="startChat">
        <input v-model="toUser" placeholder="输入用户名发起私信" />
        <button type="submit" :disabled="!toUser.trim()">发起</button>
      </form>
      <p v-if="listLoading && !list.length" class="hint">加载中…</p>
      <p v-else-if="!list.length" class="hint">还没有私信</p>
      <ol v-else>
        <li v-for="item in list" :key="peer(item)">
          <RouterLink :to="`/chat/${encodeURIComponent(peer(item))}`" :class="{ current: peer(item) === userName }">
            <img class="fp-avatar" :src="peerAvatar(item)" alt="" />
            <div class="peer-main">
              <div class="peer-head">
                <b>{{ peer(item) }}</b>
                <time>{{ item.time }}</time>
              </div>
              <p>{{ item.preview || item.markdown || '…' }}</p>
            </div>
            <em v-if="unreadBy[peer(item)] && peer(item) !== userName" class="badge">{{ unreadBy[peer(item)] }}</em>
          </RouterLink>
        </li>
      </ol>
    </aside>

    <section v-if="userName" class="chat">
      <header>
        <RouterLink to="/chat" class="back">←</RouterLink>
        <h1>
          <RouterLink :to="`/member/${userName}`">{{ userName }}</RouterLink>
        </h1>
        <span :class="{ on: connected }">{{ connected ? '已连接' : '未连接' }}</span>
      </header>
      <p v-if="usingMock" class="hint">会话未连接，消息仅保存在本地预览。</p>
      <p v-if="error" class="err">{{ error }}</p>
      <div ref="scroller" class="msgs" @scroll.passive="onScroll" @load.capture="onMediaLoad">
        <button
          v-if="hasMore && messages.length"
          type="button"
          class="more"
          :disabled="loadingMore"
          @click="loadOlder"
        >
          {{ loadingMore ? '加载中…' : '加载更早消息' }}
        </button>
        <p v-if="loading && !messages.length" class="hint">加载中…</p>
        <p v-else-if="!messages.length" class="hint">还没有消息，打个招呼吧。</p>
        <article
          v-for="msg in messages"
          :key="msg.oId"
          class="fp-msg"
          :class="{ 'is-self': msg.senderUserName === me }"
        >
          <img class="fp-avatar" :src="msg.senderAvatar || '/favicon.svg'" alt="" />
          <div>
            <div class="meta">
              <b>{{ msg.senderUserName }}</b>
              <time>{{ msg.time }}</time>
              <button v-if="msg.senderUserName === me" type="button" class="ghost" @click="whispers.revoke(msg.oId)">
                撤回
              </button>
            </div>
            <div class="fp-bubble" v-html="msg.content || msg.markdown || msg.preview || ''" />
          </div>
        </article>
      </div>
      <form class="composer" @submit.prevent="submit">
        <MarkdownEditor
          :key="userName"
          ref="editorRef"
          :cache-id="`whisper-${userName}`"
          v-model="draft"
          :api-key="apiKey"
          :height="150"
          compact
          placeholder="说点什么吧，友善第一哦。"
          @submit="submit"
        />
        <div class="send-row">
          <EmojiPicker @insert="(md) => editorRef?.insert(md)" />
          <button type="submit" :disabled="sending || !draft.trim() || (!connected && !usingMock)">发送</button>
        </div>
      </form>
    </section>
    <section v-else class="chat empty">
      <p>选择左侧的会话，或输入用户名发起私信</p>
    </section>
  </div>
</template>

<style scoped>
.whisper {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 15px;
  max-width: var(--fp-wrap);
  margin: 0 auto;
  height: calc(100vh - var(--fp-nav-h) - 60px);
  min-height: 480px;
}
.peers,
.chat {
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  min-height: 0;
}
.peers {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.start {
  display: flex;
  gap: 6px;
  padding: 10px;
  border-bottom: 1px solid var(--fp-border);
}
.start input {
  flex: 1;
  min-width: 0;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 13px;
}
.start button,
.send-row button {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
}
.peers ol {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}
.peers li a {
  position: relative;
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  color: inherit;
  text-decoration: none;
  border-left: 3px solid transparent;
}
.peers li a:hover {
  background: var(--fp-hover);
}
.peers li a.current {
  background: var(--fp-hover);
  border-left-color: var(--fp-primary);
}
.peers .fp-avatar {
  width: 40px;
  height: 40px;
  flex: none;
}
.peer-main {
  flex: 1;
  min-width: 0;
}
.peer-head {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  align-items: baseline;
}
.peer-head b {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.peer-head time {
  flex: none;
  font-size: 11px;
  color: var(--fp-muted);
}
.peer-main p {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--fp-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge {
  position: absolute;
  top: 6px;
  left: 42px;
  min-width: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #c45c4a;
  color: #fff;
  font-size: 10px;
  font-style: normal;
  line-height: 16px;
  text-align: center;
}
.chat {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.chat.empty {
  align-items: center;
  justify-content: center;
  color: var(--fp-muted);
  font-size: 14px;
}
.chat header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--fp-border);
}
.back {
  display: none;
  color: var(--fp-link);
  text-decoration: none;
}
h1 {
  flex: 1;
  margin: 0;
  font-size: 16px;
}
h1 a {
  color: inherit;
  text-decoration: none;
}
header span {
  font-size: 12px;
  color: var(--fp-muted);
}
header span.on {
  color: var(--fp-primary);
}
.hint,
.err {
  padding: 0 16px;
  font-size: 13px;
}
.err {
  color: #e07a5f;
}
.hint {
  color: var(--fp-muted);
}
.msgs {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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
.fp-msg .fp-avatar {
  width: 36px;
  height: 36px;
  flex: none;
}
.meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--fp-muted);
}
.is-self .meta {
  justify-content: flex-end;
}
.fp-bubble {
  background: var(--fp-hover);
  border-radius: 10px;
  padding: 8px 10px;
  overflow-wrap: anywhere;
}
.is-self .fp-bubble {
  background: var(--fp-self);
}
.fp-bubble :deep(img) {
  max-width: 100%;
  max-height: 320px;
  border-radius: 6px;
}
.fp-bubble :deep(p) {
  margin: 0;
}
.composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--fp-border);
}
.send-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.more,
.ghost {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-muted);
  border-radius: 8px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 12px;
}
.more {
  align-self: center;
}
button:disabled {
  opacity: 0.55;
}

@media (max-width: 768px) {
  .whisper {
    grid-template-columns: 1fr;
    height: calc(100vh - var(--fp-nav-h) - 40px);
  }
  .whisper.has-peer .peers,
  .whisper:not(.has-peer) .chat {
    display: none;
  }
  .back {
    display: inline;
  }
}
</style>
