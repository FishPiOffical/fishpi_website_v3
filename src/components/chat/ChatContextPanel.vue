<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ChatBubble from '@/components/ChatBubble.vue'
import ChatCard from '@/components/ChatCard.vue'
import ChatRedPacketCard from '@/components/chat/ChatRedPacketCard.vue'
import FpDialog from '@/components/FpDialog.vue'
import { getAuthContextVersion } from '@/api/http'
import { useChatContext } from '@/composables/useChatContext'
import { useAuthStore } from '@/stores/auth'
import { asV3Line } from '@/stores/chat'
const props = defineProps<{ messageId: string }>()
const emit = defineEmits<{ close: []; latest: [] }>()
const context = useChatContext()
const { accessToken, account } = storeToRefs(useAuthStore())
const scrollArea = ref<HTMLOListElement | null>(null)
const rows = computed(() => context.list.value.map(message => ({ unavailable: message.type === 'unavailable', ...asV3Line(message) })))
const identity = computed(() => JSON.stringify([getAuthContextVersion(), !!accessToken.value, account.value?.oId || '']))
watch(identity, (next, previous) => {
  const old = JSON.parse(previous) as [number, boolean, string]
  if (old[1] && old[2] && next !== previous) emit('close')
})
// 登录在后台恢复时，也能自动打开首页选中的消息；普通令牌轮换不重复读取。
watch([() => props.messageId, identity], ([id]) => {
  if (id && accessToken.value && account.value?.oId) void context.open(id)
  else context.close()
}, { immediate: true })
watch(() => context.list.value, async () => {
  const id = props.messageId, list = context.list.value
  await nextTick()
  if (id !== props.messageId || list !== context.list.value) return
  const area = scrollArea.value
  const anchor = area?.querySelector<HTMLElement>('[data-anchor="true"]')
  if (!area) return
  // 只滚动弹窗内列表，避免 scrollIntoView 连带移动背后的聊天室。
  area.scrollTop = anchor ? anchor.offsetTop - (area.clientHeight - anchor.clientHeight) / 2 : 0
})
</script>
<template>
  <FpDialog :open="!!messageId" title="聊天记录" :width="760" @close="emit('close')">
    <div class="chat-context">
      <div class="context-toolbar"><span>消息前后</span><button type="button" @click="emit('latest')">回到聊天室 <span aria-hidden="true">↗</span></button></div>
      <p v-if="!accessToken" class="context-state">登录后查看聊天记录。</p>
      <p v-else-if="context.busy.value" class="context-state" role="status">加载中…</p>
      <p v-if="context.error.value" class="context-state error" role="alert">{{ context.error.value }} <button class="fp-retry-icon" type="button" :disabled="context.busy.value" aria-label="重新加载聊天记录" title="重新加载聊天记录" @click="context.retry">重试</button></p>
      <button v-if="context.hasBefore.value" class="context-page" type="button" :disabled="context.busy.value" @click="context.previous">查看更早消息</button>
      <ol ref="scrollArea" :aria-busy="context.busy.value">
        <li v-for="message in rows" :key="message.oId" :data-anchor="message.oId === messageId" :class="{ anchor: message.oId === messageId }">
          <p v-if="message.unavailable" class="context-state">这条消息暂时无法查看</p>
          <ChatBubble v-else :user-id="message.userOId" :user-name="message.userName" :nickname="message.userNickname" :avatar="message.userAvatarURL" :time="message.time" :appearance="message.appearance" :tail="message.tail" :pet-status="message.petStatus" :message-id="message.oId" :html="message.html" :self="message.userOId === account?.oId" chatroom :standalone="!!message.redPacket || !!message.card">
            <template v-if="message.redPacket || message.card" #default>
            <ChatRedPacketCard v-if="message.redPacket" :packet="message.redPacket" :packet-id="message.oId" />
            <ChatCard v-else-if="message.card" :card="message.card" />
            </template>
          </ChatBubble>
        </li>
      </ol>
      <button v-if="context.hasAfter.value" class="context-page" type="button" :disabled="context.busy.value" @click="context.next">查看更新消息</button>
    </div>
  </FpDialog>
</template>
<style scoped>
.chat-context { min-width:0; overflow-wrap:anywhere; }
.context-toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; color:var(--fp-muted); font-size:12px; }
ol { position:relative; list-style:none; padding:0; margin:12px 0; max-height:55vh; overflow:auto; overscroll-behavior:contain; }
li { padding:14px 8px; border-radius:8px; border:1px solid transparent; }
li.anchor { border-color:color-mix(in srgb,var(--fp-accent) 30%,transparent); background:var(--fp-accent-soft); }
.context-state { margin:12px 0; font-size:13px; color:var(--fp-muted); }
.error { color:var(--fp-danger); }
button { font:inherit; font-size:12px; padding:6px 10px; border:1px solid var(--fp-border); border-radius:7px; background:var(--fp-card); color:var(--fp-text); cursor:pointer; }
button:hover { background:var(--fp-hover); }
button:disabled { opacity:.5; cursor:default; }
.context-page { display:block; margin-inline:auto; }
:deep(img) { max-width:100%; }
</style>
