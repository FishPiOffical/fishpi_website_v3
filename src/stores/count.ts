import { ref } from 'vue'
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

export const useCountStore = defineStore('count', () => {
  const data = ref<CountData>(normalize(null))
  const settingsOpen = ref(false)
  const loaded = ref(false)

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

  return { data, settingsOpen, loaded, load, save, update }
})
