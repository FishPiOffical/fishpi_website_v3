<script setup lang="ts">
import { coverStyle, avatarThumbnail, fallbackAvatar } from '@/utils/avatar'
import VipNickname from '@/components/user/VipNickname.vue'
import UserFollowButton from '@/components/user/UserFollowButton.vue'
import V3MedalImage from '@/components/medal/V3MedalImage.vue'
import { getAuthContextVersion } from '@/api/http'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchPublicUser, type PublicUser } from '@/api/v3-public-user'
import { fetchV3PublicMedals, type PublicMedal } from '@/api/v3-medals'
import { useAuthStore } from '@/stores/auth'
import { formatOnlineMinutes } from '@/utils/time'

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
const medalsEl = ref<HTMLElement | null>(null)
const medals = ref<PublicMedal[]>([])
const medalTotal = ref(0)
const medalPage = ref(0)
const medalPageCount = ref(0)
const medalsExpanded = ref(false)
const medalLoading = ref(false)
const medalFailed = ref(false)
const medalOverflow = ref(false)
const visibleMedalCount = ref(0)
const anchor = ref<HTMLElement | null>(null)
const position = ref({ left: VIEWPORT_PADDING, top: VIEWPORT_PADDING, side: 'right' as 'left' | 'right' })

let showTimer: ReturnType<typeof setTimeout> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined
let requestId = 0
let lastPointerType = ''
let cardObserver: ResizeObserver | undefined
let medalsObserver: ResizeObserver | undefined

const isSelf = computed(() => account.value?.oId === profile.value?.id)
const canAct = computed(() => isLoggedIn.value && !isSelf.value)
const websiteLabel = computed(() => profile.value?.userURL ? new URL(profile.value.userURL).hostname : '')
const medalsCanExpand = computed(() => medalOverflow.value || medalPage.value < medalPageCount.value)

function resetMedals() {
  medals.value = []
  medalTotal.value = 0
  medalPage.value = 0
  medalPageCount.value = 0
  medalsExpanded.value = false
  medalLoading.value = false
  medalFailed.value = false
  medalOverflow.value = false
  visibleMedalCount.value = 0
}

function measureMedals() {
  const items = Array.from(medalsEl.value?.children || []) as HTMLElement[]
  // 按实际换行测量两行边界，兼容长短不一的 SVG 及图片加载后的宽度变化。
  const rows = [...new Set(items.map(item => item.offsetTop))].sort((a, b) => a - b)
  const thirdRow = rows[2]
  visibleMedalCount.value = thirdRow === undefined ? items.length : items.filter(item => item.offsetTop < thirdRow).length
  medalOverflow.value = thirdRow !== undefined
  positionCard()
}

function restoreMedalFocus(includeRetry = true) {
  const focused = document.activeElement
  if (focused?.classList?.contains('medal-more') || (includeRetry && focused?.classList?.contains('medal-retry'))) {
    const focusTarget = cardEl.value?.querySelector<HTMLElement>('.medal-toggle') || cardEl.value
    focusTarget?.focus({ preventScroll: true })
  }
}

async function loadMoreMedals() {
  if (medalLoading.value || !active.value || !profile.value || !isLoggedIn.value) return
  if (medalPage.value && medalPage.value >= medalPageCount.value) return
  const id = requestId, name = profile.value.userName, token = accessToken.value
  const boundary = getAuthContextVersion(), owner = account.value?.oId
  const valid = () => mounted.value && active.value && id === requestId && name === profile.value?.userName
    && token === accessToken.value && boundary === getAuthContextVersion() && owner === account.value?.oId
  medalLoading.value = true
  try {
    const result = await fetchV3PublicMedals(name, medalPage.value + 1)
    if (!valid()) return
    // 异步期间保留按钮；成功后若入口会消失，将焦点交还展开按钮或卡片，避免浮层误关闭。
    if (medalFailed.value || result.p >= result.pageCount) restoreMedalFocus()
    medalFailed.value = false
    medals.value.push(...result.list)
    medalTotal.value = result.total
    medalPage.value = result.p
    medalPageCount.value = result.pageCount
    await nextTick()
    if (valid()) measureMedals()
  } catch {
    // 勋章读取失败时保留已加载的公开资料，重试只读取失败的这一页。
    if (valid()) {
      restoreMedalFocus(false)
      medalFailed.value = true
    }
  } finally {
    if (valid()) {
      medalLoading.value = false
      await nextTick()
      if (valid()) positionCard()
    }
  }
}

async function toggleMedals() {
  cancelHide()
  medalsExpanded.value = !medalsExpanded.value
  if (medalsExpanded.value && medalPage.value < medalPageCount.value) void loadMoreMedals()
  await nextTick()
  measureMedals()
}

watch(cardEl, element => {
  cardObserver?.disconnect()
  if (!element || typeof ResizeObserver === 'undefined') return
  cardObserver = new ResizeObserver(positionCard)
  cardObserver.observe(element)
}, { flush: 'post' })

watch(medalsEl, element => {
  medalsObserver?.disconnect()
  if (!element) return
  measureMedals()
  if (typeof ResizeObserver === 'undefined') return
  medalsObserver = new ResizeObserver(measureMedals)
  medalsObserver.observe(element)
}, { flush: 'post' })

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
  resetMedals()
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
  profile.value = null; resetMedals(); failed.value = false; loading.value = true
  try { const data = await fetchPublicUser(name); if (valid()) profile.value = data }
  catch { if (valid()) failed.value = true }
  finally { if (valid()) { loading.value = false; await nextTick(); if (valid()) positionCard() } }

  const publicName = profile.value?.userName
  if (!valid() || !publicName || !isLoggedIn.value) return
  await loadMoreMedals()
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
  cardObserver?.disconnect()
  medalsObserver?.disconnect()
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
        tabindex="-1"
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

        <div v-else-if="profile" class="card-profile" :class="{ 'card-profile--background': profile.cardBg }" :style="profile.cardBg ? coverStyle(profile.cardBg, 400) : undefined">
          <div v-if="profile.cardBg" class="card-cover">
            <span v-if="profile.userNo" class="cover-number" :aria-label="`成员序号 ${profile.userNo}`"># {{ profile.userNo }}</span>
          </div>
          <div class="card-content">
            <div class="card-main">
              <RouterLink class="avatar-link" :to="`/member/${encodeURIComponent(profile.userName)}`">
                <img class="card-avatar" :src="avatarThumbnail(profile.userAvatarURL, 64)" @error="fallbackAvatar" :alt="profile.userName" referrerpolicy="no-referrer" />
              </RouterLink>
              <div class="card-meta">
                <RouterLink class="nickname" :to="`/member/${encodeURIComponent(profile.userName)}`" :title="profile.userNickname || profile.userName">
                  <VipNickname :user-id="profile.id" :user-name="profile.userName">{{ profile.userNickname || profile.userName }}</VipNickname>
                </RouterLink>
                <RouterLink class="username" :to="`/member/${encodeURIComponent(profile.userName)}`">@{{ profile.userName }}</RouterLink>
                <p v-if="profile.userIntro" class="intro">{{ profile.userIntro }}</p>
              </div>
            </div>

            <div v-if="profile.userRole || (!profile.cardBg && profile.userNo) || profile.userCity || profile.userOnlineFlag !== undefined" class="card-facts" aria-label="公开资料">
              <span v-if="profile.userRole" class="card-badge">{{ profile.userRole }}</span>
              <span v-if="profile.userNo && !profile.cardBg" class="member-number" :aria-label="`成员序号 ${profile.userNo}`"># {{ profile.userNo }}</span>
              <span v-if="profile.userOnlineFlag !== undefined" class="card-status" :class="{ online: profile.userOnlineFlag }">{{ profile.userOnlineFlag ? '在线' : '离线' }}</span>
              <span v-if="profile.userCity" class="card-city" :title="`城市 ${profile.userCity}`"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg><span class="sr-only">城市</span>{{ profile.userCity }}</span>
            </div>

            <section v-if="isLoggedIn && (medals.length || medalLoading || medalFailed)" class="card-medals" aria-label="公开勋章" :aria-busy="medalLoading">
              <div class="medal-heading">
                <span>勋章 <span v-if="medalPage" class="medal-count">{{ medalTotal }}</span></span>
                <button v-if="medalsCanExpand || medalsExpanded" type="button" class="medal-toggle" :aria-expanded="medalsExpanded" aria-controls="hover-card-medals" :aria-label="medalsExpanded ? '收起勋章' : '展开全部勋章'" @click="toggleMedals">
                  {{ medalsExpanded ? '收起' : '展开全部' }}<svg viewBox="0 0 16 16" aria-hidden="true" :class="{ expanded: medalsExpanded }"><path d="m4 6 4 4 4-4" /></svg>
                </button>
              </div>
              <div id="hover-card-medals" class="medal-viewport" :class="{ expanded: medalsExpanded }">
                <div ref="medalsEl" class="medal-list" @load.capture="measureMedals" @error.capture="measureMedals">
                  <RouterLink v-for="(item, index) in medals" :key="`${item.id}:${index}`" class="medal-link" :to="{ path: `/member/${encodeURIComponent(profile.userName)}`, hash: '#member-medals' }" :title="[item.name, item.description].filter(Boolean).join(' · ')" :aria-label="`查看公开勋章：${item.name}`" :tabindex="!medalsExpanded && index >= visibleMedalCount ? -1 : undefined" :aria-hidden="!medalsExpanded && index >= visibleMedalCount ? true : undefined">
                    <V3MedalImage :id="item.id" :name="item.name" :user-name="profile.userName" quiet />
                  </RouterLink>
                </div>
              </div>
              <div v-if="medalFailed || medalLoading || (medalsExpanded && medalPage < medalPageCount)" class="medal-status" role="status">
                <template v-if="medalFailed"><span>{{ medalLoading ? '正在加载勋章…' : '勋章暂时无法加载' }}</span><button type="button" class="medal-retry" aria-label="重试读取勋章" title="重试读取勋章" :aria-disabled="medalLoading || undefined" :aria-busy="medalLoading || undefined" @click="loadMoreMedals"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M5 8a7.5 7.5 0 0 1 12.5-3L20 8M4 16l2.5 3A7.5 7.5 0 0 0 19 16" /></svg></button></template>
                <button v-else-if="medalsExpanded && medalPage < medalPageCount" type="button" class="medal-more" aria-label="加载更多勋章" :aria-disabled="medalLoading || undefined" :aria-busy="medalLoading || undefined" @click="loadMoreMedals">{{ medalLoading ? '正在加载勋章…' : '加载更多勋章' }} <span>{{ medals.length }} / {{ medalTotal }}</span></button>
                <span v-else-if="medalLoading">正在加载勋章…</span>
              </div>
            </section>

            <dl v-if="profile.userPoint !== undefined || profile.onlineMinute !== undefined" class="card-metrics">
              <div v-if="profile.userPoint !== undefined" class="metric"><dt>积分</dt><dd>{{ profile.userPoint.toLocaleString('zh-CN') }}</dd></div>
              <div v-if="profile.onlineMinute !== undefined" class="metric" :title="`累计 ${profile.onlineMinute.toLocaleString('zh-CN')} 分钟`"><dt>在线时长</dt><dd class="online-duration">{{ formatOnlineMinutes(profile.onlineMinute) }}</dd></div>
            </dl>
            <a v-if="profile.userURL" class="website" aria-label="访问个人网址" :title="profile.userURL" :href="profile.userURL" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" /></svg><span>{{ websiteLabel }}</span><span aria-hidden="true">↗</span>
            </a>
          </div>
          <div v-if="canAct" class="card-footer">
            <RouterLink class="transfer" :to="`/settings/point?to=${encodeURIComponent(profile.userName)}`">转账 <span aria-hidden="true">↗</span></RouterLink>
            <div class="actions">
              <RouterLink class="message" :to="`/chat?toUser=${encodeURIComponent(profile.userName)}`">私信</RouterLink>
              <UserFollowButton :user-name="profile.userName" :user-id="profile.id" />
            </div>
          </div>
        </div>
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
  max-height: calc(100vh - 24px);
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--fp-border);
  border-radius: 16px;
  background: var(--fp-card);
  box-shadow: 0 12px 36px rgba(22, 31, 45, .16), 0 2px 6px rgba(22, 31, 45, .05);
  color: var(--fp-text);
  scrollbar-width: thin;
}
.card-profile {
  --card-secondary: var(--fp-muted);
  background-size: cover;
  background-position: center top;
  background-repeat: no-repeat;
}
.card-cover {
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  height: 116px;
  padding: 14px 18px;
  box-sizing: border-box;
}
.cover-number {
  padding: 3px 9px;
  border: 1px solid rgba(255, 255, 255, .28);
  border-radius: 20px;
  background: rgba(20, 27, 38, .32);
  color: #fff;
  font-size: 11px;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
}
.card-content { padding: 20px 22px; }
.card-profile--background {
  --card-secondary: color-mix(in srgb, var(--fp-text) 78%, var(--fp-muted));
}
.card-profile--background .card-content {
  // 保留整卡背景，仅用轻遮罩托住文字；指标和操作区域各自增强可读性。
  background: linear-gradient(125deg,
    color-mix(in srgb, var(--fp-card) 58%, transparent),
    color-mix(in srgb, var(--fp-card) 38%, transparent) 72%,
    color-mix(in srgb, var(--fp-card) 52%, transparent));
  border-top: 1px solid color-mix(in srgb, var(--fp-card) 55%, transparent);
}
.card-main { display: flex; gap: 14px; min-width: 0; align-items: flex-start; }
.avatar-link { flex: 0 0 auto; border-radius: var(--fp-avatar-radius); }
.card-avatar {
  display: block;
  width: 64px;
  height: 64px;
  box-sizing: border-box;
  border: 2px solid var(--fp-card);
  border-radius: var(--fp-avatar-radius);
  background: var(--fp-hover);
  object-fit: cover;
}
.card-meta { min-width: 0; flex: 1; }
.nickname {
  display: block;
  overflow: hidden;
  color: var(--fp-title);
  font-size: 20px;
  line-height: 1.4;
  font-weight: 700;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.username { display: block; margin-top: 2px; overflow: hidden; color: var(--card-secondary); font-size: 12px; line-height: 1.5; text-decoration: none; text-overflow: ellipsis; white-space: nowrap; }
.intro { display: -webkit-box; margin: 8px 0 0; overflow: hidden; color: var(--fp-text); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.card-facts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 16px; color: var(--card-secondary); font-size: 12px; line-height: 1.5; }
.card-badge { max-width: 100%; padding: 3px 7px; border: 1px solid var(--fp-border); border-radius: 5px; background: var(--fp-hover); color: var(--fp-text); overflow-wrap: anywhere; }
.card-profile--background .card-badge { background: color-mix(in srgb, var(--fp-card) 44%, transparent); border-color: color-mix(in srgb, var(--fp-card) 60%, transparent); }
.member-number { font-variant-numeric: tabular-nums; }
.card-status { display: inline-flex; align-items: center; gap: 5px; }
.card-status::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.card-status.online::before { background: var(--fp-primary); }
.card-city { display: inline-flex; align-items: center; gap: 3px; min-width: 0; overflow-wrap: anywhere; }
.card-city svg, .website svg, .medal-retry svg { flex-shrink: 0; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.card-medals { margin-top: 18px; min-width: 0; }
.medal-heading { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 9px; color: var(--card-secondary); font-size: 11px; line-height: 18px; }
.medal-count { margin-left: 5px; font-variant-numeric: tabular-nums; }
.medal-toggle, .medal-more, .medal-retry { display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 2px 0; border: 0; background: transparent; color: var(--card-secondary); font: inherit; cursor: pointer; }
.medal-toggle svg { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.5; transition: transform .16s ease; }
.medal-toggle svg.expanded { transform: rotate(180deg); }
.medal-toggle:hover, .medal-more:hover, .medal-retry:hover { color: var(--fp-text); }
.medal-viewport { max-height: 62px; overflow: hidden; }
.medal-viewport.expanded { max-height: 164px; overflow-y: auto; scrollbar-width: thin; overscroll-behavior: contain; }
.medal-list { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.medal-link { display: inline-flex; align-items: center; flex: 0 1 auto; height: 28px; max-width: 100%; min-width: 0; color: var(--card-secondary); text-decoration: none; }
.medal-link:hover { text-decoration: none; }
.medal-link :deep(.v3-medal-image) { max-width: 100%; height: 28px; overflow: hidden; font-size: 12px; }
.medal-link :deep(img) { max-width: 100%; height: 28px; object-fit: contain; }
.medal-link :deep(.v3-medal-image > span) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.medal-status { display: flex; align-items: center; gap: 6px; min-height: 24px; margin-top: 4px; color: var(--card-secondary); font-size: 11px; }
.medal-retry { width: 24px; height: 24px; border-radius: 5px; }
.medal-more { gap: 10px; }
.medal-more[aria-disabled='true'], .medal-retry[aria-disabled='true'] { opacity: .6; cursor: default; }
.card-metrics { display: grid; grid-auto-columns: minmax(0, 1fr); grid-auto-flow: column; gap: 12px; margin: 18px 0 0; padding: 12px 14px; border: 1px solid var(--fp-border); border-radius: 9px; background: var(--fp-hover); }
.card-profile--background .card-metrics { background: color-mix(in srgb, var(--fp-card) 57%, transparent); border-color: color-mix(in srgb, var(--fp-card) 52%, transparent); }
.metric { min-width: 0; }
.metric + .metric { padding-left: 14px; border-left: 1px solid color-mix(in srgb, var(--fp-muted) 20%, transparent); }
.metric dt { margin-bottom: 4px; font-size: 11px; line-height: 16px; color: var(--card-secondary); }
.metric dd { margin: 0; font-size: 20px; line-height: 27px; font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.metric dd.online-duration { font-size: 16px; }
.website { display: flex; align-items: center; gap: 6px; width: fit-content; max-width: 100%; margin-top: 12px; color: var(--card-secondary); font-size: 12px; line-height: 18px; }
.website span:first-of-type { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 22px; border-top: 1px solid var(--fp-border); background: var(--fp-card); }
.card-profile--background .card-footer { background: color-mix(in srgb, var(--fp-card) 72%, transparent); border-color: color-mix(in srgb, var(--fp-card) 55%, transparent); }
.transfer { display: inline-flex; align-items: center; gap: 4px; color: var(--card-secondary); font-size: 12px; }
.actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0; }
.message, .actions :deep(.user-follow-action > button) { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; min-height: 32px; padding: 6px 15px; border: 1px solid var(--fp-border); border-radius: 7px; background: color-mix(in srgb, var(--fp-card) 70%, transparent); color: var(--fp-text); font-size: 12px; line-height: 18px; text-decoration: none; }
.actions :deep(.user-follow-action > button) { border-color: transparent; background: var(--fp-primary); color: #fff; }
.actions :deep(.user-follow-action) { min-width: 0; }
.message:hover { background: var(--fp-hover); text-decoration: none; }
.medal-toggle:focus-visible, .medal-more:focus-visible, .medal-retry:focus-visible, .medal-link:focus-visible, .message:focus-visible, .transfer:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 2px; }
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
@media (prefers-reduced-motion: reduce) {
  .user-card-enter-active, .user-card-leave-active, .medal-toggle svg { transition: none; }
  .skeleton { animation: none; }
}
@media (max-width: 560px), (hover: none) {
  .global-user-card {
    display: none;
  }
}
</style>
