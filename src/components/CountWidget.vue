<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useCountStore } from '@/stores/count'
import FpDialog from '@/components/FpDialog.vue'

type View =
  | { kind: 'lunch'; time: string }
  | { kind: 'work'; time: string; earned: string | null }
  | { kind: 'done'; salary: string | null }

const count = useCountStore()
const { data, settingsOpen, loaded } = storeToRefs(count)

const view = ref<View | null>(null)
const toast = ref<{ type: 'success' | 'danger'; text: string } | null>(null)
const boxEl = ref<HTMLElement | null>(null)
const pos = reactive<{ left: number | null; top: number; right: number }>({ left: null, top: 70, right: 20 })

let timer: ReturnType<typeof setInterval> | undefined
let toastTimer: ReturnType<typeof setTimeout> | undefined
const firedAlarms = new Set<string>()

const enabled = computed(() => loaded.value && data.value.status !== 'disabled')

function todayAt(hhmm: string, base: Date) {
  const [h, m] = (hhmm.match(/\d{2}/g) || ['00', '00']).map(Number)
  const d = new Date(base)
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}

function fmt(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

function alarm(key: string, type: 'success' | 'danger', text: string) {
  const id = `${new Date().toDateString()}:${key}`
  if (firedAlarms.has(id)) return
  firedAlarms.add(id)
  toast.value = { type, text }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), 30000)
}

function tick() {
  const now = new Date()
  const d = data.value
  const salary = Number.parseFloat(d.salary) || 0
  const lunch = todayAt(d.lunch, now)
  const end = todayAt(d.time, now)
  const start = todayAt(d.startTime, now)
  const eatMs = lunch.getTime() - now.getTime()
  const leftMs = end.getTime() - now.getTime()

  if (eatMs >= 0 && eatMs < 3600_000) {
    if (Math.floor(eatMs / 1000) === 0) alarm('lunch', 'success', '中午咯，该吃饭啦～')
    view.value = { kind: 'lunch', time: fmt(eatMs) }
    return
  }
  if (leftMs >= 0) {
    const leftSec = Math.floor(leftMs / 1000)
    if (leftSec === 120) alarm('soon', 'danger', '马上就要下班啦，赶快收拾收拾吧～')
    if (leftSec === 0) {
      alarm('off', 'success', salary > 0 ? `下班啦！今天你赚了￥${d.salary}！` : '下班了！下班了！下班了！！！')
    }
    let earned: string | null = null
    if (salary > 0) {
      const workMs = end.getTime() - start.getTime()
      const passed = Math.min(Math.max(now.getTime() - start.getTime(), 0), Math.max(workMs, 0))
      earned = (workMs > 0 ? (salary * passed) / workMs : 0).toFixed(3)
    }
    view.value = { kind: 'work', time: fmt(leftMs), earned }
    return
  }
  view.value = { kind: 'done', salary: salary > 0 ? d.salary : null }
}

function start() {
  stop()
  if (!enabled.value) return
  tick()
  timer = setInterval(tick, 200)
}

function stop() {
  if (timer) clearInterval(timer)
  timer = undefined
}

function applySavedPosition() {
  const navBottom = Math.ceil(document.querySelector('.nav')?.getBoundingClientRect().bottom || 0)
  pos.top = Math.max(20, navBottom + 12)
  pos.right = 20
  pos.left = null
  const { left, top } = data.value
  if (
    Number.isFinite(left) &&
    Number.isFinite(top) &&
    (top as number) < document.documentElement.clientHeight &&
    (left as number) < document.documentElement.clientWidth
  ) {
    pos.left = left as number
    pos.top = top as number
  }
}

const boxStyle = computed(() =>
  pos.left == null
    ? { top: `${pos.top}px`, right: `${pos.right}px`, left: 'auto' }
    : { top: `${pos.top}px`, left: `${pos.left}px`, right: 'auto' },
)

let drag: { dx: number; dy: number; x: number; y: number; moved: boolean } | null = null

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 || !boxEl.value) return
  const rect = boxEl.value.getBoundingClientRect()
  drag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, x: e.clientX, y: e.clientY, moved: false }
  boxEl.value.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!drag || !boxEl.value) return
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 3) return
  drag.moved = true
  const w = boxEl.value.offsetWidth
  const h = boxEl.value.offsetHeight
  pos.left = Math.min(Math.max(e.clientX - drag.dx, 0), window.innerWidth - w)
  pos.top = Math.min(Math.max(e.clientY - drag.dy, 0), window.innerHeight - h)
}

function onPointerUp(e: PointerEvent) {
  if (!drag) return
  boxEl.value?.releasePointerCapture(e.pointerId)
  if (drag.moved && pos.left != null) {
    count.update({ left: pos.left, top: pos.top })
  } else {
    settingsOpen.value = true
  }
  drag = null
}

const form = reactive({ status: 'enabled', startTime: '09:00', time: '18:00', lunch: '11:30', salary: '365' })

function toInput(hhmm: string) {
  const [h, m] = hhmm.match(/\d{2}/g) || ['00', '00']
  return `${h}:${m}`
}

watch(settingsOpen, (open) => {
  if (!open) return
  const d = data.value
  form.status = d.status === 'disabled' ? 'disabled' : 'enabled'
  form.startTime = toInput(d.startTime)
  form.time = toInput(d.time)
  form.lunch = toInput(d.lunch)
  form.salary = d.salary
})

function saveSettings() {
  count.update({
    status: form.status === 'disabled' ? 'disabled' : 'enabled',
    startTime: form.startTime.replace(':', ''),
    time: form.time.replace(':', ''),
    lunch: form.lunch.replace(':', ''),
    salary: String(form.salary ?? '0').trim() || '0',
  })
  settingsOpen.value = false
}

watch(enabled, (on) => {
  if (on) {
    applySavedPosition()
    start()
  } else {
    stop()
  }
})

watch(
  () => [data.value.time, data.value.lunch, data.value.startTime, data.value.salary],
  () => {
    firedAlarms.clear()
    if (enabled.value) start()
  },
)

onMounted(() => {
  count.load()
  applySavedPosition()
  start()
})

onUnmounted(() => {
  stop()
  clearTimeout(toastTimer)
})
</script>

<template>
  <div
    v-if="enabled && view"
    ref="boxEl"
    class="count-box"
    :style="boxStyle"
    role="button"
    title="点击设置下班倒计时，拖动可移动位置"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="drag = null"
  >
    <template v-if="view.kind === 'lunch'">
      <div class="count-icons">🍲</div>
      <div class="count-time">{{ view.time }}</div>
    </template>
    <template v-else-if="view.kind === 'work'">
      <div class="count-icons">🧑‍💻💭</div>
      <div class="count-time">{{ view.time }}</div>
      <div v-if="view.earned" class="count-salary">💰 {{ view.earned }}</div>
    </template>
    <template v-else>
      <div class="count-icons">🎉</div>
      <div class="count-time">{{ view.salary ? '今日收入' : '下班时间到' }}</div>
      <div v-if="view.salary" class="count-salary">￥{{ view.salary }}</div>
    </template>
  </div>

  <Teleport v-if="toast" to="body">
    <div class="count-toast" :class="toast.type" role="status" @click="toast = null">{{ toast.text }}</div>
  </Teleport>

  <FpDialog v-model:open="settingsOpen" title="⏰ 下班倒计时设置" :width="400">
    <form id="count-settings-form" @submit.prevent="saveSettings">
      <label class="fp-field">
        <span>状态</span>
        <select v-model="form.status" class="fp-input">
          <option value="enabled">开启</option>
          <option value="disabled">关闭</option>
        </select>
      </label>
      <div class="row">
        <label class="fp-field">
          <span>上班时间（用于计算日薪）</span>
          <input v-model="form.startTime" class="fp-input" type="time" required />
        </label>
        <label class="fp-field">
          <span>下班时间</span>
          <input v-model="form.time" class="fp-input" type="time" required />
        </label>
      </div>
      <label class="fp-field">
        <span>午饭时间</span>
        <input v-model="form.lunch" class="fp-input" type="time" required />
      </label>
      <label class="fp-field last">
        <span>你的日薪（设置为 0 则不显示）</span>
        <input v-model="form.salary" class="fp-input" type="number" min="0" step="0.01" />
      </label>
    </form>
    <template #footer>
      <button type="button" class="fp-btn" @click="settingsOpen = false">取消</button>
      <button type="submit" form="count-settings-form" class="fp-btn fp-btn--primary">保存</button>
    </template>
  </FpDialog>
</template>

<style scoped>
.count-box {
  position: fixed;
  z-index: 31;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 110px;
  height: 80px;
  box-sizing: border-box;
  background: var(--fp-income-bg);
  box-shadow: var(--fp-income-shadow);
  border: 1px solid var(--fp-border);
  border-radius: 16px;
  backdrop-filter: blur(8px);
  color: var(--fp-text);
  cursor: grab;
  user-select: none;
  touch-action: none;
  transition:
    box-shadow 0.3s,
    transform 0.2s;
}
.count-box:hover {
  transform: translateY(-2px) scale(1.04);
}
.count-box:active {
  cursor: grabbing;
}
@media (max-width: 1400px) {
  .count-box {
    display: none;
  }
}
.count-icons {
  font-size: 13px;
  line-height: 1;
  letter-spacing: 2px;
}
.count-time {
  margin-top: 3px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--fp-title);
}
.count-salary {
  margin-top: 5px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--fp-income);
}
.count-toast {
  position: fixed;
  top: 72px;
  left: 50%;
  z-index: 1400;
  transform: translateX(-50%);
  max-width: min(480px, calc(100vw - 32px));
  padding: 10px 16px;
  border: 1px solid var(--fp-border);
  border-left: 3px solid var(--fp-primary);
  border-radius: 10px;
  background: var(--fp-card);
  color: var(--fp-text);
  font-size: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  cursor: pointer;
}
.count-toast.danger {
  border-left-color: var(--fp-accent);
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.fp-field.last {
  margin-bottom: 0;
}
</style>
