import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

/** 与现网 js/count.js 共用 localStorage 键与字段，同域下设置互通。 */
export interface CountData {
  /** 下班时间 HHmm */
  time: string
  /** 午饭时间 HHmm */
  lunch: string
  /** 日薪，0 表示不显示 */
  salary: string
  /** 上班时间 HHmm */
  startTime: string
  status?: 'enabled' | 'disabled'
  left?: number
  top?: number
}

export type CountView =
  | { kind: 'lunch'; time: string }
  | { kind: 'work'; time: string; earned: string | null }
  | { kind: 'done'; salary: string | null }

export interface CountToast {
  type: 'success' | 'danger'
  text: string
}

const STORAGE_KEY = 'count'

function normalize(raw: Partial<CountData> | null | undefined): CountData {
  const d = raw || {}
  const salary = String(d.salary ?? '365')
  return {
    time: d.time || '1800',
    lunch: d.lunch || '1130',
    salary: /^\d+(\.\d+)?$/.test(salary) ? salary : '365',
    startTime: d.startTime || '0900',
    status: d.status === 'disabled' ? 'disabled' : 'enabled',
    left: Number.isFinite(d.left) ? d.left : undefined,
    top: Number.isFinite(d.top) ? d.top : undefined,
  }
}

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

export const useCountStore = defineStore('count', () => {
  const data = ref<CountData>(normalize(null))
  const loaded = ref(false)
  const view = ref<CountView | null>(null)
  const toast = ref<CountToast | null>(null)

  const enabled = computed(() => loaded.value && data.value.status !== 'disabled')

  let timer: ReturnType<typeof setInterval> | undefined
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  const firedAlarms = new Set<string>()

  function load() {
    if (typeof localStorage === 'undefined') return
    try {
      data.value = normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'))
    } catch {
      data.value = normalize(null)
    }
    loaded.value = true
    save()
  }

  function save() {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.value))
  }

  function update(patch: Partial<CountData>) {
    data.value = normalize({ ...data.value, ...patch })
    save()
  }

  function alarm(key: string, type: CountToast['type'], text: string) {
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

  function stop() {
    if (timer) clearInterval(timer)
    timer = undefined
  }

  /** 客户端全局只调用一次；倒计时与下班提醒不依赖模块是否渲染。 */
  function start() {
    stop()
    if (!enabled.value) {
      view.value = null
      return
    }
    tick()
    timer = setInterval(tick, 200)
  }

  watch(
    () => [enabled.value, data.value.time, data.value.lunch, data.value.startTime, data.value.salary],
    () => {
      if (!loaded.value) return
      firedAlarms.clear()
      start()
    },
  )

  function dismissToast() {
    toast.value = null
    clearTimeout(toastTimer)
  }

  return { data, loaded, enabled, view, toast, load, save, update, start, stop, dismissToast }
})
