<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { uploadFiles } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits<{ insert: [md: string]; close: [] }>()

const auth = useAuthStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const color = ref('#222222')
const size = ref(3)
const busy = ref(false)
const err = ref('')

type Stroke = { color: string; size: number; points: { x: number; y: number }[] }
const strokes = ref<Stroke[]>([])
let drawing = false
let current: Stroke | null = null

function ctx() {
  return canvasRef.value?.getContext('2d') || null
}

function redraw() {
  const c = canvasRef.value
  const g = ctx()
  if (!c || !g) return
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, c.width, c.height)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (const s of strokes.value) {
    if (s.points.length < 2) continue
    g.strokeStyle = s.color
    g.lineWidth = s.size
    g.beginPath()
    g.moveTo(s.points[0].x, s.points[0].y)
    for (let i = 1; i < s.points.length; i++) g.lineTo(s.points[i].x, s.points[i].y)
    g.stroke()
  }
}

function pos(e: PointerEvent) {
  const c = canvasRef.value!
  const r = c.getBoundingClientRect()
  const sx = c.width / r.width
  const sy = c.height / r.height
  return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy }
}

function onDown(e: PointerEvent) {
  const c = canvasRef.value
  if (!c) return
  c.setPointerCapture(e.pointerId)
  drawing = true
  current = { color: color.value, size: size.value, points: [pos(e)] }
  strokes.value.push(current)
}

function onMove(e: PointerEvent) {
  if (!drawing || !current) return
  current.points.push(pos(e))
  redraw()
}

function onUp() {
  drawing = false
  current = null
}

function undo() {
  strokes.value.pop()
  redraw()
}

function clearAll() {
  strokes.value = []
  redraw()
}

async function submit() {
  const c = canvasRef.value
  if (!c || !auth.apiKey || !strokes.value.length) return
  busy.value = true
  err.value = ''
  try {
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('无法导出画布')
    const file = new File([blob], `paint-${Date.now()}.png`, { type: 'image/png' })
    const urls = await uploadFiles(auth.apiKey, [file])
    const url = urls[0]
    if (!url) throw new Error('上传未返回地址')
    emit('insert', `![涂鸦](${url})`)
    clearAll()
    emit('close')
  } catch (e) {
    err.value = e instanceof Error ? e.message : '上传失败'
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  const c = canvasRef.value
  if (!c) return
  const g = c.getContext('2d')
  if (g) {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, c.width, c.height)
  }
})

onUnmounted(() => {
  drawing = false
})
</script>

<template>
  <div class="paint">
    <div class="tools">
      <label>颜色 <input v-model="color" type="color" /></label>
      <label>粗细 <input v-model.number="size" type="range" min="1" max="16" /></label>
      <button type="button" class="ghost" :disabled="!strokes.length" @click="undo">撤销</button>
      <button type="button" class="ghost" :disabled="!strokes.length" @click="clearAll">清空</button>
      <button type="button" class="green" :disabled="busy || !strokes.length" @click="submit">
        {{ busy ? '上传中…' : '插入涂鸦' }}
      </button>
      <button type="button" class="ghost" @click="emit('close')">关闭</button>
    </div>
    <canvas
      ref="canvasRef"
      width="500"
      height="320"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    />
    <p v-if="err" class="err">{{ err }}</p>
  </div>
</template>

<style scoped>
.paint {
  margin-top: 10px;
  padding: 10px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-bg);
}
.tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--fp-muted);
}
.tools label {
  display: flex;
  align-items: center;
  gap: 4px;
}
canvas {
  display: block;
  width: 100%;
  max-width: 500px;
  height: auto;
  touch-action: none;
  border: 1px solid var(--fp-border);
  border-radius: 6px;
  background: #fff;
  cursor: crosshair;
}
.ghost,
.green {
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
.ghost {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-text);
}
.green {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
}
.err {
  margin: 6px 0 0;
  color: #e07a5f;
  font-size: 12px;
}
</style>
