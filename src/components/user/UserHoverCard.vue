<script setup lang="ts">
import { coverStyle, avatarThumbnail, fallbackAvatar } from '@/utils/avatar'
import VipNickname from '@/components/user/VipNickname.vue'
import UserFollowButton from '@/components/user/UserFollowButton.vue'
import { getAuthContextVersion } from '@/api/http'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchPublicUser, type PublicUser } from '@/api/v3-public-user'
import { useAuthStore } from '@/stores/auth'

const CARD_WIDTH = 400
const GAP = 10
const VIEWPORT_PADDING = 12
const SHOW_DELAY = 260
const HIDE_DELAY = 160
const AVATAR_SELECTOR = [
  '[data-user-card]',
  '.avatar-small',
  '.avatar-mid',
  '.avatar-middle',
  '.avatar-tile',
  '.user-avatar',
  '.fp-avatar',
  '.avatar-tiny',
  '.summary-avatar',
  '.avatar-mini',
  '.people-avatar',
  '.user-card-avatar',
  '.avatar-img',
  '.person-avatar',
  'a.avatar',
  'img.avatar',
  'span.avatar',
].join(',')

const auth = useAuthStore()
const route = useRoute()
const { accessToken, account, isLoggedIn } = storeToRefs(auth)
const mounted = ref(false)
const cardEl = ref<HTMLElement | null>(null)
const active = ref(false)
const loading = ref(false)
const failed = ref(false)
const currentUserName = ref('')
const profile = ref<PublicUser | null>(null)
const anchor = ref<HTMLElement | null>(null)
const position = ref({ left: VIEWPORT_PADDING, top: VIEWPORT_PADDING, side: 'right' as 'left' | 'right' })

let showTimer: ReturnType<typeof setTimeout> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined
let requestId = 0
let lastPointerType = ''

const isSelf = computed(() => account.value?.oId === profile.value?.id)
const memberDescription = computed(() => profile.value?.userIntro || '')

function usernameFrom(target: EventTarget | null): { userName: string; element: HTMLElement } | null {
  if (/^\/chat(?:\/|$)/.test(route.path)) return null
  if (!(target instanceof Element)) return null
  if (cardEl.value?.contains(target)) return null
  const element = target.closest<HTMLElement>(AVATAR_SELECTOR)
    || target.closest('a, button')?.querySelector<HTMLElement>(AVATAR_SELECTOR)
  if (!element || cardEl.value?.contains(element)) return null

  const explicit = element.closest<HTMLElement>('[data-user-card]')?.dataset.userCard?.trim()
  if (explicit) return { userName: explicit, element }

  const link = element.closest<HTMLAnchorElement>('a[href*="/member/"]')
  if (!link) return null
  try {
    const match = new URL(link.href, location.href).pathname.match(/^\/member\/([^/]+)/)
    const userName = match?.[1] ? decodeURIComponent(match[1]) : ''
    return userName ? { userName, element } : null
  } catch {
    return null
  }
}

function cancelShow() {
  clearTimeout(showTimer)
  showTimer = undefined
}

function cancelHide() {
  clearTimeout(hideTimer)
  hideTimer = undefined
}

function scheduleHide() {
  cancelShow()
  cancelHide()
  hideTimer = setTimeout(hide, HIDE_DELAY)
}

function hide() {
  cancelShow()
  cancelHide()
  ++requestId
  active.value = false
  anchor.value = null
  profile.value = null
  loading.value = false
  failed.value = false
  currentUserName.value = ''
}

function containsInteraction(target: EventTarget | null) {
  if (!(target instanceof Node)) return false
  return Boolean(cardEl.value?.contains(target)
    || anchor.value?.contains(target)
    || (target instanceof Element && usernameFrom(target)?.element === anchor.value))
}

function canHover(e: PointerEvent) {
  return e.pointerType !== 'touch' && window.matchMedia('(any-hover: hover)').matches
}

function positionCard() {
  const el = anchor.value
  if (!el || !active.value) return
  const r = el.getBoundingClientRect()
  const width = Math.min(CARD_WIDTH, innerWidth - VIEWPORT_PADDING * 2)
  const height = cardEl.value?.offsetHeight || 250
  const roomRight = innerWidth - r.right - GAP
  const roomLeft = r.left - GAP
  const side = roomRight >= width || roomRight >= roomLeft ? 'right' : 'left'
  const preferredLeft = side === 'right' ? r.right + GAP : r.left - width - GAP
  const left = Math.min(Math.max(preferredLeft, VIEWPORT_PADDING), innerWidth - width - VIEWPORT_PADDING)
  const top = Math.min(
    Math.max(r.top - 24, VIEWPORT_PADDING),
    Math.max(VIEWPORT_PADDING, innerHeight - height - VIEWPORT_PADDING),
  )
  position.value = { left, top, side }
}

async function show(userName: string, element: HTMLElement) {
  cancelShow()
  cancelHide()
  if (active.value && anchor.value === element && currentUserName.value === userName) return
  const id = ++requestId
  anchor.value = element
  currentUserName.value = userName
  failed.value = false
  active.value = true
  positionCard()

  await loadProfile(id)
}

async function loadProfile(id = ++requestId) {
  const name = currentUserName.value, element = anchor.value, token = accessToken.value, boundary = getAuthContextVersion(), owner = account.value?.oId
  const valid = () => mounted.value && id === requestId && active.value && name === currentUserName.value && element === anchor.value && token === accessToken.value && boundary === getAuthContextVersion() && owner === account.value?.oId
  profile.value = null; failed.value = false; loading.value = true
  try { const data = await fetchPublicUser(name); if (valid()) profile.value = data }
  catch { if (valid()) failed.value = true }
  finally { if (valid()) { loading.value = false; await nextTick(); if (valid()) positionCard() } }
}

function retry() { if (active.value && !loading.value) void loadProfile() }

function onPointerOver(e: PointerEvent) {
  if (!canHover(e)) return
  const hit = usernameFrom(e.target)
  if (!hit) return
  if (e.relatedTarget instanceof Node && hit.element.contains(e.relatedTarget)) return
  cancelShow()
  cancelHide()
  showTimer = setTimeout(() => void show(hit.userName, hit.element), SHOW_DELAY)
}

function onPointerOut(e: PointerEvent) {
  if (!canHover(e)) return
  const hit = usernameFrom(e.target)
  if (!hit) return
  if (e.relatedTarget instanceof Node && (hit.element.contains(e.relatedTarget) || cardEl.value?.contains(e.relatedTarget))) {
    return
  }
  if (!containsInteraction(document.activeElement)) scheduleHide()
}

function onFocusIn(e: FocusEvent) {
  if (containsInteraction(e.target)) {
    cancelHide()
    return
  }
  if (lastPointerType === 'touch' || window.matchMedia('(hover: none)').matches) return
  const hit = usernameFrom(e.target)
  if (hit) void show(hit.userName, hit.element)
}

function onFocusOut(e: FocusEvent) {
  if (!containsInteraction(e.target)) return
  if (containsInteraction(e.relatedTarget)) return
  scheduleHide()
}

function onCardPointerLeave(e: PointerEvent) {
  if (canHover(e) && !containsInteraction(e.relatedTarget) && !containsInteraction(document.activeElement)) scheduleHide()
}

function onPointerDown(e: PointerEvent) {
  lastPointerType = e.pointerType
  if (e.pointerType === 'touch') hide()
}

function onKeyDown(e: KeyboardEvent) {
  lastPointerType = ''
  if (e.key === 'Escape') hide()
}

watch(() => route.fullPath, hide, { flush: 'sync' })
let readerBoundary = `${getAuthContextVersion()}:${account.value?.oId || ''}:${!!accessToken.value}`
watch([accessToken, () => account.value?.oId, () => account.value?.userName], () => {
  const next = `${getAuthContextVersion()}:${account.value?.oId || ''}:${!!accessToken.value}`
  if (next !== readerBoundary) { readerBoundary = next; hide() }
  else if (active.value) void loadProfile()
}, { flush: 'sync' })

function onViewportChange() {
  if (active.value) positionCard()
}

onMounted(() => {
  mounted.value = true
  document.addEventListener('pointerover', onPointerOver)
  document.addEventListener('pointerout', onPointerOut)
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

onUnmounted(() => {
  hide()
  document.removeEventListener('pointerover', onPointerOver)
  document.removeEventListener('pointerout', onPointerOut)
  document.removeEventListener('focusin', onFocusIn)
  document.removeEventListener('focusout', onFocusOut)
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <Transition name="user-card">
      <aside
        v-if="active"
        ref="cardEl"
        class="global-user-card"
        :class="`global-user-card--${position.side}`"
        :style="{ left: `${position.left}px`, top: `${position.top}px` }"
        role="dialog"
        aria-label="用户资料"
        @pointerenter="cancelHide"
        @pointerleave="onCardPointerLeave"
        @focusin="cancelHide"
        @focusout="onFocusOut"
      >
        <div v-if="loading" class="card-loading" aria-label="正在加载用户资料">
          <span class="skeleton avatar-skeleton" />
          <div>
            <span class="skeleton line wide" />
            <span class="skeleton line" />
            <span class="skeleton line short" />
          </div>
        </div>

        <div v-else-if="failed" class="card-error" role="status">
          <p>用户资料加载失败。</p><button type="button" @click="retry()">重试用户资料</button>
          <RouterLink :to="`/member/${encodeURIComponent(currentUserName)}`">查看用户主页</RouterLink>
        </div>

        <template v-else-if="profile">
          <div v-if="profile.cardBg" class="card-cover" :style="coverStyle(profile.cardBg, 400)" aria-hidden="true" />
          <div class="card-main">
            <RouterLink class="avatar-link" :to="`/member/${encodeURIComponent(profile.userName)}`">
              <img v-if="profile.userAvatarURL" class="card-avatar" :src="avatarThumbnail(profile.userAvatarURL, 72)" @error="fallbackAvatar" :alt="profile.userName" referrerpolicy="no-referrer" />
            </RouterLink>

            <div class="card-meta">
              <div class="name-line">
                <RouterLink class="nickname" :to="`/member/${encodeURIComponent(profile.userName)}`">
                  <VipNickname :user-id="profile.id" :user-name="profile.userName">{{ profile.userNickname || profile.userName }}</VipNickname>
                </RouterLink>
              </div>
              <RouterLink class="username" :to="`/member/${encodeURIComponent(profile.userName)}`">@{{ profile.userName }}</RouterLink>
              <p class="intro">{{ memberDescription }}</p>
            </div>
          </div>

          <div class="card-footer">
            <div class="facts">
              <a v-if="profile.userURL" class="fact fact-link external" aria-label="访问个人网址" :href="profile.userURL" target="_blank" rel="noopener noreferrer">
                ↗
              </a>
            </div>
            <div class="actions">
              <UserFollowButton v-if="isLoggedIn && !isSelf" :user-name="profile.userName" :user-id="profile.id" />
              <RouterLink v-if="isLoggedIn && !isSelf" class="message" :to="`/chat?toUser=${encodeURIComponent(profile.userName)}`">
                私信
              </RouterLink>
            </div>
          </div>
        </template>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.global-user-card {
  position: fixed;
  z-index: 1450;
  width: min(400px, calc(100vw - 24px));
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-card);
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.28);
  color: var(--fp-text);
}
.card-cover {
  height: 96px;
  background-size: cover;
  background-position: center;
}
.card-main {
  display: flex;
  gap: 12px;
  min-width: 0;
  padding: 16px 16px 10px;
}
.avatar-link {
  align-self: flex-start;
  flex: 0 0 auto;
  border-radius: var(--fp-avatar-radius);
}
.card-avatar {
  display: block;
  width: 72px;
  height: 72px;
  box-sizing: border-box;
  border: 3px solid var(--fp-card);
  border-radius: var(--fp-avatar-radius);
  background: var(--fp-hover);
  object-fit: cover;
}
.card-meta {
  min-width: 0;
  flex: 1;
  padding-top: 2px;
}
.name-line {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.nickname {
  overflow: hidden;
  color: var(--fp-title);
  font-size: 16px;
  font-weight: 700;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.username {
  display: inline-block;
  max-width: 100%;
  margin-top: 2px;
  overflow: hidden;
  color: var(--fp-muted);
  font-size: 12px;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.intro {
  display: -webkit-box;
  margin: 8px 0 0;
  overflow: hidden;
  color: var(--fp-text);
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.card-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 9px 12px;
  border-top: 1px solid var(--fp-border);
  background: color-mix(in srgb, var(--fp-hover) 55%, transparent);
}
.facts {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}
.fact {
  flex: 0 0 auto;
  max-width: 104px;
  overflow: hidden;
  padding: 2px 6px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--fp-border) 50%, transparent);
  color: var(--fp-muted);
  font-size: 11px;
  line-height: 18px;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fact-link:hover {
  text-decoration: underline;
}
.external {
  font-size: 14px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}
.message {
  box-sizing: border-box;
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 24px;
}
.message {
  background: var(--fp-primary);
  color: #fff;
  text-decoration: none;
}
.card-loading {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 12px;
  padding: 16px;
}
.card-error {
  padding: 16px;
  font-size: 13px;
}
.card-error p {
  margin: 0 0 10px;
}
.card-error button { font: inherit; color: var(--fp-text); background: var(--fp-card); border: 1px solid var(--fp-border); border-radius: 6px; padding: 6px 9px; margin-right: 8px; cursor: pointer; }
.card-error a {
  color: var(--fp-link);
}
.skeleton {
  display: block;
  border-radius: 5px;
  background: linear-gradient(90deg, var(--fp-hover), var(--fp-border), var(--fp-hover));
  background-size: 200% 100%;
  animation: user-card-loading 1.2s linear infinite;
}
.avatar-skeleton {
  width: 72px;
  height: 72px;
  border-radius: var(--fp-avatar-radius);
}
.line {
  width: 70%;
  height: 11px;
  margin: 8px 0;
}
.line.wide {
  width: 45%;
  height: 16px;
  margin-top: 3px;
}
.line.short {
  width: 90%;
}
.user-card-enter-active,
.user-card-leave-active {
  transition:
    opacity 0.15s,
    transform 0.15s;
}
.user-card-enter-from,
.user-card-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
@keyframes user-card-loading {
  to {
    background-position: -200% 0;
  }
}
@media (max-width: 560px), (hover: none) {
  .global-user-card {
    display: none;
  }
}
</style>
