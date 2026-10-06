<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import ChatSidebar from '@/chat/sidebar/ChatSidebar.vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

const auth = useAuthStore()
const chat = useChatStore()
const { account } = storeToRefs(auth)
const { messages, sending, error, lastPacket, connected } = storeToRefs(chat)
const draft = ref('')
const scroller = ref<HTMLElement | null>(null)

const me = computed(() => account.value?.userName)

onMounted(async () => {
  await chat.connect()
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
})

onUnmounted(() => chat.disconnect())

async function submit() {
  const text = draft.value
  draft.value = ''
  await chat.send(text)
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
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
      <div ref="scroller" class="msgs">
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
              <p>{{ msg.redPacket.msg || '红包' }}</p>
              <small>{{ msg.redPacket.got || 0 }}/{{ msg.redPacket.count || 0 }}</small>
              <button type="button" @click="chat.openPacket(msg.oId)">领取</button>
            </div>
            <div v-else class="fp-bubble" v-html="msg.html || ''" />
          </div>
        </article>
      </div>
      <form class="composer" @submit.prevent="submit">
        <textarea v-model="draft" rows="3" placeholder="说点什么，支持 Markdown" />
        <button type="submit" :disabled="sending || !draft.trim()">发送</button>
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
.packet button {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 8px;
  padding: 0 16px;
  cursor: pointer;
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
