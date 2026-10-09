<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { drawFishForm } from './fishArt'
import type { FishKind } from './fishKinds'

const props = withDefaults(
  defineProps<{
    kind: FishKind
    unlocked?: boolean
    size?: number
  }>(),
  { unlocked: true, size: 48 },
)

const canvasRef = ref<HTMLCanvasElement | null>(null)

function paint() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const s = props.size
  canvas.width = Math.round(s * dpr)
  canvas.height = Math.round(s * dpr)
  canvas.style.width = `${s}px`
  canvas.style.height = `${s}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, s, s)
  ctx.save()
  ctx.translate(s / 2, s / 2)
  drawFishForm(ctx, props.kind, {
    scale: s / 52,
    face: 1,
    t: 0.4,
    phase: props.kind.id.length * 0.7,
    locked: !props.unlocked,
  })
  ctx.restore()
}

onMounted(paint)
watch(() => [props.kind.id, props.unlocked, props.size], paint)
</script>

<template>
  <canvas ref="canvasRef" class="fish-icon" aria-hidden="true" />
</template>

<style scoped>
.fish-icon {
  display: block;
}
</style>
