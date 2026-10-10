<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import ChatBubble from '@/components/ChatBubble.vue'
import ChatComposer from '@/components/ChatComposer.vue'
import FpLoading from '@/components/FpLoading.vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useChatFilterStore } from '@/stores/chatFilter'
import { useWhisperStore } from '@/stores/whispers'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const auth = useAuthStore()
const chat = useChatStore()
const chatFilter = useChatFilterStore()
const whispers = useWhisperStore()
const route = useRoute()
const router = useRouter()
const { account, apiKey } = storeToRefs(auth)
const { list, listLoading, unreadBy, unreadTotal, messages, sending, loading, error, connected, connecting, usingMock, hasMore, loadingMore, inboxPeer } =
  storeToRefs(whispers)
const {
  messages: roomMessages,
  connected: roomConnected,
  connecting: roomConnecting,
  loading: roomLoading,
  error: roomError,
  sending: roomSending,
  hasMore: roomHasMore,
  loadingMore: roomLoadingMore,
} = storeToRefs(chat)
const CHATROOM_PEER = '__fishpi_chatroom__'
const CHATROOM_LABEL = '聊天室'
const selectedPeer = ref('')
const toUser = ref('')
const draft = ref('')
const isChatroomSelected = computed(() => selectedPeer.value === CHATROOM_PEER)
const visibleRoomMessages = computed(() => roomMessages.value.filter((line) => chatFilter.modeFor(line) === 'show'))
const canSend = computed(() => isChatroomSelected.value
  ? Boolean(draft.value.trim()) && !roomSending.value && roomConnected.value
  : Boolean(draft.value.trim()) && !sending.value && (connected.value || usingMock.value))
const connectionLabel = computed(() => connected.value ? '已连接' : connecting.value ? '连接中' : '已断开')
const roomConnectionLabel = computed(() => roomConnected.value ? '已连接' : roomConnecting.value ? '连接中' : '已断开')
const scroller = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const isCompactPanel = ref(false)
const PANEL_GEOMETRY_KEY = 'fp_whisper_panel_geometry_v1'

interface PanelGeometry {
  hasCustomPosition: boolean
  left: number
  top: number
  hasCustomSize: boolean
  width: number
  height: number
}

function readPanelGeometry(): PanelGeometry | null {
  if (import.meta.env.SSR || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(PANEL_GEOMETRY_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<PanelGeometry>
    const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
    if (
      typeof saved.hasCustomPosition !== 'boolean' ||
      typeof saved.hasCustomSize !== 'boolean' ||
      !finite(saved.left) || !finite(saved.top) || !finite(saved.width) || !finite(saved.height)
    ) return null
    const maxWidth = Math.max(1, window.innerWidth - 16)
    const maxHeight = Math.max(1, window.innerHeight - 16)
    return {
      hasCustomPosition: saved.hasCustomPosition,
      left: Math.max(8, Math.min(saved.left, window.innerWidth - Math.min(saved.width, maxWidth) - 8)),
      top: Math.max(8, Math.min(saved.top, window.innerHeight - Math.min(saved.height, maxHeight) - 8)),
      hasCustomSize: saved.hasCustomSize,
      width: Math.max(Math.min(320, maxWidth), Math.min(saved.width, maxWidth)),
      height: Math.max(Math.min(360, maxHeight), Math.min(saved.height, maxHeight)),
    }
  } catch {
    return null
  }
}

const savedGeometry = readPanelGeometry()
const hasCustomPosition = ref(savedGeometry?.hasCustomPosition ?? false)
const position = ref({ left: savedGeometry?.left ?? 0, top: savedGeometry?.top ?? 0 })
const hasCustomSize = ref(savedGeometry?.hasCustomSize ?? false)
const size = ref({ width: savedGeometry?.width ?? 700, height: savedGeometry?.height ?? 620 })
let draggingPointer: number | null = null
let dragOffset = { x: 0, y: 0 }
let resizingPointer: number | null = null
let resizeDirection: 'nw' | 'se' = 'se'
let resizeStart = { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 }
let panelResizeObserver: ResizeObserver | null = null

function peerOf(msg: (typeof list.value)[number]) {
  return whispers.peerOf(msg, account.value?.userName)
}

function peerAvatar(msg: (typeof list.value)[number]) {
  return (msg.senderUserName === account.value?.userName ? msg.receiverAvatar : msg.senderAvatar) || '/favicon.svg'
}

function close() {
  emit('update:modelValue', false)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) close()
}

function clampPosition(left: number, top: number) {
  const element = panel.value
  if (!element) return { left, top }
  const width = hasCustomSize.value ? size.value.width : element.offsetWidth
  const height = hasCustomSize.value ? size.value.height : element.offsetHeight
  return {
    left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
    top: Math.max(8, Math.min(top, window.innerHeight - height - 8)),
  }
}

function startDragging(e: PointerEvent) {
  if (e.button !== 0 || (e.target as HTMLElement).closest('button, a, input, textarea, select, [contenteditable="true"]')) return
  const element = panel.value
  if (!element) return
  const bounds = element.getBoundingClientRect()
  position.value = { left: bounds.left, top: bounds.top }
  hasCustomPosition.value = true
  dragOffset = { x: e.clientX - bounds.left, y: e.clientY - bounds.top }
  draggingPointer = e.pointerId
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function dragPanel(e: PointerEvent) {
  if (draggingPointer !== e.pointerId) return
  position.value = clampPosition(e.clientX - dragOffset.x, e.clientY - dragOffset.y)
}

function stopDragging(e: PointerEvent) {
  if (draggingPointer !== e.pointerId) return
  draggingPointer = null
  savePanelGeometry()
  const header = e.currentTarget as HTMLElement
  if (header.hasPointerCapture(e.pointerId)) header.releasePointerCapture(e.pointerId)
}

function keepPanelInView() {
  if (hasCustomSize.value) {
    size.value = {
      width: Math.min(size.value.width, window.innerWidth - 16),
      height: Math.min(size.value.height, window.innerHeight - 16),
    }
  }
  if (hasCustomPosition.value) position.value = clampPosition(position.value.left, position.value.top)
  savePanelGeometry()
}

function savePanelGeometry() {
  if (import.meta.env.SSR || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PANEL_GEOMETRY_KEY, JSON.stringify({
      hasCustomPosition: hasCustomPosition.value,
      left: position.value.left,
      top: position.value.top,
      hasCustomSize: hasCustomSize.value,
      width: size.value.width,
      height: size.value.height,
    } satisfies PanelGeometry))
  } catch {
    // 浏览器禁用本地存储时，窗口仍可正常拖动和缩放。
  }
}

function startResizing(e: PointerEvent, direction: 'nw' | 'se') {
  if (e.button !== 0) return
  const element = panel.value
  if (!element) return
  const bounds = element.getBoundingClientRect()
  hasCustomPosition.value = true
  position.value = { left: bounds.left, top: bounds.top }
  hasCustomSize.value = true
  size.value = { width: bounds.width, height: bounds.height }
  resizeDirection = direction
  resizeStart = {
    x: e.clientX,
    y: e.clientY,
    width: bounds.width,
    height: bounds.height,
    left: bounds.left,
    top: bounds.top,
  }
  resizingPointer = e.pointerId
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function resizePanel(e: PointerEvent) {
  if (resizingPointer !== e.pointerId) return
  const maxWidth = Math.max(1, window.innerWidth - 16)
  const maxHeight = Math.max(1, window.innerHeight - 16)
  const minWidth = Math.min(320, maxWidth)
  const minHeight = Math.min(360, maxHeight)
  const direction = resizeDirection === 'se' ? 1 : -1
  const width = Math.max(minWidth, Math.min(resizeStart.width + direction * (e.clientX - resizeStart.x), maxWidth))
  const height = Math.max(minHeight, Math.min(resizeStart.height + direction * (e.clientY - resizeStart.y), maxHeight))
  size.value = { width, height }
  position.value = {
    left: Math.max(8, Math.min(
      resizeDirection === 'nw' ? resizeStart.left + resizeStart.width - width : resizeStart.left,
      window.innerWidth - width - 8,
    )),
    top: Math.max(8, Math.min(
      resizeDirection === 'nw' ? resizeStart.top + resizeStart.height - height : resizeStart.top,
      window.innerHeight - height - 8,
    )),
  }
}

function stopResizing(e: PointerEvent) {
  if (resizingPointer !== e.pointerId) return
  resizingPointer = null
  savePanelGeometry()
  const handle = e.currentTarget as HTMLElement
  if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId)
}

async function selectConversation(name: string) {
  const peer = name.trim()
  if (!peer || !apiKey.value) return
  if (isChatroomSelected.value) {
    chat.floatingChatroomOpen = false
    if (route.path !== '/cr') chat.disconnect()
  }
  selectedPeer.value = peer
  draft.value = ''
  const opening = whispers.open(peer)
  if (route.path === '/chat' || route.path.startsWith('/chat/')) {
    const routePeer = String(route.params.userName || '')
    if (routePeer !== peer) await router.replace(`/chat/${encodeURIComponent(peer)}`)
  }
  await opening
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

async function selectChatroom() {
  if (!apiKey.value) return
  selectedPeer.value = CHATROOM_PEER
  draft.value = ''
  chat.floatingChatroomOpen = true
  if (!roomConnected.value && !roomConnecting.value && !roomLoading.value) await chat.connect()
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

async function refreshInbox() {
  await whispers.loadList()
  const roomWasSelected = isChatroomSelected.value
  const preferred = inboxPeer.value || (roomWasSelected ? '' : selectedPeer.value || (list.value[0] ? peerOf(list.value[0]) : ''))
  inboxPeer.value = ''
  if (preferred) await selectConversation(preferred)
  else if (roomWasSelected) await selectChatroom()
  else {
    selectedPeer.value = ''
    whispers.disconnect()
    if (route.path !== '/cr' && !chat.floatingChatroomOpen) chat.disconnect()
  }
}

function startConversation() {
  const name = toUser.value.trim()
  if (!name) return
  toUser.value = ''
  void selectConversation(name)
}

let stickToBottom = true
function toBottom() {
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}
function onScroll() {
  const el = scroller.value
  if (el) stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
}
watch([messages, roomMessages], async () => {
  await nextTick()
  if (stickToBottom) toBottom()
}, { deep: true })

async function loadOlder() {
  const el = scroller.value
  const fromBottom = el ? el.scrollHeight - el.scrollTop : 0
  stickToBottom = false
  if (isChatroomSelected.value) await chat.loadMore()
  else await whispers.loadMore()
  await nextTick()
  if (el) el.scrollTop = el.scrollHeight - fromBottom
}

async function submit() {
  const text = draft.value
  if (!text.trim() || sending.value) return
  draft.value = ''
  if (isChatroomSelected.value) await chat.send(text)
  else await whispers.send(text)
}

async function observePanelWidth() {
  await nextTick()
  panelResizeObserver?.disconnect()
  const element = panel.value
  if (!element) return
  const update = (width: number) => { isCompactPanel.value = width <= 520 }
  update(element.clientWidth)
  panelResizeObserver = new ResizeObserver(([entry]) => update(entry.contentRect.width))
  panelResizeObserver.observe(element)
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      chat.floatingChatroomOpen = isChatroomSelected.value
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('resize', keepPanelInView)
      void nextTick(keepPanelInView)
      void observePanelWidth()
      void refreshInbox()
    } else {
      savePanelGeometry()
      const wasChatroomSelected = isChatroomSelected.value
      chat.floatingChatroomOpen = false
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', keepPanelInView)
      panelResizeObserver?.disconnect()
      panelResizeObserver = null
      isCompactPanel.value = false
      draggingPointer = null
      const routePeer = route.path.startsWith('/chat/') ? String(route.params.userName || '') : ''
      if (routePeer && !whispers.isOpenWith(routePeer)) void whispers.open(routePeer)
      else if (!routePeer) whispers.disconnect()
      if (wasChatroomSelected && route.path !== '/cr') chat.disconnect()
    }
  },
)

watch(unreadTotal, (next, previous) => {
  if (props.modelValue && !listLoading.value && next !== previous) void whispers.loadList(false)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', keepPanelInView)
  panelResizeObserver?.disconnect()
})
</script>

<template>
  <Teleport v-if="modelValue" to="body">
      <aside
      ref="panel"
      class="whisper-panel"
      :class="{ positioned: hasCustomPosition }"
      :style="{
        ...(hasCustomPosition ? { left: `${position.left}px`, top: `${position.top}px` } : {}),
        ...(hasCustomSize ? { width: `${size.width}px`, height: `${size.height}px` } : {}),
      }"
      role="dialog"
      aria-label="聊天"
    >
      <header
        class="head"
        @pointerdown="startDragging"
        @pointermove="dragPanel"
        @pointerup="stopDragging"
        @pointercancel="stopDragging"
      >
        <div class="head-title">
          <strong>聊天</strong>
          <RouterLink
            class="full-whisper-link"
            :to="isChatroomSelected ? '/cr' : selectedPeer ? `/chat/${encodeURIComponent(selectedPeer)}` : '/chat'"
            :aria-label="isChatroomSelected ? '打开完整聊天室' : '打开完整私信'"
            :title="isChatroomSelected ? '打开完整聊天室' : '打开完整私信'"
            @click="close"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 4h6v6M20 4l-9 9" />
              <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
            </svg>
          </RouterLink>
          <div v-if="isCompactPanel && selectedPeer" class="compact-current" role="status" aria-live="polite">
            <span class="compact-peer" :title="isChatroomSelected ? CHATROOM_LABEL : selectedPeer">{{ isChatroomSelected ? CHATROOM_LABEL : selectedPeer }}</span>
            <span
              class="compact-status"
              :class="isChatroomSelected ? { connected: roomConnected, connecting: roomConnecting } : { connected, connecting }"
            >{{ isChatroomSelected ? roomConnectionLabel : connectionLabel }}</span>
          </div>
        </div>
        <button type="button" aria-label="关闭聊天" @click="close">✕</button>
      </header>

        <div class="conversation-layout">
          <nav class="conversation-list" aria-label="聊天列表">
            <form class="start" @submit.prevent="startConversation">
              <input v-model="toUser" placeholder="输入用户名发起聊天" aria-label="聊天用户名" />
              <button type="submit" :disabled="!toUser.trim()">发起</button>
            </form>
            <button
              type="button"
              class="conversation chatroom-pinned"
              :class="{ selected: isChatroomSelected }"
              title="聊天室"
              @click="selectChatroom"
            >
              <span class="conversation-avatar room-avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 3v-3H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                  <path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01" />
                </svg>
              </span>
              <span class="conversation-copy">
                <b>聊天室</b>
                <small>实时聊天室</small>
              </span>
            </button>
            <FpLoading v-if="listLoading && !list.length" />
            <p v-else-if="!list.length" class="empty-list">暂无用户会话</p>
            <button
              v-for="item in list"
              :key="peerOf(item)"
              type="button"
              class="conversation"
              :class="{ selected: selectedPeer === peerOf(item) }"
              :title="unreadBy[peerOf(item)] ? `${peerOf(item)} 有未读消息` : peerOf(item)"
              @click="selectConversation(peerOf(item))"
            >
              <span class="conversation-avatar">
                <img :src="peerAvatar(item)" alt="" />
                <span v-if="unreadBy[peerOf(item)]" class="conversation-unread-dot" aria-hidden="true" />
              </span>
              <span class="conversation-copy">
                <b>{{ peerOf(item) }}</b>
                <small>{{ item.preview || item.markdown || item.content || '…' }}</small>
              </span>
            </button>
          </nav>

          <section class="conversation-content">
            <template v-if="selectedPeer">
              <header v-if="!isCompactPanel" class="conversation-head">
                <div>
                  <strong>{{ isChatroomSelected ? CHATROOM_LABEL : selectedPeer }}</strong>
                  <small
                    class="connection-label"
                    :class="isChatroomSelected ? { connected: roomConnected, connecting: roomConnecting } : { connected, connecting }"
                  >{{ isChatroomSelected ? roomConnectionLabel : connectionLabel }}</small>
                </div>
              </header>
              <p v-if="isChatroomSelected && roomError" class="error">{{ roomError }}</p>
              <p v-else-if="!isChatroomSelected && usingMock" class="hint">当前会话不可用，消息仅保存在本地预览。</p>
              <p v-if="!isChatroomSelected && error" class="error">{{ error }}</p>
              <div ref="scroller" class="messages" @scroll.passive="onScroll">
                <button
                  v-if="isChatroomSelected ? roomHasMore && roomMessages.length : hasMore && messages.length"
                  type="button"
                  class="more"
                  :disabled="isChatroomSelected ? roomLoadingMore : loadingMore"
                  @click="loadOlder"
                >
                  {{ (isChatroomSelected ? roomLoadingMore : loadingMore) ? '加载中…' : '加载更早消息' }}
                </button>
                <FpLoading v-if="isChatroomSelected ? roomLoading && !roomMessages.length : loading && !messages.length" />
                <p v-else-if="isChatroomSelected ? !visibleRoomMessages.length : !messages.length" class="empty-content">
                  {{ isChatroomSelected ? '聊天室暂时没有消息' : '还没有消息，打个招呼吧。' }}
                </p>
                <template v-if="isChatroomSelected">
                  <ChatBubble
                    v-for="line in visibleRoomMessages"
                    :key="line.oId"
                    :user-name="line.userName"
                    :avatar="line.userAvatarURL"
                    :time="line.time"
                    :html="line.html || (line.redPacket ? '[红包]' : line.card ? '[聊天室消息]' : '')"
                    :self="line.userName === account?.userName"
                  />
                </template>
                <ChatBubble
                  v-else
                  v-for="msg in messages"
                  :key="msg.oId"
                  :user-name="msg.senderUserName || ''"
                  :avatar="msg.senderAvatar"
                  :time="msg.time"
                  :html="msg.content || msg.markdown || msg.preview || ''"
                  :self="msg.senderUserName === account?.userName"
                >
                  <template v-if="msg.senderUserName === account?.userName" #actions>
                    <button type="button" @click="whispers.revoke(msg.oId)">撤回</button>
                  </template>
                </ChatBubble>
              </div>
              <Transition name="composer-swap" mode="out-in">
                <form v-if="isCompactPanel" key="compact" class="compact-composer composer" @submit.prevent="submit">
                  <input
                    v-model="draft"
                    type="text"
                    :aria-label="isChatroomSelected ? '聊天室消息' : '私信消息'"
                    placeholder="说点什么吧…"
                    :disabled="isChatroomSelected ? !roomConnected : !connected && !usingMock"
                  />
                  <button type="submit" :disabled="!canSend">{{ (isChatroomSelected ? roomSending : sending) ? '发送中' : '发送' }}</button>
                </form>
                <ChatComposer
                  v-else
                  :key="selectedPeer"
                  v-model="draft"
                  class="composer"
                  :api-key="apiKey"
                  :height="100"
                  compact
                  :cache-id="isChatroomSelected ? 'chatroom-drawer' : `whisper-drawer-${selectedPeer}`"
                  :sending="isChatroomSelected ? roomSending : sending"
                  :disabled="isChatroomSelected ? !roomConnected : !connected && !usingMock"
                  placeholder="说点什么吧，友善第一哦。"
                  @submit="submit"
                />
              </Transition>
            </template>
            <p v-else class="empty-content">选择聊天室或私信会话</p>
          </section>
        </div>
      <button
        type="button"
        class="resize-handle resize-handle--nw"
        aria-label="从左上角调整聊天窗口大小"
        title="拖动调整窗口大小"
        @pointerdown="startResizing($event, 'nw')"
        @pointermove="resizePanel"
        @pointerup="stopResizing"
        @pointercancel="stopResizing"
      ><span /></button>
      <button
        type="button"
        class="resize-handle resize-handle--se"
        aria-label="从右下角调整聊天窗口大小"
        title="拖动调整窗口大小"
        @pointerdown="startResizing($event, 'se')"
        @pointermove="resizePanel"
        @pointerup="stopResizing"
        @pointercancel="stopResizing"
      ><span /></button>
    </aside>
  </Teleport>
</template>

<style scoped>
.whisper-panel {
  container-type: inline-size;
  container-name: whisper-panel;
  box-sizing: border-box;
  position: fixed;
  right: 18px;
  bottom: 18px;
  display: flex;
  flex-direction: column;
  width: min(700px, calc(100vw - 36px));
  height: min(620px, calc(100vh - 36px));
  overflow: hidden;
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  background: var(--fp-card);
  color: var(--fp-text);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
}
.resize-handle {
  position: absolute;
  z-index: 2;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px 0 10px 0;
  background: var(--fp-card);
  color: var(--fp-muted);
  cursor: nwse-resize;
  opacity: 0;
  transition: opacity 140ms ease, color 140ms ease;
  touch-action: none;
}
.resize-handle--nw {
  top: 0;
  left: 0;
  border-radius: 10px 0 8px 0;
}
.resize-handle--se {
  right: 0;
  bottom: 0;
  border-radius: 8px 0 10px 0;
}
.resize-handle:hover,
.resize-handle:focus-visible { opacity: 1; }
.resize-handle span {
  width: 9px;
  height: 9px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  opacity: 0.75;
}
.resize-handle--nw span {
  border: 0;
  border-top: 2px solid currentColor;
  border-left: 2px solid currentColor;
}
.resize-handle:hover { color: var(--fp-primary); }
.whisper-panel.positioned {
  right: auto;
  bottom: auto;
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
.head .head-title {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.compact-current {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  animation: compact-current-in 160ms ease both;
}
.compact-peer {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--fp-title);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.compact-status {
  flex: none;
  color: var(--fp-muted);
  font-size: 11px;
  white-space: nowrap;
}
.compact-status.connected,
.conversation-head small.connected {
  color: var(--fp-primary);
}
.compact-status.connecting,
.conversation-head small.connecting {
  color: var(--fp-warning, #d99a28);
}
@keyframes compact-current-in {
  from { opacity: 0; transform: translateY(-3px); }
  to { opacity: 1; transform: translateY(0); }
}
.conversation-head > div {
  flex-direction: row;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  flex-wrap: nowrap;
}
.conversation-head > div strong {
  flex: none;
}
.conversation-head > div small {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.full-whisper-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 25px;
  height: 25px;
  border-radius: 6px;
  color: var(--fp-muted);
}
.full-whisper-link:hover {
  background: var(--fp-hover);
  color: var(--fp-primary);
}
.full-whisper-link svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.head strong,
.conversation-head strong {
  color: var(--fp-title);
  font-size: 14px;
}
.head span,
.conversation-head small {
  color: var(--fp-muted);
  font-size: 11px;
}
.head button {
  border: 0;
  background: transparent;
  color: var(--fp-muted);
  cursor: pointer;
}
.head {
  cursor: move;
  user-select: none;
  touch-action: none;
}
.conversation-layout {
  display: grid;
  flex: 1;
  grid-template-columns: 190px minmax(0, 1fr);
  min-height: 0;
  transition: grid-template-columns 180ms ease;
}
.conversation-list {
  overflow: auto;
  padding: 7px;
  border-right: 1px solid var(--fp-border);
  transition: padding 180ms ease;
}
.start {
  position: sticky;
  top: -7px;
  z-index: 1;
  display: flex;
  gap: 5px;
  margin: -7px -7px 6px;
  padding: 8px 7px;
  max-height: 48px;
  overflow: hidden;
  border-bottom: 1px solid var(--fp-border);
  background: var(--fp-card);
  opacity: 1;
  visibility: visible;
  transition: max-height 180ms ease, opacity 140ms ease, padding 180ms ease, margin 180ms ease;
}
.start input {
  width: 0;
  min-width: 0;
  flex: 1;
  padding: 6px 7px;
  border: 1px solid var(--fp-border);
  border-radius: 6px;
  outline: none;
  background: var(--fp-bg);
  color: var(--fp-text);
  font-size: 11px;
}
.start button {
  flex: none;
  padding: 5px 7px;
  border: 0;
  border-radius: 6px;
  background: var(--fp-primary);
  color: #fff;
  font-size: 11px;
  cursor: pointer;
}
.start button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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
  transition: gap 180ms ease, padding 180ms ease, background-color 140ms ease;
}
.conversation:hover,
.conversation.selected {
  background: var(--fp-hover);
}
.chatroom-pinned {
  margin-bottom: 5px;
  border-bottom: 1px solid var(--fp-border);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}
.conversation-avatar {
  position: relative;
  width: 30px;
  height: 30px;
  flex: none;
  transition: width 180ms ease, height 180ms ease;
}
.conversation-avatar img {
  display: block;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
  transition: width 180ms ease, height 180ms ease;
}
.room-avatar {
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--fp-primary);
  color: #fff;
}
.room-avatar svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.conversation-unread-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 9px;
  height: 9px;
  border: 1.5px solid var(--fp-card);
  border-radius: 50%;
  background: var(--fp-accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--fp-accent) 28%, transparent);
}
.conversation-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  opacity: 1;
  transition: max-width 180ms ease, opacity 140ms ease;
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
.conversation-copy small {
  color: var(--fp-muted);
  font-size: 10px;
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
.messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
  padding: 12px;
  transition: gap 180ms ease, padding 180ms ease;
}
.messages :deep(.fp-msg) {
  max-width: 100%;
  transition: gap 180ms ease;
}
.messages :deep(.fp-bubble .body) { font-size: 13px; }
.messages :deep(.fp-bubble .body blockquote) { font-size: 11px; }
.empty-list,
.empty-content,
.error {
  margin: auto;
  padding: 16px;
  color: var(--fp-muted);
  text-align: center;
}
.error {
  margin: 0;
  color: var(--fp-danger, #d9534f);
}
.hint {
  margin: 0;
  padding: 5px 12px;
  color: var(--fp-muted);
  font-size: 11px;
}
.more {
  align-self: center;
  padding: 3px 8px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: transparent;
  color: var(--fp-muted);
  font-size: 11px;
  cursor: pointer;
}
.more:disabled {
  opacity: 0.55;
  cursor: wait;
}
.composer {
  flex: none;
  padding: 9px 12px;
  border-top: 1px solid var(--fp-border);
}
.compact-composer {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  min-height: 52px;
  padding: 7px 9px;
  background: var(--fp-card);
}
.compact-composer input {
  flex: 1;
  width: 0;
  min-width: 0;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  outline: none;
  background: var(--fp-bg);
  color: var(--fp-text);
  font-size: 13px;
}
.compact-composer input:focus { border-color: var(--fp-primary); }
.compact-composer button {
  flex: none;
  min-width: 54px;
  height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: var(--fp-primary);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}
.compact-composer button:disabled { opacity: 0.5; cursor: not-allowed; }
.composer-swap-enter-active,
.composer-swap-leave-active { transition: opacity 140ms ease, transform 140ms ease; }
.composer-swap-enter-from,
.composer-swap-leave-to { opacity: 0; transform: translateY(5px); }
@container whisper-panel (max-width: 680px) {
  .whisper-panel .start {
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    margin: 0;
    border-bottom-width: 0;
    opacity: 0;
    visibility: hidden;
  }
}
@container whisper-panel (max-width: 520px) {
  .whisper-panel .conversation-layout { grid-template-columns: 56px minmax(0, 1fr); }
  .whisper-panel .conversation-list { padding: 6px 4px; }
  .whisper-panel .conversation { justify-content: center; gap: 0; padding: 7px 4px; }
  .whisper-panel .conversation-copy { max-width: 0; opacity: 0; }
  .whisper-panel .conversation-avatar { width: 28px; height: 28px; }
  .whisper-panel .conversation-avatar img { width: 28px; height: 28px; }
  .whisper-panel .messages { gap: 7px; padding: 8px; }
  .whisper-panel .messages :deep(.fp-msg) { gap: 5px; }
  .whisper-panel .messages :deep(.fp-avatar-frame),
  .whisper-panel .messages :deep(.fp-avatar) { width: 24px; height: 24px; }
  .whisper-panel .messages :deep(.fp-bubble) { padding: 4px 8px 3px; border-radius: 8px; transition: padding 180ms ease; }
  .whisper-panel .messages :deep(.fp-bubble .body) { font-size: 12px; }
  .whisper-panel .messages :deep(.fp-bubble .body blockquote) { font-size: 10px; }
  .whisper-panel .messages :deep(.fp-bubble .head .name) { font-size: 10px; line-height: 14px; }
  .whisper-panel .messages :deep(.fp-bubble .foot) { min-height: 14px; font-size: 9px; line-height: 14px; }
}
@media (max-width: 560px) {
  .whisper-panel {
    right: 10px;
    bottom: 10px;
    width: calc(100vw - 20px);
    height: min(620px, calc(100vh - 20px));
  }
}
</style>
