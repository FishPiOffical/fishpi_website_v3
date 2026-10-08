<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useWhisperStore } from '@/stores/whispers'
import EmojiPicker from '@/components/EmojiPicker.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'

const route = useRoute()
const auth = useAuthStore()
const whispers = useWhisperStore()
const { account, apiKey } = storeToRefs(auth)
const editorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const { messages, sending, loading, error, connected, usingMock, hasMore, loadingMore } = storeToRefs(whispers)

const draft = ref('')
const scroller = ref<HTMLElement | null>(null)
const userName = computed(() => String(route.params.userName || ''))
const me = computed(() => account.value?.userName)

onMounted(() => void whispers.open(userName.value))
onUnmounted(() => whispers.disconnect())

watch(userName, (name) => void whispers.open(name))
watch(
  messages,
  async () => {
    await nextTick()
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
  },
  { deep: true },
)

async function submit() {
  const text = draft.value
  if (!text.trim() || sending.value) return
  draft.value = ''
  await whispers.send(text)
}
</script>

<template>
  <section class="card">
    <header>
      <div>
        <RouterLink to="/chat">← 私信</RouterLink>
        <h1>
          <RouterLink :to="`/member/${userName}`">{{ userName }}</RouterLink>
        </h1>
      </div>
      <span :class="{ on: connected }">{{ connected ? '已连接' : '未连接' }}</span>
    </header>
    <p v-if="usingMock" class="hint">会话未连接，消息仅保存在本地预览。</p>
    <p v-if="error" class="err">{{ error }}</p>
    <div ref="scroller" class="msgs">
      <button v-if="hasMore && messages.length" type="button" class="more" :disabled="loadingMore" @click="whispers.loadMore()">
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
        ref="editorRef"
        v-model="draft"
        :api-key="apiKey"
        :height="150"
        compact
        placeholder="说点什么吧，友善第一哦。Ctrl+Enter 发送，可粘贴或拖拽图片"
        @submit="submit"
      />
      <div class="send-row">
        <EmojiPicker @insert="(md) => editorRef?.insert(md)" />
        <button type="submit" :disabled="sending || !draft.trim() || (!connected && !usingMock)">发送</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  min-height: 70vh;
  max-width: 800px;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--fp-border);
}
header a {
  color: var(--fp-link);
  text-decoration: none;
  font-size: 13px;
}
h1 {
  margin: 4px 0 0;
  font-size: 18px;
}
h1 a {
  font-size: 18px;
  color: inherit;
}
span {
  font-size: 12px;
  color: var(--fp-muted);
}
span.on {
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
  overflow: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 52vh;
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
.meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--fp-muted);
}
.fp-bubble {
  background: var(--fp-hover);
  border-radius: 10px;
  padding: 8px 10px;
}
.is-self .fp-bubble {
  background: var(--fp-self);
}
.composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--fp-border);
}
.send-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.fp-bubble :deep(img) {
  max-width: 100%;
  max-height: 320px;
  border-radius: 6px;
}
.send-row button {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
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
</style>
