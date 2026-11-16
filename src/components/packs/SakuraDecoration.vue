<script lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const pageVisible = ref(false)
const reduced = ref(false)
const targets = new Map<Element, (visible: boolean) => void>()
let observer: IntersectionObserver | undefined
let motion: MediaQueryList | undefined

function syncVisibility() { pageVisible.value = !document.hidden }
function syncMotion() { reduced.value = motion?.matches ?? false }

function observeDecoration(element: Element, update: (visible: boolean) => void) {
  if (typeof IntersectionObserver === 'undefined') return
  if (!observer) {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) targets.get(entry.target)?.(entry.isIntersecting)
    })
    motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    syncVisibility()
    syncMotion()
    document.addEventListener('visibilitychange', syncVisibility)
    motion.addEventListener('change', syncMotion)
  }
  targets.set(element, update)
  observer.observe(element)
  return () => {
    observer?.unobserve(element)
    targets.delete(element)
    if (targets.size) return
    observer?.disconnect()
    observer = undefined
    document.removeEventListener('visibilitychange', syncVisibility)
    motion?.removeEventListener('change', syncMotion)
    motion = undefined
  }
}
</script>

<script setup lang="ts">
const props = defineProps<{
  styleId: 'sakura-letter' | 'sakura-moon'
  kind: 'bubble' | 'frame'
  enabled?: boolean
  own?: boolean
}>()

const root = ref<HTMLElement>()
const visible = ref(false)
let unobserve: (() => void) | undefined
onMounted(() => {
  const parent = root.value?.parentElement
  if (parent) unobserve = observeDecoration(parent, value => { visible.value = value })
})
onBeforeUnmount(() => unobserve?.())

const petals = computed(() => {
  const mirrored = Boolean(props.own) !== (props.kind === 'bubble' && props.styleId === 'sakura-letter')
  const direction = mirrored ? -1 : 1
  const points = props.kind === 'frame'
    ? [[24,-14,39,1,6], [8,-29,-10,-39,7], [-24,-10,-42,8,6], [-14,19,-36,26,5], [23,19,48,9,7]]
    : props.styleId === 'sakura-moon'
      ? [[-11,-25,-67,-28,8], [-37,-13,-104,3,9], [9,-18,-37,-36,7], [-22,19,-71,20,5], [-61,-22,-123,-10,10], [26,-12,41,17,7], [-11,-18,-95,-35,7], [37,8,49,29,5], [-46,10,-89,33,6]]
      : [[31,-10,57,20,8], [43,5,83,35,10], [9,-27,37,-5,7], [27,20,64,38,9], [-17,-23,-35,11,6], [51,-16,105,24,8], [-27,-9,-56,24,8], [18,-18,74,5,5]]
  return points.map(([x1,y1,x2,y2,size], index) => ({
    '--x1': `${direction * x1!}px`, '--y1': `${y1}px`,
    '--x2': `${direction * x2!}px`, '--y2': `${y2}px`,
    '--petal-size': `${size}px`, '--petal-delay': `${index * 48 + (props.own ? 200 : 0)}ms`,
    '--petal-turn': `${direction * (180 + index * 16)}deg`,
  }))
})
const playing = computed(() => props.enabled && visible.value && pageVisible.value && !reduced.value)
</script>

<template>
  <span ref="root" class="sakura-decoration" :data-sakura="styleId" :data-part="kind" :class="{ 'is-mirrored': own, 'is-playing': playing }" aria-hidden="true">
    <span class="sakura-canvas">
      <template v-if="kind === 'bubble'">
        <i class="sakura-paper sakura-rim" /><i class="sakura-paper sakura-fill" /><i class="sakura-trim" />
      </template>
      <i class="sakura-seal" />
      <span v-if="playing" class="sakura-flight">
        <i v-for="(petal, index) in petals" :key="index" class="sakura-petal" :style="petal" />
      </span>
    </span>
  </span>
</template>
