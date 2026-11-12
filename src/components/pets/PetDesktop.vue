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
import { usePetClock } from './usePetClock'

const auth = useAuthStore(), pets = usePetsStore(), display = usePetDisplayStore(), layout = useLayoutStore(), route = useRoute()
const mounted = ref(false), panelOpen = ref(false), dragging = ref(false)
const hadPet = ref(false)
const element = ref<HTMLElement | null>(null), panel = ref<HTMLElement | null>(null)
const viewport = ref({ width: 1000, height: 800 }), panelHeight = ref(240)
const { now } = usePetClock()
const owner = computed(() => `${getAuthContextVersion()}:${auth.account?.oId ?? ''}:${!!auth.accessToken}`)
const recovering = computed(() => hadPet.value && !pets.pet && pets.refreshNeeded)
const shown = computed(() => mounted.value && auth.isLoggedIn && (!!pets.pet || recovering.value) && display.visible && !layout.immersive)
const panelWidth = computed(() => Math.min(296, viewport.value.width - 16))
const panelStyle = computed(() => {
  const pos = display.position ?? { x: 0, y: 0 }
  const width = display.collapsed || recovering.value ? 56 : 144
  const height = element.value?.offsetHeight ?? (display.collapsed ? 56 : 160)
  const left = Math.max(8, Math.min(pos.x + width / 2 - panelWidth.value / 2, viewport.value.width - panelWidth.value - 8))
  const minTop = headerBottom()
  const top = pos.y - panelHeight.value - 10 >= minTop ? pos.y - panelHeight.value - 10 : Math.max(minTop, Math.min(pos.y + height + 10, viewport.value.height - panelHeight.value - 8))
  return { left: `${left}px`, top: `${top}px`, width: `${panelWidth.value}px` }
})
let observer: ResizeObserver | undefined
let drag: { pointer: number; x: number; y: number; left: number; top: number } | null = null
const completedRests = new Set<string>()

function headerBottom() {
  if (!mounted.value) return 80
  const bottom = document.querySelector('[data-site-navigation]')?.getBoundingClientRect().bottom ?? 0
  return Math.max(8, bottom + 8)
}
function bounded(x: number, y: number) {
  const width = element.value?.offsetWidth ?? (display.collapsed ? 56 : 144)
  const height = element.value?.offsetHeight ?? (display.collapsed ? 56 : 160)
  return {
    x: Math.max(8, Math.min(x, viewport.value.width - width - 8)),
    y: Math.max(headerBottom(), Math.min(y, viewport.value.height - height - 12)),
  }
}
function clampPosition() {
  if (!mounted.value) return
  viewport.value = { width: window.innerWidth, height: window.innerHeight }
  const original = display.position ?? { x: window.innerWidth - (display.collapsed ? 72 : 168), y: window.innerHeight - (display.collapsed ? 132 : 220) }
  const next = bounded(original.x, original.y)
  if (!display.position || next.x !== display.position.x || next.y !== display.position.y) display.move(next.x, next.y)
  if (panel.value) panelHeight.value = panel.value.offsetHeight
}
function pointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  clampPosition()
  panelOpen.value = false
  const pos = display.position!
  drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, left: pos.x, top: pos.y }
  dragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function pointerMove(event: PointerEvent) {
  if (!drag || drag.pointer !== event.pointerId) return
  const pos = bounded(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y)
  display.move(pos.x, pos.y)
}
function pointerUp(event: PointerEvent) {
  if (!drag || drag.pointer !== event.pointerId) return
  drag = null
  dragging.value = false
  if (display.position) display.move(display.position.x, display.position.y, true)
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
}
function pointerLost() { drag = null; dragging.value = false }
function moveByKey(event: KeyboardEvent) {
  const step = event.shiftKey ? 32 : 12
  const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
  if (!delta[event.key] || !display.position) return
  event.preventDefault()
  const [x, y] = delta[event.key]!
  const pos = bounded(display.position.x + x, display.position.y + y)
  display.move(pos.x, pos.y, true)
}
function close() { panelOpen.value = false; display.hide() }
function collapse(value: boolean) { panelOpen.value = false; display.setCollapsed(value); void nextTick(clampPosition) }
function closeOutside(event: PointerEvent) {
  const target = event.target as Node
  if (!element.value?.contains(target) && !panel.value?.contains(target)) panelOpen.value = false
}
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') panelOpen.value = false }
function load() { if (mounted.value && auth.isLoggedIn && !document.hidden) void pets.ensureLoaded() }
function onVisible() { if (!document.hidden) { load(); clampPosition(); reconcileRest() } }
function reconcileRest() {
  const pet = pets.pet
  if (!mounted.value || document.hidden || !auth.isLoggedIn || !pet?.activity || pet.activity.endsAt > now.value || pets.loading || pets.busy || pets.pending) return
  const key = `${owner.value}:${pet.id}:${pet.activity.endsAt}`
  if (completedRests.has(key)) return
  // 到期只核对一次当前状态；读取失败由用户重试，不产生后台轮询。
  completedRests.add(key)
  if (completedRests.size > 100) completedRests.delete(completedRests.values().next().value!)
  void pets.refresh()
}
watch(owner, () => { hadPet.value = false; panelOpen.value = false; completedRests.clear(); load() }, { flush: 'sync' })
watch(() => pets.pet, value => { if (value && auth.isLoggedIn) hadPet.value = true }, { immediate: true })
watch(() => route.path, () => { panelOpen.value = false })
watch(() => [now.value, pets.pet?.activity?.endsAt, pets.loading, pets.busy, pets.pending], reconcileRest)
watch(() => [shown.value, display.collapsed, display.position === null], () => { void nextTick(clampPosition) })
watch(panelOpen, () => { void nextTick(clampPosition) })
function observeSize() {
  observer?.disconnect()
  if (element.value) observer?.observe(element.value)
  if (panel.value) observer?.observe(panel.value)
}
watch([element, panel], observeSize)
onMounted(() => {
  mounted.value = true
  display.restore()
  clampPosition()
  observer = new ResizeObserver(clampPosition)
  observeSize()
  window.addEventListener('resize', clampPosition)
  document.addEventListener('visibilitychange', onVisible)
  document.addEventListener('pointerdown', closeOutside)
  document.addEventListener('keydown', onKey)
  load()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', clampPosition)
  document.removeEventListener('visibilitychange', onVisible)
  document.removeEventListener('pointerdown', closeOutside)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <aside v-if="shown" ref="element" class="pet-desktop" :class="{ collapsed: display.collapsed, dragging, recovering }" :style="{ left: `${display.position?.x ?? 0}px`, top: `${display.position?.y ?? 0}px` }" :aria-label="pets.pet ? `${pets.pet.name}桌宠` : '桌宠状态恢复'">
      <div class="desktop-tools">
        <button type="button" class="pet-drag-handle" title="拖动桌宠；方向键移动，双击恢复位置" aria-label="移动桌宠，支持方向键" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp" @lostpointercapture="pointerLost" @keydown="moveByKey" @dblclick="display.resetPosition()"><PetIcon name="move" /></button>
        <button v-if="!display.collapsed && !recovering" type="button" title="收起桌宠" aria-label="收起桌宠" @click="collapse(true)"><PetIcon name="minus" /></button>
        <button type="button" title="隐藏桌宠，可在宠物家园重新显示" aria-label="隐藏桌宠" @click="close"><PetIcon name="close" /></button>
      </div>
      <button v-if="pets.pet" type="button" class="pet-character" :aria-label="display.collapsed ? `展开${pets.pet.name}` : `照顾${pets.pet.name}`" :aria-expanded="panelOpen" @click="display.collapsed ? collapse(false) : panelOpen = !panelOpen">
        <img :src="`/images/pets/${pets.pet.speciesId}.webp`" :alt="pets.pet.name" :width="display.collapsed ? 48 : 128" :height="display.collapsed ? 48 : 128" draggable="false" />
        <span v-if="!display.collapsed" class="desktop-name">{{ pets.pet.name }}<small>Lv. {{ pets.pet.level }}</small></span>
        <span v-if="pets.pet.activity" class="desktop-sleep" aria-label="休息中">z</span>
      </button>
      <button v-else type="button" class="pet-recovery" aria-label="宠物状态暂不可用，打开恢复面板" title="宠物状态暂不可用" :aria-expanded="panelOpen" @click="panelOpen = !panelOpen"><PetIcon name="refresh" /></button>
    </aside>
    <section v-if="shown && panelOpen" ref="panel" class="pet-desktop-panel" :style="panelStyle" :aria-label="pets.pet ? `照顾${pets.pet.name}` : '恢复宠物状态'">
      <header><div><strong>{{ pets.pet?.name ?? '宠物状态未更新' }}</strong><span v-if="pets.pet">Lv. {{ pets.pet.level }}</span></div><RouterLink to="/pets" title="打开宠物家园" aria-label="打开宠物家园" @click="panelOpen = false"><PetIcon name="home" /></RouterLink></header>
      <div v-if="pets.pet" class="desktop-stats"><span>饱食 <b>{{ pets.pet.hunger }}</b></span><span>水分 <b>{{ pets.pet.water }}</b></span><span>心情 <b>{{ pets.pet.mood }}</b></span><span>精力 <b>{{ pets.pet.energy }}</b></span></div>
      <PetActions v-if="pets.pet" compact />
      <PetFeedback />
      <p v-if="pets.pet?.activity" class="desktop-hint">{{ pets.pet.activity.endsAt > now ? '正在休息，可以提前唤醒。' : '休息已结束，正在核对状态。' }}</p>
    </section>
  </Teleport>
</template>

<style scoped>
.pet-desktop { position: fixed; z-index: 35; width: 144px; color: var(--fp-text); user-select: none; }
.pet-desktop.collapsed, .pet-desktop.recovering { width: 56px; }
.desktop-tools { display: flex; align-items: center; justify-content: center; gap: 2px; opacity: 0; transition: opacity .16s; }
.pet-desktop:hover .desktop-tools, .pet-desktop:focus-within .desktop-tools, .pet-desktop.dragging .desktop-tools { opacity: 1; }
.desktop-tools button { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 1px solid var(--fp-border); border-radius: 7px; color: var(--fp-muted); background: var(--fp-card); cursor: pointer; }
.desktop-tools svg { width: 14px; height: 14px; }.desktop-tools button:hover { color: var(--fp-primary); }
.desktop-tools button.pet-drag-handle { cursor: grab; touch-action: none; }.dragging .pet-drag-handle { cursor: grabbing; }
.pet-character { position: relative; display: flex; flex-direction: column; align-items: center; width: 100%; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; }
.pet-character img { display: block; object-fit: contain; filter: drop-shadow(0 4px 4px rgb(0 0 0 / .05)); transition: transform .2s; }.pet-character:hover img { transform: translateY(-3px); }
.desktop-name { display: flex; align-items: center; justify-content: center; gap: 5px; width: max-content; max-width: 100%; padding: 4px 8px; border: 1px solid var(--fp-border); border-radius: 7px; background: var(--fp-card); font-size: 11px; overflow-wrap: anywhere; }.desktop-name small { font-size: 10px; color: var(--fp-muted); white-space: nowrap; }
.pet-recovery { display: grid; place-items: center; width: 48px; height: 48px; margin: 4px auto 0; border: 1px solid var(--fp-border); border-radius: 12px; color: var(--fp-muted); background: var(--fp-card); cursor: pointer; }
.desktop-sleep { position: absolute; top: 18px; right: 15px; font-weight: 700; font-size: 16px; color: var(--fp-muted); }
.collapsed .pet-character { border: 1px solid var(--fp-border); border-radius: 14px; background: var(--fp-card); box-shadow: 0 4px 16px rgb(0 0 0 / .06); }.collapsed .desktop-sleep { top: 2px; right: 5px; font-size: 12px; }.collapsed .desktop-tools { margin-bottom: 4px; }.collapsed .desktop-tools button { width: 24px; height: 24px; }
.pet-desktop-panel { position: fixed; z-index: 36; padding: 14px; border: 1px solid var(--fp-border); border-radius: 14px; background: var(--fp-card); color: var(--fp-text); box-shadow: 0 10px 36px rgb(0 0 0 / .12); max-height: calc(100dvh - 100px); overflow: auto; }
.pet-desktop-panel header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 12px; }.pet-desktop-panel header > div { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; }.pet-desktop-panel strong { font-size: 14px; overflow-wrap: anywhere; }.pet-desktop-panel header span { color: var(--fp-muted); font-size: 11px; }.pet-desktop-panel header a { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 6px; color: var(--fp-muted); }.pet-desktop-panel header a:hover { color: var(--fp-primary); background: var(--fp-hover); }.pet-desktop-panel header svg { width: 17px; height: 17px; }
.desktop-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; padding: 0 0 12px; border-bottom: 1px solid var(--fp-border); margin-bottom: 8px; }.desktop-stats span { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: var(--fp-muted); }.desktop-stats b { color: var(--fp-text); font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
.desktop-hint { margin: 8px 0 0; color: var(--fp-muted); font-size: 11px; }.pet-desktop-panel :deep(.pet-feedback) { margin-top: 8px; font-size: 11px; }
button:focus-visible, a:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 3px; }
@media (hover: none) { .desktop-tools { opacity: 1; }.desktop-tools button { width: 32px; height: 32px; } }
@media (prefers-reduced-motion: reduce) { .desktop-tools, .pet-character img { transition: none; } }
</style>
<style>
body:has(.img-zoom, .vditor--fullscreen) :is(.pet-desktop, .pet-desktop-panel) { visibility: hidden; pointer-events: none; }
</style>
