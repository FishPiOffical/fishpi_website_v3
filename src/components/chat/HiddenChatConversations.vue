<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ChatBubble from '@/components/ChatBubble.vue'
import ChatCard from '@/components/ChatCard.vue'
import HongbaoCard from '@/components/chat/HongbaoCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useChatFilterStore } from '@/stores/chatFilter'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const chat = useChatStore()
const filter = useChatFilterStore()
const auth = useAuthStore()
const { messages, hasMore, loadingMore } = storeToRefs(chat)
const { account } = storeToRefs(auth)
const selectedKey = ref('')

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) close()
}

const conversations = computed(() => {
  const grouped = new Map<
    string,
    { key: string; userName: string; nickname: string; userId?: string; avatar?: string; messages: typeof messages.value }
  >()
  messages.value.forEach((line) => {
    if (filter.modeFor(line) !== 'hide') return
    const key = line.userOId ? `uid:${line.userOId}` : `name:${line.userName.toLocaleLowerCase()}`
    const existing = grouped.get(key)
    if (existing) existing.messages.push(line)
    else {
      grouped.set(key, {
        key,
        userName: line.userName,
        nickname: line.userNickname || line.userName,
        userId: line.userOId,
        avatar: line.userAvatarURL,
        messages: [line],
      })
    }
  })
  return [...grouped.values()].sort((a, b) => {
    const latestA = messages.value.indexOf(a.messages.at(-1)!)
    const latestB = messages.value.indexOf(b.messages.at(-1)!)
    return latestB - latestA
  })
})

watch(
  conversations,
  (list) => {
    if (!list.some((item) => item.key === selectedKey.value)) selectedKey.value = list[0]?.key || ''
  },
  { immediate: true },
)

const selectedConversation = computed(() => conversations.value.find((item) => item.key === selectedKey.value))
const selectedMessages = computed(() => selectedConversation.value?.messages.slice().reverse() || [])

function close() {
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) window.addEventListener('keydown', onKeyDown)
    else window.removeEventListener('keydown', onKeyDown)
  },
)
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

function preview(line: (typeof messages.value)[number]) {
  if (line.redPacket) return '[红包]'
  if (line.card) return line.card.msgType === 'music' ? '[音乐分享]' : '[天气信息]'
  return (line.html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '[消息]'
}
</script>

<template>
  <Teleport v-if="modelValue" to="body">
    <div class="hidden-backdrop" @click.self="close">
      <aside class="hidden-panel" role="dialog" aria-modal="true" aria-label="隐藏会话">
        <header class="head">
          <div>
            <strong>隐藏会话</strong>
            <span>仅显示移入隐藏列表的聊天室消息</span>
          </div>
          <button type="button" aria-label="关闭隐藏会话" @click="close">✕</button>
        </header>

        <div class="conversation-layout">
          <nav class="conversation-list" aria-label="隐藏用户列表">
            <p v-if="!conversations.length" class="empty-list">暂无隐藏会话</p>
            <button
              v-for="item in conversations"
              :key="item.key"
              type="button"
              class="conversation"
              :class="{ selected: selectedKey === item.key }"
              @click="selectedKey = item.key"
            >
              <img :src="item.avatar || '/favicon.svg'" alt="" />
              <span class="conversation-copy">
                <b>{{ item.nickname }}</b>
                <small>{{ preview(item.messages.at(-1)!) }}</small>
              </span>
              <i>{{ item.messages.length }}</i>
            </button>
          </nav>

          <section class="conversation-content">
            <template v-if="selectedConversation">
              <header class="conversation-head">
                <div>
                  <strong>{{ selectedConversation.nickname }}</strong>
                  <small>{{ selectedConversation.userName }}<template v-if="selectedConversation.userId"> · UID {{ selectedConversation.userId }}</template></small>
                </div>
                <div class="conversation-tools">
                  <span>最新在前 · {{ selectedConversation.messages.length }} 条已加载消息</span>
                  <button v-if="hasMore" type="button" :disabled="loadingMore" @click="chat.loadMore">
                    {{ loadingMore ? '加载中…' : '加载更早消息' }}
                  </button>
                </div>
              </header>
              <div class="messages">
                <ChatBubble
                  v-for="line in selectedMessages"
                  :key="line.oId"
                  :user-id="line.userOId"
                  :user-name="line.userName"
                  :nickname="line.userNickname"
                  :avatar="line.userAvatarURL"
                  :medals="line.sysMetal"
                  :time="line.time"
                  :html="line.html || ''"
                  :self="line.userName === account?.userName"
                  vip-nickname
                >
                  <HongbaoCard
                    v-if="line.redPacket"
                    :packet="line.redPacket"
                    :is-sender="line.userName === account?.userName"
                    :user-id="account?.oId"
                    @open="(gesture) => chat.openPacket(line.oId, gesture)"
                  />
                  <ChatCard v-else-if="line.card" :card="line.card" />
                </ChatBubble>
              </div>
            </template>
            <p v-else class="empty-content">选择左侧用户查看其隐藏消息</p>
          </section>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.hidden-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.32);
}
.hidden-panel {
  position: fixed;
  top: 50%;
  left: 40px;
  display: flex;
  flex-direction: column;
  width: min(700px, calc(100vw - 52px));
  height: min(620px, calc(100vh - 40px));
  transform: translateY(-50%);
  overflow: hidden;
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  background: var(--fp-card);
  color: var(--fp-text);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
}
.head,
.conversation-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--fp-border);
}
.head > div,
.conversation-head > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.head strong,
.conversation-head strong {
  color: var(--fp-title);
  font-size: 14px;
}
.head span,
.conversation-head small,
.conversation-tools > span {
  color: var(--fp-muted);
  font-size: 11px;
}
.head button {
  border: 0;
  background: transparent;
  color: var(--fp-muted);
  cursor: pointer;
}
.conversation-layout {
  display: grid;
  flex: 1;
  grid-template-columns: 190px minmax(0, 1fr);
  min-height: 0;
}
.conversation-list {
  overflow: auto;
  padding: 7px;
  border-right: 1px solid var(--fp-border);
}
.conversation {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 6px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--fp-text);
  text-align: left;
  cursor: pointer;
}
.conversation:hover,
.conversation.selected {
  background: var(--fp-hover);
}
.conversation img {
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: 50%;
  object-fit: cover;
}
.conversation-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.conversation-copy b,
.conversation-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conversation-copy b {
  color: var(--fp-title);
  font-size: 12px;
}
.conversation-copy small,
.conversation i {
  color: var(--fp-muted);
  font-size: 10px;
  font-style: normal;
}
.conversation-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.conversation-head {
  flex: none;
  padding: 10px 12px;
}
.conversation-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}
.conversation-tools button {
  padding: 4px 7px;
  border: 1px solid var(--fp-border);
  border-radius: 5px;
  background: transparent;
  color: var(--fp-link);
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
}
.conversation-tools button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
  padding: 12px;
}
.messages :deep(.fp-msg) {
  max-width: 100%;
}
.empty-list,
.empty-content {
  margin: auto;
  padding: 16px;
  color: var(--fp-muted);
  font-size: 12px;
  text-align: center;
}
@media (max-width: 540px) {
  .hidden-panel {
    left: 38px;
    width: calc(100vw - 46px);
  }
  .conversation-layout {
    grid-template-columns: 122px minmax(0, 1fr);
  }
  .conversation-tools > span {
    display: none;
  }
}
</style>
