<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, watch } from 'vue'

const src = defineModel<string>({ default: '' })

const MIN = 0.5
const MAX = 5
const STEP = 0.25

const scale = ref(1)
const x = ref(0)
const y = ref(0)
const dragging = ref(false)
const stage = ref<HTMLElement | null>(null)

const drag = reactive({ ox: 0, oy: 0, sx: 0, sy: 0 })

function resetView() {
  scale.value = 1
  x.value = 0
  y.value = 0
  dragging.value = false
}

function clamp(n: number) {
  return Math.min(MAX, Math.max(MIN, Math.round(n / STEP) * STEP))
}

function zoomBy(delta: number, cx?: number, cy?: number) {
  const prev = scale.value
  const next = clamp(prev + delta)
  if (next === prev) return
  if (cx != null && cy != null && stage.value) {
    const rect = stage.value.getBoundingClientRect()
    const px = cx - rect.left - rect.width / 2
    const py = cy - rect.top - rect.height / 2
    // 以指针为中心缩放
    x.value = px - ((px - x.value) * next) / prev
    y.value = py - ((py - y.value) * next) / prev
  }
  scale.value = next
  if (next <= 1) {
    x.value = 0
    y.value = 0
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    src.value = ''
    return
  }
  if (e.key === '+' || e.key === '=') {
    e.preventDefault()
    zoomBy(STEP)
  } else if (e.key === '-' || e.key === '_') {
    e.preventDefault()
    zoomBy(-STEP)
  } else if (e.key === '0') {
    e.preventDefault()
    resetView()
  }
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  zoomBy(e.deltaY < 0 ? STEP : -STEP, e.clientX, e.clientY)
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  if (scale.value <= 1) return
  dragging.value = true
  drag.ox = e.clientX
  drag.oy = e.clientY
  drag.sx = x.value
  drag.sy = y.value
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  x.value = drag.sx + (e.clientX - drag.ox)
  y.value = drag.sy + (e.clientY - drag.oy)
}

function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch {
    /* already released */
  }
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) src.value = ''
}

function onStageClick() {
  if (scale.value <= 1) src.value = ''
}

function onDblClick(e: MouseEvent) {
  if (scale.value > 1) resetView()
  else zoomBy(1, e.clientX, e.clientY)
}

watch(src, (v) => {
  resetView()
  if (v) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport v-if="src" to="body">
    <div class="img-zoom" @click="onBackdropClick" @wheel.prevent="onWheel">
      <div
        ref="stage"
        class="stage"
        :class="{ dragging, zoomed: scale > 1 }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @dblclick.stop="onDblClick"
        @click.stop="onStageClick"
      >
        <img
          :src="src"
          alt=""
          draggable="false"
          :style="{ transform: `translate(${x}px, ${y}px) scale(${scale})` }"
        />
      </div>

      <div class="toolbar" @click.stop>
        <button type="button" class="tool" title="缩小 (−)" :disabled="scale <= MIN" @click="zoomBy(-STEP)">−</button>
        <button type="button" class="tool pct" title="双击图片或按 0 重置" @click="resetView">
          {{ Math.round(scale * 100) }}%
        </button>
        <button type="button" class="tool" title="放大 (+)" :disabled="scale >= MAX" @click="zoomBy(STEP)">+</button>
        <a :href="src" target="_blank" rel="noopener" class="tool link">原图</a>
        <button type="button" class="tool close" title="关闭 (Esc)" @click="src = ''">×</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.img-zoom {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.82);
  cursor: zoom-out;
  user-select: none;
  touch-action: none;
}
.stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: zoom-in;
}
.stage.zoomed {
  cursor: grab;
}
.stage.dragging {
  cursor: grabbing;
}
.stage img {
  max-width: min(100vw - 48px, 100%);
  max-height: min(100vh - 48px, 100%);
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
  transform-origin: center center;
  transition: transform 0.08s ease-out;
  pointer-events: none;
}
.stage.dragging img {
  transition: none;
}

.toolbar {
  position: absolute;
  left: 50%;
  bottom: 20px;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  transform: translateX(-50%);
  cursor: default;
}
.tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #fff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  text-decoration: none;
}
.tool:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.14);
}
.tool:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.tool.pct {
  min-width: 56px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.tool.link {
  font-size: 13px;
}
.tool.close {
  font-size: 22px;
}
</style>
