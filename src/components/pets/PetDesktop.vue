<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { usePetsStore } from '@/stores/pets'
import { usePetDisplayStore } from '@/stores/petDisplay'
import { useLayoutStore } from '@/stores/layout'
import PetActions from './PetActions.vue'
import PetFeedback from './PetFeedback.vue'
import PetIcon from './PetIcon.vue'
import PetAnimation from './PetAnimation.vue'
import { usePetAnimationState } from './usePetAnimationState'
import { usePetClock } from './usePetClock'
import { petActivityStatus } from './petActivityStatus'
import { usePetPlacement } from './layout/usePetPlacement'
import type { FloatingPoint } from './layout/floatingPlacement'

const auth = useAuthStore(), pets = usePetsStore(), display = usePetDisplayStore(), layout = useLayoutStore(), route = useRoute()
const mounted = ref(false), panelOpen = ref(false), dragging = ref(false)
const hadPet = ref(false)
const element = ref<HTMLElement | null>(null), panel = ref<HTMLElement | null>(null)
const dragPosition = ref<FloatingPoint | null>(null)
const { now } = usePetClock()
const activityText = computed(() => petActivityStatus(pets.pet?.activity ?? null, now.value))
const activityClaimable = computed(() => {
  const activity = pets.pet?.activity
  return !!activity && activity.kind !== 'rest' && (activity.status === 'claimable' || activity.endsAt <= now.value)
})
const owner = computed(() => `${getAuthContextVersion()}:${auth.account?.oId ?? ''}:${!!auth.accessToken}`)
const recovering = computed(() => hadPet.value && !pets.pet && pets.refreshNeeded)
const available = computed(() => mounted.value && auth.isLoggedIn && (!!pets.pet || recovering.value) && display.visible && !layout.immersive)
const placement = usePetPlacement({ element, panel, preferred: () => display.position, collapsed: () => display.collapsed || recovering.value,
  active: () => available.value, panelOpen: () => panelOpen.value })
const shown = computed(() => available.value && !placement.suppressed.value)
const compact = placement.compact, narrow = placement.narrow, panelStyle = placement.panelStyle
const animationActive = computed(() => shown.value && !compact.value && !dragging.value)
const animation = usePetAnimationState(now, animationActive)
const actualPosition = computed(() => dragPosition.value ?? placement.position.value)
let drag: { pointer: number; x: number; y: number; left: number; top: number; moved: boolean } | null = null
let ignoreClickUntil = 0
const completedRests = new Set<string>()

function pointerDown(event: PointerEvent) {
  if (event.button !== 0 || event.isPrimary === false) return
  placement.refresh()
  const pos = placement.position.value
  drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, left: pos.x, top: pos.y, moved: false }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function pointerMove(event: PointerEvent) {
  if (!drag || drag.pointer !== event.pointerId) return
  if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4 && !drag.moved) return
  if (!drag.moved) panelOpen.value = false
  drag.moved = true; dragging.value = true
  dragPosition.value = placement.clamp({ x: drag.left + event.clientX - drag.x, y: drag.top + event.clientY - drag.y })
}
function pointerUp(event: PointerEvent) {
  if (!drag || drag.pointer !== event.pointerId) return
  if (drag.moved && dragPosition.value) {
    display.move(dragPosition.value.x, dragPosition.value.y, true)
    ignoreClickUntil = Date.now() + 350
  }
  drag = null; dragPosition.value = null; dragging.value = false
  placement.refresh()
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
}
function pointerLost() { drag = null; dragPosition.value = null; dragging.value = false }
function moveByKey(event: KeyboardEvent) {
  const step = event.shiftKey ? 32 : 12
  const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
  if (!delta[event.key]) return
  event.preventDefault()
  const [x, y] = delta[event.key]!
  const pos = placement.clamp({ x: actualPosition.value.x + x, y: actualPosition.value.y + y })
  display.move(pos.x, pos.y, true)
}
function activateCharacter() {
  if (Date.now() < ignoreClickUntil) return
  if (display.collapsed && !narrow.value) collapse(false)
  else panelOpen.value = !panelOpen.value
}
function close() { panelOpen.value = false; display.hide() }
function collapse(value: boolean) { panelOpen.value = false; display.setCollapsed(value); placement.schedule() }
function closeOutside(event: PointerEvent) {
  const target = event.target as Node
  if (!element.value?.contains(target) && !panel.value?.contains(target)) panelOpen.value = false
}
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') panelOpen.value = false }
function load() { if (mounted.value && auth.isLoggedIn && !document.hidden) void pets.ensureLoaded() }
function onVisible() { if (!document.hidden) { load(); placement.schedule(); reconcileRest() } }
function reconcileRest() {
  const pet = pets.pet
  if (!mounted.value || document.hidden || !auth.isLoggedIn || pet?.activity?.kind !== 'rest' || pet.activity.endsAt > now.value || pets.loading || pets.busy || pets.pending) return
  const key = `${owner.value}:${pet.id}:${pet.activity.endsAt}`
  if (completedRests.has(key)) return
  // 到期只核对一次当前状态；读取失败由用户重试，不产生后台轮询。
  completedRests.add(key)
  if (completedRests.size > 100) completedRests.delete(completedRests.values().next().value!)
  void pets.refresh()
}
watch(owner, () => { hadPet.value = false; panelOpen.value = false; completedRests.clear(); load() }, { flush: 'sync' })
watch(() => pets.pet, value => { if (value && auth.isLoggedIn) hadPet.value = true }, { immediate: true })
watch(() => route.path, () => { panelOpen.value = false; placement.schedule() })
watch(() => [now.value, pets.pet?.activity?.endsAt, pets.loading, pets.busy, pets.pending], reconcileRest)
watch(placement.suppressed, value => { if (value) { panelOpen.value = false; pointerLost() } })
watch(panelOpen, async value => { if (value) { await nextTick(); panel.value?.focus() } })
onMounted(() => {
  mounted.value = true
  display.restore()
  placement.schedule()
  document.addEventListener('visibilitychange', onVisible)
  document.addEventListener('pointerdown', closeOutside)
  document.addEventListener('keydown', onKey)
  load()
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisible)
  document.removeEventListener('pointerdown', closeOutside)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <aside v-if="shown" ref="element" class="pet-desktop" :class="{ collapsed: compact, narrow, dragging, recovering }" :style="{ left: `${actualPosition.x}px`, top: `${actualPosition.y}px` }" :aria-label="pets.pet ? `${pets.pet.name}桌宠` : '桌宠状态恢复'">
      <div class="desktop-tools">
        <button type="button" class="pet-drag-handle" title="拖动桌宠；方向键移动，双击恢复位置" aria-label="移动桌宠，支持方向键" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerLost" @lostpointercapture="pointerLost" @keydown="moveByKey" @dblclick="display.resetPosition()"><PetIcon name="move" /></button>
        <button v-if="!compact && !recovering" type="button" title="收起桌宠" aria-label="收起桌宠" @click="collapse(true)"><PetIcon name="minus" /></button>
        <button type="button" title="隐藏桌宠，可在宠物家园重新显示" aria-label="隐藏桌宠" @click="close"><PetIcon name="close" /></button>
      </div>
      <button v-if="pets.pet" type="button" class="pet-character" :aria-label="display.collapsed && !narrow ? `展开${pets.pet.name}` : `照顾${pets.pet.name}`" :title="narrow ? '点击照顾，拖动调整位置' : undefined" :aria-expanded="panelOpen" @click="activateCharacter" @pointerdown="narrow && pointerDown($event)" @pointermove="narrow && pointerMove($event)" @pointerup="narrow && pointerUp($event)" @pointercancel="pointerLost" @lostpointercapture="pointerLost" @keydown="narrow && moveByKey($event)">
        <PetAnimation :key="pets.pet.id" :species="pets.pet.speciesId" :alt="pets.pet.name" :action="animation.action.value" :loop="animation.loop.value" :playback-key="animation.playbackKey.value" :active="animationActive" :width="compact ? 48 : 128" :height="compact ? 48 : 128" @ended="animation.end" />
        <span v-if="!compact" class="desktop-name">{{ pets.pet.name }}<small>Lv. {{ pets.pet.level }}</small></span>
        <span v-if="pets.pet.activity?.kind === 'rest'" class="desktop-sleep" aria-label="休息中">z</span>
        <span v-else-if="pets.pet.activity" class="desktop-activity" :aria-label="activityClaimable ? '活动成果待领取' : pets.pet.activity.kind === 'outing' ? '外出中' : pets.pet.activity.kind === 'work' ? '工作中' : '上课中'"><PetIcon :name="activityClaimable ? 'gift' : pets.pet.activity.kind" /></span>
      </button>
      <button v-else type="button" class="pet-recovery" aria-label="宠物状态暂不可用，打开恢复面板" title="宠物状态暂不可用" :aria-expanded="panelOpen" @click="panelOpen = !panelOpen"><PetIcon name="refresh" /></button>
    </aside>
    <section v-if="shown && panelOpen" ref="panel" class="pet-desktop-panel" :style="panelStyle" tabindex="-1" :aria-label="pets.pet ? `照顾${pets.pet.name}` : '恢复宠物状态'">
      <header><div><strong>{{ pets.pet?.name ?? '宠物状态未更新' }}</strong><span v-if="pets.pet">Lv. {{ pets.pet.level }}</span></div><RouterLink to="/pets" title="打开宠物家园" aria-label="打开宠物家园" @click="panelOpen = false"><PetIcon name="home" /></RouterLink><button type="button" class="desktop-panel-close" aria-label="关闭桌宠面板" @click="panelOpen = false"><PetIcon name="close" /></button></header>
      <div v-if="pets.pet" class="desktop-stats"><span>饱食 <b>{{ pets.pet.hunger }}</b></span><span>水分 <b>{{ pets.pet.water }}</b></span><span>心情 <b>{{ pets.pet.mood }}</b></span><span>精力 <b>{{ pets.pet.energy }}</b></span></div>
      <PetActions v-if="pets.pet" compact />
      <PetFeedback />
      <p v-if="pets.pet?.activity" class="desktop-hint">{{ activityText }}</p>
      <RouterLink v-if="pets.pet?.activity && pets.pet.activity.kind !== 'rest'" class="desktop-activity-link" to="/pets#pet-activities" @click="panelOpen = false">{{ activityClaimable ? '回家领取成果' : '查看活动' }} <span aria-hidden="true">↗</span></RouterLink>
      <footer class="desktop-panel-tools"><button v-if="!narrow" type="button" @click="collapse(!display.collapsed)">{{ display.collapsed ? '展开桌宠' : '收起桌宠' }}</button><button type="button" @click="display.resetPosition(); panelOpen = false">恢复位置</button><button type="button" @click="close">隐藏桌宠</button></footer>
    </section>
  </Teleport>
</template>

<style scoped>
.pet-desktop { position: fixed; z-index: 35; width: 144px; color: var(--fp-text); user-select: none; }
.pet-desktop.collapsed, .pet-desktop.recovering { width: 56px; }
.pet-desktop.narrow { width: 48px; }.narrow .desktop-tools { display: none; }.narrow .pet-character { width: 48px; height: 48px; touch-action: none; }.narrow .pet-character .pet-animation { width: 44px; height: 44px; }.narrow .pet-character:hover .pet-animation { transform: none; }.narrow .pet-recovery { margin: 0; }
.desktop-tools { display: flex; align-items: center; justify-content: center; gap: 2px; opacity: 0; transition: opacity .16s; }
.pet-desktop:hover .desktop-tools, .pet-desktop:focus-within .desktop-tools, .pet-desktop.dragging .desktop-tools { opacity: 1; }
.desktop-tools button { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 1px solid var(--fp-border); border-radius: 7px; color: var(--fp-muted); background: var(--fp-card); cursor: pointer; }
.desktop-tools svg { width: 14px; height: 14px; }.desktop-tools button:hover { color: var(--fp-primary); }
.desktop-tools button.pet-drag-handle { cursor: grab; touch-action: none; }.dragging .pet-drag-handle { cursor: grabbing; }
.pet-character { position: relative; display: flex; flex-direction: column; align-items: center; width: 100%; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; }
.pet-character .pet-animation { display: block; object-fit: contain; filter: drop-shadow(0 4px 4px rgb(0 0 0 / .05)); transition: transform .2s; }.pet-character:hover .pet-animation { transform: translateY(-3px); }
.desktop-name { display: flex; align-items: center; justify-content: center; gap: 5px; width: max-content; max-width: 100%; padding: 4px 8px; border: 1px solid var(--fp-border); border-radius: 7px; background: var(--fp-card); font-size: 11px; overflow-wrap: anywhere; }.desktop-name small { font-size: 10px; color: var(--fp-muted); white-space: nowrap; }
.pet-recovery { display: grid; place-items: center; width: 48px; height: 48px; margin: 4px auto 0; border: 1px solid var(--fp-border); border-radius: 12px; color: var(--fp-muted); background: var(--fp-card); cursor: pointer; }
.desktop-sleep { position: absolute; top: 18px; right: 15px; font-weight: 700; font-size: 16px; color: var(--fp-muted); }
.desktop-activity { position: absolute; right: 12px; top: 16px; display: grid; place-items: center; width: 25px; height: 25px; border: 1px solid var(--fp-border); border-radius: 8px; color: var(--fp-primary); background: var(--fp-card); }.desktop-activity svg { width: 15px; height: 15px; }.collapsed .desktop-activity { width: 20px; height: 20px; right: -4px; top: -5px; border-radius: 6px; }.collapsed .desktop-activity svg { width: 12px; height: 12px; }
.collapsed .pet-character { border: 1px solid var(--fp-border); border-radius: 14px; background: var(--fp-card); box-shadow: 0 4px 16px rgb(0 0 0 / .06); }.collapsed .desktop-sleep { top: 2px; right: 5px; font-size: 12px; }.collapsed .desktop-tools { margin-bottom: 4px; }.collapsed .desktop-tools button { width: 24px; height: 24px; }
.pet-desktop-panel { position: fixed; z-index: 36; box-sizing: border-box; padding: 14px; border: 1px solid var(--fp-border); border-radius: 14px; background: var(--fp-card); color: var(--fp-text); box-shadow: 0 10px 36px rgb(0 0 0 / .12); overflow: auto; overscroll-behavior: contain; outline: none; }
.pet-desktop-panel header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 12px; }.pet-desktop-panel header > div { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; }.pet-desktop-panel strong { font-size: 14px; overflow-wrap: anywhere; }.pet-desktop-panel header span { color: var(--fp-muted); font-size: 11px; }.pet-desktop-panel header a { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 6px; color: var(--fp-muted); }.pet-desktop-panel header a:hover { color: var(--fp-primary); background: var(--fp-hover); }.pet-desktop-panel header svg { width: 17px; height: 17px; }
.desktop-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; padding: 0 0 12px; border-bottom: 1px solid var(--fp-border); margin-bottom: 8px; }.desktop-stats span { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: var(--fp-muted); }.desktop-stats b { color: var(--fp-text); font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
.desktop-hint { margin: 8px 0 0; color: var(--fp-muted); font-size: 11px; }.pet-desktop-panel :deep(.pet-feedback) { margin-top: 8px; font-size: 11px; }
.desktop-activity-link { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; padding: 8px 10px; border-radius: 7px; background: var(--fp-primary-soft); color: var(--fp-primary); font-size: 12px; text-decoration: none; }.desktop-activity-link:hover { text-decoration: underline; }
.desktop-panel-close { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px; color: var(--fp-muted); background: transparent; cursor: pointer; }.pet-desktop-panel header > div { flex: 1; }.desktop-panel-close:hover { background: var(--fp-hover); color: var(--fp-text); }.desktop-panel-tools { display: flex; flex-wrap: wrap; gap: 4px; padding-top: 8px; margin-top: 10px; border-top: 1px solid var(--fp-border); }.desktop-panel-tools button { flex: 1; min-height: 36px; padding: 7px 5px; font: inherit; font-size: 11px; color: var(--fp-muted); border: 0; border-radius: 7px; background: transparent; cursor: pointer; }.desktop-panel-tools button:hover { background: var(--fp-hover); }
button:focus-visible, a:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
@media (hover: none) { .desktop-tools { opacity: 1; }.desktop-tools button { width: 32px; height: 32px; } }
@media (max-width: 640px) { .pet-desktop-panel { padding: 12px; }.pet-desktop-panel header { padding-bottom: 8px; gap: 6px; }.pet-desktop-panel header a, .desktop-panel-close { width: 44px; height: 44px; }.desktop-panel-tools button, .desktop-activity-link { min-height: 44px; }.pet-desktop-panel :deep(.pet-actions button) { min-height: 44px; }.pet-desktop-panel :deep(.pet-feedback button) { width: 44px; height: 44px; }.pet-desktop-panel .desktop-stats { gap: 4px; } }
@media (prefers-reduced-motion: reduce) { .desktop-tools, .pet-character .pet-animation { transition: none; } }
</style>
