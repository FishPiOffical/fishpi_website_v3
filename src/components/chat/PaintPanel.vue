<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { uploadV3Files, uploadedMarkdown } from '@/api/v3-uploads'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ insert: (md: string) => boolean }>()
const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const color = ref('#222222')
const size = ref(3)
const busy = ref(false)
const err = ref('')
const draftError = ref(false)
const loggedIn = computed(() => !!auth.accessToken && !!auth.account?.oId)
const draftKey = computed(() => loggedIn.value ? `fp.chat.paint-draft.v1.${auth.account!.oId}` : '')
let upload: AbortController | null = null, disposed = false
function cancelUpload() { upload?.abort(); upload = null; busy.value = false }

type Stroke = { color: string; size: number; points: { x: number; y: number }[] }
const strokes = ref<Stroke[]>([])
let current: Stroke | null = null

function saveDraft() {
  const key = draftKey.value
  if (!key || typeof window === 'undefined') return
  try {
    if (strokes.value.length) window.sessionStorage.setItem(key, JSON.stringify(strokes.value))
    else window.sessionStorage.removeItem(key)
    draftError.value = false
  } catch {
    draftError.value = true
  }
}

function restoreDraft() {
  strokes.value = []
  draftError.value = false
  const key = draftKey.value
  if (!key || typeof window === 'undefined') return
  try {
    const saved: unknown = JSON.parse(window.sessionStorage.getItem(key) || '[]')
    if (Array.isArray(saved) && saved.every((stroke: Stroke | null) => stroke && /^#[0-9a-f]{6}$/i.test(stroke.color)
      && Number.isInteger(stroke.size) && stroke.size >= 1 && stroke.size <= 16
      && Array.isArray(stroke.points) && stroke.points.length > 0
      && stroke.points.every(point => point && Number.isFinite(point.x) && Number.isFinite(point.y)))) {
      strokes.value = saved
    }
  } catch { /* 缓存不可读时仍可创建新涂鸦。 */ }
}

function saveActiveStroke() {
  if (current) saveDraft()
}

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
  return { x: Math.round((e.clientX - r.left) * sx * 10) / 10, y: Math.round((e.clientY - r.top) * sy * 10) / 10 }
}

function onDown(e: PointerEvent) {
  const c = canvasRef.value
  if (!c || current || busy.value || !loggedIn.value) return
  c.setPointerCapture(e.pointerId)
  current = { color: color.value, size: size.value, points: [pos(e)] }
  strokes.value.push(current)
}

function onMove(e: PointerEvent) {
  if (!current || busy.value || !loggedIn.value) return
  const point = pos(e)
  const last = current.points.at(-1)
  if (last?.x === point.x && last.y === point.y) return
  current.points.push(point)
  redraw()
}

function onUp() {
  saveActiveStroke()
  current = null
}

function undo() {
  if (busy.value) return
  current = null
  strokes.value.pop()
  saveDraft()
  redraw()
}

function clearAll() {
  if (busy.value) return
  current = null
  strokes.value = []
  saveDraft()
  redraw()
}

function close() { cancelUpload(); onUp(); emit('close') }

async function submit() {
  const c = canvasRef.value
  if (!c || busy.value || !loggedIn.value || !strokes.value.length || disposed) return
  onUp()
  const abort = new AbortController(), context = getAuthContextVersion(), owner = auth.account!.oId
  upload = abort
  busy.value = true
  err.value = ''
  const currentUpload = () => !disposed && upload === abort && !abort.signal.aborted && loggedIn.value && owner === auth.account?.oId && context === getAuthContextVersion()
  try {
    // Export only the drawn area, with a small margin, instead of the entire white canvas.
    let left = c.width, top = c.height, right = 0, bottom = 0
    for (const stroke of strokes.value) for (const point of stroke.points) {
      const radius = stroke.size / 2 + 12
      left = Math.min(left, point.x - radius); top = Math.min(top, point.y - radius)
      right = Math.max(right, point.x + radius); bottom = Math.max(bottom, point.y + radius)
    }
    left = Math.max(0, Math.floor(left)); top = Math.max(0, Math.floor(top))
    right = Math.min(c.width, Math.ceil(right)); bottom = Math.min(c.height, Math.ceil(bottom))
    const cropped = document.createElement('canvas')
    cropped.width = Math.max(1, right - left)
    cropped.height = Math.max(1, bottom - top)
    const target = cropped.getContext('2d')
    if (!target) throw new Error('无法导出涂鸦，请重试')
    target.drawImage(c, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height)
    const blob = await new Promise<Blob | null>((resolve) => cropped.toBlob(resolve, 'image/png'))
    if (!currentUpload()) return
    if (!blob || blob.type !== 'image/png' || !blob.size) throw new Error('无法导出PNG画布，请重试')
    const file = new File([blob], `paint-${Date.now()}.png`, { type: 'image/png' })
    const results = await uploadV3Files([file], abort.signal)
    if (!currentUpload()) return
    const result = results[0]
    if (results.length !== 1 || !result?.url || !result.image) throw new Error('图片上传未返回地址，请保留画布后重试')
    const markdown = uploadedMarkdown({ ...result, name: '涂鸦' })
    if (!props.insert(markdown)) throw new Error('聊天输入框尚未就绪，涂鸦草稿已保留。')
    // Upload is complete before clearing; failure always preserves the drawing.
    busy.value = false
    clearAll()
    emit('close')
  } catch (e) {
    if (currentUpload()) err.value = e instanceof Error ? e.message : '上传失败'
  } finally {
    if (upload === abort) { upload = null; busy.value = false }
  }
}

watch(() => JSON.stringify([getAuthContextVersion(), !!auth.accessToken, auth.account?.oId || '']), () => {
  cancelUpload(); current = null; err.value = ''; restoreDraft(); redraw()
}, { flush: 'sync' })

onMounted(() => {
  restoreDraft()
  redraw()
  if (typeof window !== 'undefined') window.addEventListener('pagehide', saveActiveStroke)
})

onBeforeUnmount(() => {
  disposed = true
  cancelUpload()
  onUp()
  if (typeof window !== 'undefined') window.removeEventListener('pagehide', saveActiveStroke)
})
</script>

<template>
  <div class="paint">
    <div class="tools">
      <label>颜色 <input v-model="color" type="color" :disabled="busy" /></label>
      <label>粗细 <input v-model.number="size" type="range" min="1" max="16" :disabled="busy" /></label>
      <button type="button" class="ghost" :disabled="busy || !strokes.length" @click="undo">撤销</button>
      <button type="button" class="ghost" :disabled="busy || !strokes.length" @click="clearAll">清空</button>
      <button type="button" class="green" :disabled="busy || !loggedIn || !strokes.length" @click="submit">
        {{ busy ? '上传中…' : '插入涂鸦' }}
      </button>
      <button type="button" class="ghost" @click="close">关闭</button>
    </div>
    <canvas
      ref="canvasRef"
      width="500"
      height="320"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @lostpointercapture="onUp"
    />
    <p v-if="!loggedIn">登录后可上传涂鸦。</p>
    <p v-if="err" class="err" role="alert">{{ err }}</p>
    <p v-if="draftError" class="err" role="status">浏览器暂时无法保存草稿，请保留画板。</p>
  </div>
</template>

<style scoped lang="scss">
.paint {
  margin-top: 10px;
  padding: 8px 0;
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
