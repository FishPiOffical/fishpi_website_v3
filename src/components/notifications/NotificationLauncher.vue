<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNoticeStore } from '@/stores/notices'
import { getAuthContextVersion } from '@/api/http'
import { markV3NotificationsRead, notificationReadKey } from '@/api/v3-notifications'
import NavIcon from '@/components/navigation/NavIcon.vue'
import NoticeIcon from './NoticeIcon.vue'

// 只有打开窗口才加载列表，不在导航栏额外读取通知。
const NotificationsView = defineAsyncComponent(() => import('@/views/NotificationsView.vue'))
const auth = useAuthStore(), notices = useNoticeStore()
const menu = ref(false), opened = ref(false), busy = ref(false), failure = ref('')
const trigger = ref<HTMLButtonElement>(), panel = ref<HTMLElement>(), host = ref<HTMLElement>()
const position = ref({ x: 16, y: 100 })
const identity = () => JSON.stringify([getAuthContextVersion(), !!auth.accessToken, auth.account?.oId || ''])
const label = computed(() => notices.error || `通知${notices.total ? `（${notices.total} 条未读）` : ''}`)
let pendingKey = '', disposed = false, closeTimer: ReturnType<typeof setTimeout> | undefined
let drag: { id: number; x: number; y: number; left: number; top: number } | null = null
let observer: ResizeObserver | undefined
function showMenu() { clearTimeout(closeTimer); menu.value = true }
function leaveMenu() { clearTimeout(closeTimer); closeTimer = setTimeout(() => { menu.value = false }, 180) }
function focusOut(event: FocusEvent) { if (!host.value?.contains(event.relatedTarget as Node)) leaveMenu() }
async function clearUnread() {
  if (busy.value || !auth.accessToken) return
  const owner = identity()
  busy.value = true; failure.value = ''
  if (!pendingKey) pendingKey = notificationReadKey()
  try {
    await markV3NotificationsRead('all', pendingKey)
    if (disposed || owner !== identity()) return
    pendingKey = ''; notices.invalidate(); menu.value = false
  } catch {
    // 未确认结果保留原键，重试不会创建第二次操作。
    if (!disposed && owner === identity()) failure.value = '未能清除未读提醒，请重试'
  } finally { if (!disposed && owner === identity()) busy.value = false }
}
function clamp() {
  const rect = panel.value?.getBoundingClientRect()
  if (!rect) return
  const nav = document.querySelector('[data-site-navigation]')?.getBoundingClientRect().bottom || 0
  const top = Math.min(Math.max(8, nav + 8), Math.max(8, innerHeight - rect.height - 8))
  position.value = { x: Math.max(8, Math.min(position.value.x, innerWidth - rect.width - 8)), y: Math.max(top, Math.min(position.value.y, innerHeight - rect.height - 8)) }
}
function resetPosition() { position.value = { x: Math.max(8, innerWidth - 640), y: 100 }; clamp() }
function outside(event: PointerEvent) { if (!host.value?.contains(event.target as Node)) menu.value = false }
onMounted(() => document.addEventListener('pointerdown', outside))
async function openWindow() {
  menu.value = false; clearTimeout(closeTimer)
  if (opened.value) { panel.value?.focus(); return }
  opened.value = true
  await nextTick()
  if (disposed || !opened.value) return
  position.value = { x: Math.max(8, innerWidth - 640), y: 100 }; clamp()
  observer = new ResizeObserver(clamp); if (panel.value) observer.observe(panel.value)
  window.addEventListener('resize', clamp)
  panel.value?.focus()
}
function closeWindow(restoreFocus = true) {
  opened.value = false; drag = null; observer?.disconnect(); observer = undefined
  window.removeEventListener('resize', clamp)
  if (restoreFocus) trigger.value?.focus()
}
function startDrag(event: PointerEvent) {
  if (event.button !== 0 || (event.target as HTMLElement).closest('button,a')) return
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: position.value.x, top: position.value.y }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  event.preventDefault()
}
function moveDrag(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return
  position.value = { x: drag.left + event.clientX - drag.x, y: drag.top + event.clientY - drag.y }; clamp()
}
watch(identity, () => { menu.value = false; closeWindow(false); pendingKey = ''; busy.value = false; failure.value = '' })
onBeforeUnmount(() => { disposed = true; document.removeEventListener('pointerdown', outside); clearTimeout(closeTimer); closeWindow(false) })
</script>

<template>
  <div ref="host" class="notification-launcher" @mouseenter="showMenu" @mouseleave="leaveMenu" @focusin="showMenu" @focusout="focusOut" @keydown.esc.stop="menu = false">
    <button ref="trigger" type="button" class="notice-trigger" :class="{ unread: notices.total > 0 }" :aria-label="label" :title="label" :aria-expanded="menu" aria-haspopup="true" @click="showMenu" @keydown.down.prevent="showMenu">
      <NavIcon name="notice" /><span v-if="notices.total > 0" class="badge">{{ notices.total > 99 ? '99+' : notices.total }}</span>
    </button>
    <div v-if="menu" class="notice-menu" aria-label="通知操作">
      <button type="button" :disabled="busy || (!pendingKey && !notices.total)" @click="clearUnread"><NoticeIcon name="check" />{{ busy ? '正在清除…' : '一键清除未读' }}</button>
      <button type="button" @click="openWindow"><NoticeIcon name="inbox" />悬浮查看</button>
      <RouterLink to="/notifications" @click="menu = false">打开通知页面 <span aria-hidden="true">↗</span></RouterLink>
      <p v-if="failure" role="alert">{{ failure }}</p>
    </div>
  </div>
  <Teleport to="body">
    <section v-if="opened" ref="panel" class="floating-notifications" role="dialog" aria-label="通知窗口" tabindex="-1" :style="{ left: `${position.x}px`, top: `${position.y}px` }" @keydown.esc.stop="closeWindow()">
      <header class="floating-heading" @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="drag = null" @pointercancel="drag = null" @lostpointercapture="drag = null" @dblclick="resetPosition">
        <strong>通知</strong>
        <RouterLink to="/notifications" title="打开完整通知页" aria-label="打开完整通知页" @click="closeWindow(false)">↗</RouterLink>
        <button type="button" title="关闭通知" aria-label="关闭通知" @click="closeWindow()">×</button>
      </header>
      <div class="floating-content"><NotificationsView embedded /></div>
    </section>
  </Teleport>
</template>

<style scoped>
.notification-launcher { position: relative; display: inline-flex; }
.notice-trigger { position: relative; display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 9px; color: var(--fp-text); background: transparent; cursor: pointer; }
.notice-trigger:hover { background: var(--fp-hover); }
.notice-trigger.unread { color: var(--fp-accent); }
.badge { position: absolute; right: -4px; top: -3px; min-width: 16px; padding: 1px 4px; border-radius: 8px; background: var(--fp-accent); color: white; font-size: 10px; }
.notice-menu { position: absolute; top: calc(100% + 6px); right: -12px; width: 190px; padding: 6px; border: 1px solid var(--fp-border); border-radius: 12px; background: var(--fp-card); box-shadow: 0 8px 28px #0002; z-index: 20; }
.notice-menu::before { content: ""; position: absolute; left: 0; right: 0; top: -8px; height: 8px; }
.notice-menu button, .notice-menu a { width: 100%; display: flex; align-items: center; gap: 9px; padding: 11px 10px; border: 0; border-radius: 7px; background: transparent; color: var(--fp-text); font: inherit; font-size: 13px; text-decoration: none; cursor: pointer; }
.notice-menu svg { width: 16px; height: 16px; }
.notice-menu button:hover, .notice-menu a:hover { background: var(--fp-hover); }
.notice-menu button:disabled { opacity: .5; cursor: default; }
.notice-menu p { font-size: 12px; padding: 4px 10px; color: var(--fp-danger); }
.floating-notifications { position: fixed; z-index: 1100; display: flex; flex-direction: column; width: min(620px, calc(100vw - 16px)); height: min(640px, calc(100dvh - 120px)); min-width: min(320px, calc(100vw - 16px)); min-height: min(260px, calc(100dvh - 16px)); max-width: calc(100vw - 16px); max-height: calc(100dvh - 16px); resize: both; overflow: hidden; border: 1px solid var(--fp-border); border-radius: 16px; background: var(--fp-card); box-shadow: 0 16px 60px #0003; color: var(--fp-text); }
.floating-heading { display: flex; align-items: center; gap: 12px; flex: none; padding: 10px 16px; border-bottom: 1px solid var(--fp-border); cursor: grab; touch-action: none; user-select: none; }
.floating-heading strong { font-size: 16px; }
.floating-heading a, .floating-heading button { display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 6px; background: transparent; color: var(--fp-muted); text-decoration: none; font-size: 23px; cursor: pointer; }
.floating-heading button { margin-left: auto; }
.floating-heading a:hover, .floating-heading button:hover { background: var(--fp-hover); }
.floating-content { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 12px; }
button:focus-visible, a:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 2px; }
</style>
