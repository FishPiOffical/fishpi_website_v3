<script setup lang="ts">
import VipNickname from '@/components/user/VipNickname.vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchUserProfile, type UserProfile } from '@/api/fishpi'
import MedalList from '@/components/medal/MedalList.vue'
import { useAuthStore } from '@/stores/auth'
import { avatarUrl } from '@/utils/avatar'

const CARD_WIDTH = 400
const GAP = 10
const VIEWPORT_PADDING = 12
const SHOW_DELAY = 260
const HIDE_DELAY = 160
const CACHE_LIMIT = 100
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
const { apiKey, account, isLoggedIn } = storeToRefs(auth)
const mounted = ref(false)
const cardEl = ref<HTMLElement | null>(null)
const active = ref(false)
const loading = ref(false)
const failed = ref(false)
const currentUserName = ref('')
const profile = ref<UserProfile | null>(null)
const anchor = ref<HTMLElement | null>(null)
const position = ref({ left: VIEWPORT_PADDING, top: VIEWPORT_PADDING, side: 'right' as 'left' | 'right' })
const cache = new Map<string, UserProfile>()

let showTimer: ReturnType<typeof setTimeout> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined
let requestId = 0
let lastPointerType = ''

const isSelf = computed(() => account.value?.userName === profile.value?.userName)
const memberDescription = computed(() => {
  const p = profile.value
  if (!p) return ''
  if (p.userIntro?.trim()) return p.userIntro.trim()
  const role = Number(p.userAppRole) === 1 ? '画家' : '黑客'
  return p.userNo ? `摸鱼派 ${p.userNo} 号成员，${role}` : `摸鱼派成员，${role}`
})
const roleBadge = computed(() => {
  const role = profile.value?.userRole || ''
  if (/admin|管理员/i.test(role)) return 'https://file.fishpi.cn/adminRole.png'
  if (/^op$|运营/i.test(role)) return 'https://file.fishpi.cn/opRole.png'
  if (/police|纪律委员/i.test(role)) return 'https://file.fishpi.cn/policeRole.png'
  return ''
})

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
  const key = apiKey.value
  anchor.value = element
  currentUserName.value = userName
  failed.value = false
  active.value = true
  positionCard()

  const cached = cache.get(userName)
  if (cached) {
    cache.delete(userName)
    cache.set(userName, cached)
    profile.value = cached
    loading.value = false
    await nextTick()
    if (id === requestId) positionCard()
    return
  }

  profile.value = null
  loading.value = true
  try {
    const data = await fetchUserProfile(userName, key, { fallbackToMock: false })
    if (id !== requestId || !active.value) return
    cache.set(userName, data)
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!)
    profile.value = data
  } catch {
    if (id === requestId && active.value) failed.value = true
  } finally {
    if (id === requestId) {
      loading.value = false
      await nextTick()
      if (id === requestId) positionCard()
    }
  }
}

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
watch([apiKey, () => account.value?.userName, () => account.value?.oId], () => {
  hide()
  cache.clear()
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
  cache.clear()
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
          <p>用户资料加载失败，请稍后再试。</p>
          <RouterLink :to="`/member/${encodeURIComponent(currentUserName)}`">查看用户主页</RouterLink>
        </div>

        <template v-else-if="profile">
          <div v-if="profile.cardBg" class="card-cover" :style="{ backgroundImage: `url('${profile.cardBg}')` }" />
          <div class="card-main" :class="{ 'card-main--cover': profile.cardBg }">
            <RouterLink class="avatar-link" :to="`/member/${profile.userName}`">
              <img class="card-avatar" :src="avatarUrl(profile, 'large')" :alt="profile.userName" />
            </RouterLink>

            <div class="card-meta">
              <div class="name-line">
                <RouterLink class="nickname" :to="`/member/${profile.userName}`">
                  <VipNickname :user-name="profile.userName">{{ profile.userNickname || profile.userName }}</VipNickname>
                </RouterLink>
                <span v-if="profile.mbti" class="mbti">{{ profile.mbti }}</span>
              </div>
              <RouterLink class="username" :to="`/member/${profile.userName}`">@{{ profile.userName }}</RouterLink>
              <p class="intro">{{ memberDescription }}</p>
            </div>
          </div>

          <div v-if="profile.sysMetal?.length" class="medals">
            <MedalList :items="profile.sysMetal.slice(0, 5)" variant="mini" />
          </div>

          <div class="card-footer">
            <div class="facts">
              <img v-if="roleBadge" class="role-badge" :src="roleBadge" :alt="profile.userRole || '身份'" />
              <span v-if="profile.userNo" class="fact" :title="`${profile.userNo} 号成员`">№ {{ profile.userNo }}</span>
              <RouterLink
                v-if="profile.userPoint != null && isLoggedIn"
                class="fact fact-link"
                :to="`/settings/point?to=${profile.userName}`"
                :title="`${Number(profile.userPoint).toLocaleString()} 积分（点击转账）`"
              >
                ◈ {{ Number(profile.userPoint).toLocaleString() }}
              </RouterLink>
              <span v-else-if="profile.userPoint != null" class="fact" :title="`${Number(profile.userPoint).toLocaleString()} 积分`">
                ◈ {{ Number(profile.userPoint).toLocaleString() }}
              </span>
              <RouterLink v-if="profile.userCity" class="fact fact-link" :to="`/city/${encodeURIComponent(profile.userCity)}`">
                ⌖ {{ profile.userCity }}
              </RouterLink>
              <a v-if="profile.userURL" class="fact fact-link external" :href="profile.userURL" target="_blank" rel="noopener noreferrer">
                ↗
              </a>
            </div>
            <div class="actions">
              <span class="status" :class="{ online: profile.userOnlineFlag }">
                {{ profile.userOnlineFlag ? '在线' : '离线' }}
              </span>
              <RouterLink v-if="isLoggedIn && !isSelf" class="message" :to="`/chat?toUser=${profile.userName}`">
                私信
              </RouterLink>
            </div>
          </div>
        </template>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
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
  height: 86px;
  background-position: center;
  background-size: cover;
}
.card-main {
  display: flex;
  gap: 12px;
  min-width: 0;
  padding: 16px 16px 10px;
}
.card-main--cover {
  margin-top: -30px;
}
.avatar-link {
  align-self: flex-start;
  flex: 0 0 auto;
  border-radius: 8px;
}
.card-avatar {
  display: block;
  width: 72px;
  height: 72px;
  box-sizing: border-box;
  border: 3px solid var(--fp-card);
  border-radius: 8px;
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
.mbti {
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 4px;
  background: #8b87d9;
  color: #fff;
  font-size: 10px;
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
.medals {
  min-height: 25px;
  padding: 0 16px 10px 100px;
  --medal-mini-h: 24px;
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
.role-badge {
  width: auto;
  height: 20px;
  flex: 0 0 auto;
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
.status,
.message {
  box-sizing: border-box;
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 24px;
}
.status {
  background: var(--fp-border);
  color: var(--fp-muted);
}
.status.online {
  background: var(--fp-accent);
  color: #fff;
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
  border-radius: 8px;
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
