<script lang="ts">
const visibleAuthors = new Map<Element, (visible: boolean) => void>()
let observer: IntersectionObserver | undefined

function observeAuthor(element: HTMLElement, update: (visible: boolean) => void) {
  if (typeof IntersectionObserver === 'undefined') {
    update(true)
    return
  }
  observer ??= new IntersectionObserver(entries => {
    for (const entry of entries) visibleAuthors.get(entry.target)?.(entry.isIntersecting)
  }, { rootMargin: '100px' })
  visibleAuthors.set(element, update)
  observer.observe(element)
  return () => {
    observer?.unobserve(element)
    visibleAuthors.delete(element)
    if (!visibleAuthors.size) {
      observer?.disconnect()
      observer = undefined
    }
  }
}
</script>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useRoute, type RouteLocationRaw } from 'vue-router'
import { chatPetStatusLabels, type ChatPetStatus } from '@/api/v3-chat-messages'
import { formatPartnerValue } from '@/api/v3-partners'
import PetIcon from '@/components/pets/PetIcon.vue'
import { useChatGameStatus } from '@/stores/chatGameStatus'

const props = defineProps<{
  authorLine: HTMLElement | null
  userId: string
  name: string
  own: boolean
  pet?: ChatPetStatus
  petTo: RouteLocationRaw
}>()
const visible = ref(false)
watch(() => props.authorLine, (element, _, cleanup) => {
  visible.value = false
  if (element) {
    const stop = observeAuthor(element, value => { visible.value = value })
    if (stop) cleanup(stop)
  }
}, { immediate: true, flush: 'post' })
const { status } = useChatGameStatus(() => visible.value ? props.userId : undefined)
const available = computed(() => status.value?.parkingFree !== undefined || !!status.value?.partner)
const route = useRoute()
const panelId = useId()
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const position = ref<{ left: string; top?: string; bottom?: string; maxHeight: string } | null>(null)
function close(restoreFocus = false) {
  position.value = null
  if (restoreFocus) trigger.value?.focus({ preventScroll: true })
}
async function toggle() {
  if (position.value) return close()
  if (!trigger.value || !available.value) return
  const rect = trigger.value.getBoundingClientRect()
  const gutter = 8
  const width = Math.min(276, window.innerWidth - 2 * gutter)
  const below = window.innerHeight - rect.bottom
  const above = below < 210 && rect.top > below
  position.value = {
    left: Math.max(gutter, Math.min(rect.left, window.innerWidth - width - gutter)) + 'px',
    ...(above ? { bottom: window.innerHeight - rect.top + 4 + 'px' } : { top: rect.bottom + 4 + 'px' }),
    maxHeight: Math.max(0, (above ? rect.top : below) - gutter - 4) + 'px',
  }
  await nextTick()
  closeButton.value?.focus({ preventScroll: true })
}

watch(position, (open, _, cleanup) => {
  if (!open) return
  function dismissOutside(event: Event) {
    const target = event.target
    if (target instanceof Node && !panel.value?.contains(target) && !trigger.value?.contains(target)) close()
  }
  function dismissOnScroll(event: Event) {
    if (!(event.target instanceof Node && panel.value?.contains(event.target))) close()
  }
  function dismissOnResize() { close() }
  document.addEventListener('pointerdown', dismissOutside, true)
  document.addEventListener('focusin', dismissOutside)
  window.addEventListener('scroll', dismissOnScroll, true)
  window.addEventListener('resize', dismissOnResize)
  cleanup(() => {
    document.removeEventListener('pointerdown', dismissOutside, true)
    document.removeEventListener('focusin', dismissOutside)
    window.removeEventListener('scroll', dismissOnScroll, true)
    window.removeEventListener('resize', dismissOnResize)
  })
})
watch([available, () => props.userId, () => route.fullPath], () => close())
</script>

<template>
  <button v-if="available" ref="trigger" type="button" class="park-trigger" aria-haspopup="dialog"
    :aria-label="'查看' + name + '的游园状态'" :aria-expanded="!!position" :aria-controls="position ? panelId : undefined"
    @click="toggle" @keydown.esc.stop="close(true)">
    <PetIcon name="play" />游园<PetIcon class="caret" name="chevron" />
  </button>
  <Teleport v-if="position && available" to="body">
    <section :id="panelId" ref="panel" class="park-popover" :style="position" role="dialog" :aria-label="name + '的游园状态'"
      @keydown.esc.stop.prevent="close(true)">
      <header><strong>游园状态</strong><button ref="closeButton" type="button" aria-label="收起游园状态" @click="close(true)"><PetIcon name="close" /></button></header>
      <RouterLink v-if="pet" :to="petTo" @click="close()">
        <span class="tile pet"><PetIcon name="pet" /></span><span>宠物家园</span>
        <span class="value">{{ pet.name }} · {{ chatPetStatusLabels[pet.state] }}<template v-if="pet.level"> · Lv.{{ pet.level }}</template></span>
      </RouterLink>
      <RouterLink v-if="status?.parkingFree !== undefined" :to="own ? '/parking' : { path: '/parking', query: { host: userId } }" @click="close()">
        <span class="tile parking" aria-hidden="true">P</span><span>抢车位</span>
        <span class="value">{{ status.parkingFree ? '车位空闲' : '车位已占用' }}</span>
      </RouterLink>
      <RouterLink v-if="status?.partner" :to="own ? '/partners' : { path: '/partners', query: { peer: userId } }" @click="close()">
        <span class="tile partner"><PetIcon name="work" /></span><span>抢搭子</span>
        <span class="value">{{ status.partner.full ? '已满价' : '名片已开放' }}<small v-if="status.partner.displayValue">身价 {{ formatPartnerValue(status.partner.displayValue) }}</small></span>
      </RouterLink>
    </section>
  </Teleport>
</template>

<style scoped>
.park-trigger {
  display:inline-flex; flex:none; align-items:center; gap:3px; padding:1px 5px;
  border:1px solid var(--fp-border); border-radius:5px; background:var(--fp-card); color:var(--fp-muted);
  font:inherit; font-size:11px; line-height:17px; white-space:nowrap; cursor:pointer;
}
.park-trigger[aria-expanded=true],.park-trigger:hover { background:var(--fp-primary-soft); color:var(--fp-primary-ink); }
.park-trigger svg { width:13px; height:13px; }
.park-trigger .caret { width:9px; transform:rotate(90deg); }
.park-popover {
  position:fixed; z-index:1460; width:min(276px,calc(100vw - 16px)); box-sizing:border-box; overflow:auto;
  padding:9px 12px; border:1px solid var(--fp-border); border-radius:12px; background:var(--fp-card);
  color:var(--fp-text); box-shadow:0 6px 24px #18281e24; font-size:13px; line-height:1.5;
}
.park-popover header { display:flex; align-items:center; justify-content:space-between; }
.park-popover header button { border:0; background:transparent; color:var(--fp-muted); padding:4px; display:grid; cursor:pointer; }
.park-popover header svg { width:14px; height:14px; }
.park-popover a { display:grid; grid-template-columns:24px auto minmax(0,1fr); align-items:center; gap:6px; color:inherit; padding:8px 0; text-decoration:none; }
.park-popover a + a { border-top:1px solid var(--fp-border); }
.park-popover a:hover .value { color:var(--fp-primary-ink); }
.tile { width:24px; height:24px; display:grid; place-items:center; border-radius:6px; }
.tile svg { width:15px; height:15px; }
.pet { color:var(--fp-primary-ink); background:var(--fp-primary-soft); }
.parking { color:#355f88; background:#e4eff9; font-weight:700; }
.partner { color:#77532e; background:#f7ebdb; }
.value { color:var(--fp-muted); overflow-wrap:anywhere; text-align:end; }
.value small { display:block; font-size:11px; }
</style>
