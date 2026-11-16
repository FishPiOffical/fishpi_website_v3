<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import type { BubbleShape } from '@/utils/bubbleStyle'

const props = defineProps<{ shape: BubbleShape }>()
const surface = ref<SVGSVGElement | null>(null)
const width = ref(160)
const height = ref(44)
const paint = useId()
let observer: ResizeObserver | undefined

function measure(w: number, h: number) {
  if (w > 0 && h > 0) {
    width.value = w
    height.value = h
  }
}

onMounted(() => {
  if (!surface.value) return
  const box = surface.value.getBoundingClientRect()
  measure(box.width, box.height)
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(([entry]) => {
    if (entry) measure(entry.contentRect.width, entry.contentRect.height)
  })
  observer.observe(surface.value)
})
onBeforeUnmount(() => observer?.disconnect())

const contour = computed(() => {
  const w = Math.max(width.value, 82)
  const h = Math.max(height.value, 38)
  const mid = h / 2
  switch (props.shape) {
    case 'memo-v1':
      return `M 0 8 Q 0 0 8 0 H ${w - 15} L ${w - 1} 14 Q ${w} 15 ${w} 17
        V ${h - 9} Q ${w} ${h} ${w - 9} ${h} H 8 Q 0 ${h} 0 ${h - 8} Z`
    case 'lotus-v1':
      return `M 0 16 C 3 8 10 0 19 0 H ${w - 13} Q ${w - 4} 4 ${w} 2
        C ${w - 2} 6 ${w - 1} 12 ${w - 5} 18 L ${w - 10} ${h - 10}
        C ${w - 13} ${h - 2} ${w - 20} ${h} ${w - 31} ${h}
        C ${w * .55} ${h - 7} 33 ${h} 20 ${h - 3} C 5 ${h} 0 ${h - 9} 0 16 Z`
    case 'cat-v1':
      return `M 0 20 Q 0 15 4 11 L 8 2 Q 10 0 13 2 L 21 9 H 33
        L 41 2 Q 44 0 46 2 L 50 9 H ${w - 12}
        C ${w - 5} 9 ${w} 14 ${w} 21 V ${h - 11}
        Q ${w} ${h} ${w - 11} ${h} H 11 Q 0 ${h} 0 ${h - 11} Z`
    case 'fish-v1':
      return `M 0 ${mid} C 0 9 7 0 16 0 H ${w - 40}
        Q ${w - 26} 0 ${w - 20} ${mid - 9} L ${w - 4} ${mid - 16}
        Q ${w} ${mid - 17} ${w} ${mid - 12} L ${w - 6} ${mid} L ${w} ${mid + 12}
        Q ${w} ${mid + 17} ${w - 4} ${mid + 16} L ${w - 20} ${mid + 9}
        Q ${w - 26} ${h} ${w - 40} ${h} H 16 C 7 ${h} 0 ${h - 9} 0 ${mid} Z`
  }
})
const viewBox = computed(() => `0 0 ${Math.max(width.value, 82)} ${Math.max(height.value, 38)}`)
</script>

<template>
  <span class="managed-bubble-shape" aria-hidden="true">
    <svg ref="surface" class="managed-bubble-vector" :viewBox="viewBox" preserveAspectRatio="none" focusable="false">
      <defs>
        <linearGradient :id="paint" x1="0%" y1="0%" x2="20%" y2="100%">
          <stop offset="0%" class="managed-bubble-highlight" />
          <stop offset="100%" class="managed-bubble-fill" />
        </linearGradient>
        <pattern v-if="shape === 'memo-v1'" :id="`${paint}-lines`" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M0 15.5H16" class="managed-bubble-paper-line" />
        </pattern>
      </defs>
      <path :d="contour" :fill="`url(#${paint})`" class="managed-bubble-contour"
        vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
      <path v-if="shape === 'memo-v1'" :d="contour" :fill="`url(#${paint}-lines)`" />
    </svg>
  </span>
</template>
