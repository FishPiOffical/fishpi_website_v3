import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { fetchV3Preferences, type PreferenceValue } from '@/api/v3-preferences'
import { useAuthStore } from './auth'

type Values = Record<string, PreferenceValue>
export const useFunctionPreferencesStore = defineStore('functionPreferences', () => {
  const auth = useAuthStore()
  const values = ref<Values | null>(null)
  const identity = () => JSON.stringify([getAuthContextVersion(), !!auth.accessToken, auth.account?.oId || ''])
  let generation = 0
  let pending: Promise<Values> | null = null
  // 登录用户尚未读到偏好时先遮住图片，避免开启模糊后刷新仍短暂露出原图。
  const blurChatImages = computed(() => !!auth.accessToken && values.value?.chatImageBlur !== false)
  watch(identity, () => { generation++; pending = null; values.value = null }, { flush: 'sync' })

  function accept(value: Values) {
    generation++
    pending = null
    values.value = { ...value }
  }
  function load(force = false): Promise<Values> {
    if (!auth.accessToken) return Promise.reject(new Error('请先登录'))
    if (pending) return pending
    if (!force && values.value) return Promise.resolve(values.value)
    const reader = identity(), run = ++generation
    const request = fetchV3Preferences('functions').then(value => {
      if (reader !== identity() || run !== generation) throw new Error('偏好读取已失效')
      values.value = value
      return value
    }).finally(() => { if (run === generation) pending = null })
    pending = request
    return request
  }
  return { values, blurChatImages, load, accept }
})
