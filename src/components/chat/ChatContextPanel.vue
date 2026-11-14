<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ChatBubble from '@/components/ChatBubble.vue'
import ChatCard from '@/components/ChatCard.vue'
import ChatRedPacketCard from '@/components/chat/ChatRedPacketCard.vue'
import { getAuthContextVersion } from '@/api/http'
import { useChatContext } from '@/composables/useChatContext'
import { useAuthStore } from '@/stores/auth'
import { asV3Line } from '@/stores/chat'
const props = defineProps<{ messageId: string; contained?: boolean; reverse?: boolean }>()
const emit = defineEmits<{ close: []; latest: [] }>()
const context = useChatContext()
const { accessToken, account } = storeToRefs(useAuthStore())
const scrollArea = ref<HTMLElement | null>(null)
const messageList = ref<HTMLOListElement | null>(null)
let keepAnchor = false
let layoutObserver: ResizeObserver | undefined
let locateFrame = 0
const rows = computed(() => {
  const messages = props.reverse ? [...context.list.value].reverse() : context.list.value
  return messages.map(message => ({ unavailable: message.type === 'unavailable', ...asV3Line(message) }))
})
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
function locateAnchor() {
  const area = scrollArea.value
  const anchor = area?.querySelector<HTMLElement>('[data-anchor="true"]')
  if (!area) return
  if (props.contained) {
    // 简约模式只移动消息区，输入框和侧栏保持原位。
    area.scrollTop = anchor
      ? area.scrollTop + anchor.getBoundingClientRect().top - area.getBoundingClientRect().top - (area.clientHeight - anchor.clientHeight) / 2
      : 0
  } else {
    // 经典模式与主列表共用页面滚动，等真实历史节点挂载后再定位。
    (anchor || area).scrollIntoView?.({ block: anchor ? 'center' : 'start' })
  }
}
watch(() => context.list.value, async () => {
  keepAnchor = false
  const id = props.messageId, list = context.list.value
  await nextTick()
  if (!list.length || id !== props.messageId || list !== context.list.value) return
  keepAnchor = list.some(message => message.id === id)
  locateAnchor()
})
function reveal() {
  if (context.list.value.some(message => message.id === props.messageId)) {
    keepAnchor = true
    locateAnchor()
  }
  else if (!context.busy.value) void context.read()
}
defineExpose({ reveal })
function stopKeepingAnchor() { keepAnchor = false }
function onScrollKey(event: KeyboardEvent) {
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) stopKeepingAnchor()
}
onMounted(() => {
  // 图片和头像晚于正文加载时继续对准原消息；用户开始操作后不再抢滚动位置。
  if (typeof ResizeObserver !== 'undefined' && messageList.value) {
    layoutObserver = new ResizeObserver(() => {
      if (!keepAnchor) return
      cancelAnimationFrame(locateFrame)
      locateFrame = requestAnimationFrame(() => { if (keepAnchor) locateAnchor() })
    })
    layoutObserver.observe(messageList.value)
  }
  if (typeof window === 'undefined') return
  window.addEventListener('wheel', stopKeepingAnchor, { passive: true })
  window.addEventListener('touchstart', stopKeepingAnchor, { passive: true })
  window.addEventListener('pointerdown', stopKeepingAnchor, { passive: true })
  window.addEventListener('keydown', onScrollKey)
})
onBeforeUnmount(() => {
  keepAnchor = false
  layoutObserver?.disconnect()
  if (typeof window === 'undefined') return
  cancelAnimationFrame(locateFrame)
  window.removeEventListener('wheel', stopKeepingAnchor)
  window.removeEventListener('touchstart', stopKeepingAnchor)
  window.removeEventListener('pointerdown', stopKeepingAnchor)
  window.removeEventListener('keydown', onScrollKey)
})
</script>
<template>
    <section ref="scrollArea" class="chat-context" :class="{ 'chat-context-contained': contained }" aria-label="引用消息前后的聊天记录" tabindex="0">
      <div class="context-toolbar"><span>正在查看历史消息</span><button type="button" @click="emit('latest')">回到最新消息 <span aria-hidden="true">↗</span></button></div>
      <p v-if="!accessToken" class="context-state">登录后查看聊天记录。</p>
      <p v-else-if="context.busy.value" class="context-state" role="status">加载中…</p>
      <p v-if="context.error.value" class="context-state error" role="alert">{{ context.error.value }} <button class="fp-retry-icon" type="button" :disabled="context.busy.value" aria-label="重新加载聊天记录" title="重新加载聊天记录" @click="context.retry">重试</button></p>
      <button v-if="reverse ? context.hasAfter.value : context.hasBefore.value" class="context-page" type="button" :disabled="context.busy.value" @click="reverse ? context.next() : context.previous()">{{ reverse ? '查看更新消息' : '查看更早消息' }}</button>
      <ol ref="messageList" :aria-busy="context.busy.value">
        <li v-for="message in rows" :id="`chatroom${message.oId}`" :key="message.oId" :data-anchor="message.oId === messageId" :class="{ anchor: message.oId === messageId }">
          <p v-if="message.unavailable" class="context-state">这条消息暂时无法查看</p>
          <ChatBubble v-else :user-id="message.userOId" :user-name="message.userName" :nickname="message.userNickname" :avatar="message.userAvatarURL" :time="message.time" :appearance="message.appearance" :tail="message.tail" :pet-status="message.petStatus" :message-id="message.oId" :html="message.html" :source="message.content" :self="message.userOId === account?.oId" chatroom :standalone="!!message.redPacket || !!message.card">
            <template v-if="message.redPacket || message.card" #default>
            <ChatRedPacketCard v-if="message.redPacket" :packet="message.redPacket" :packet-id="message.oId" />
            <ChatCard v-else-if="message.card" :card="message.card" />
            </template>
          </ChatBubble>
        </li>
      </ol>
      <button v-if="reverse ? context.hasBefore.value : context.hasAfter.value" class="context-page" type="button" :disabled="context.busy.value" @click="reverse ? context.previous() : context.next()">{{ reverse ? '查看更早消息' : '查看更新消息' }}</button>
    </section>
</template>
<style scoped>
.chat-context { min-width:0; padding:16px 24px; border-top:1px solid var(--fp-border); overflow-wrap:anywhere; scroll-margin-top:calc(var(--fp-nav-h, 58px) + 12px); }
.chat-context-contained { flex:1; min-height:0; overflow-y:auto; overflow-anchor:none; overscroll-behavior:contain; }
.context-toolbar { position:sticky; top:calc(var(--fp-nav-h, 58px) + 4px); z-index:2; display:flex; justify-content:space-between; align-items:center; gap:12px; padding:8px 0; background:var(--fp-card); color:var(--fp-muted); font-size:12px; }
.chat-context-contained .context-toolbar { top:-16px; }
ol { position:relative; list-style:none; padding:0; margin:12px 0; }
li { padding:14px 8px; border-radius:8px; border:1px solid transparent; }
li.anchor { border-color:color-mix(in srgb,var(--fp-accent) 30%,transparent); background:var(--fp-accent-soft); }
.context-state { margin:12px 0; font-size:13px; color:var(--fp-muted); }
.error { color:var(--fp-danger); }
button { font:inherit; font-size:12px; padding:6px 10px; border:1px solid var(--fp-border); border-radius:7px; background:var(--fp-card); color:var(--fp-text); cursor:pointer; }
button:hover { background:var(--fp-hover); }
button:disabled { opacity:.5; cursor:default; }
.context-page { display:block; margin-inline:auto; }
:deep(img) { max-width:100%; }
@media (max-width:640px) { .chat-context { padding-inline:12px; } li { padding-inline:4px; } }
</style>
