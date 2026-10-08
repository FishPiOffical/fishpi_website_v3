import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchAccount, fetchMembership, login as loginApi, type AccountInfo } from '@/api/fishpi'

const KEY = 'fp.apiKey'

function readStoredKey() {
  if (import.meta.env.SSR || typeof localStorage === 'undefined') return null
  return localStorage.getItem(KEY)
}

export const useAuthStore = defineStore('auth', () => {
  const apiKey = ref<string | null>(readStoredKey())
  const account = ref<AccountInfo | null>(null)
  const isVip = ref(false)
  const loading = ref(false)
  const error = ref('')

  const isLoggedIn = computed(() => Boolean(apiKey.value && account.value))

  async function restore() {
    if (import.meta.env.SSR || !apiKey.value) return
    try {
      account.value = await fetchAccount(apiKey.value)
      await refreshMembership()
    } catch {
      logout()
    }
  }

  async function refreshMembership() {
    if (!account.value?.oId) {
      isVip.value = false
      return
    }
    try {
      const m = await fetchMembership(account.value.oId)
      isVip.value = m.isVip
    } catch {
      isVip.value = false
    }
  }

  async function login(username: string, passwd: string, mfaCode = '') {
    loading.value = true
    error.value = ''
    try {
      const key = await loginApi(username, passwd, mfaCode)
      apiKey.value = key
      if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, key)
      account.value = await fetchAccount(key)
      await refreshMembership()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '登录失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  function logout() {
    apiKey.value = null
    account.value = null
    isVip.value = false
    if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY)
    void import('@/api/pageAuth').then((m) => m.clearPageAuthCache()).catch(() => {})
  }

  async function reloadAccount() {
    if (!apiKey.value) return
    account.value = await fetchAccount(apiKey.value)
  }

  return { apiKey, account, isVip, loading, error, isLoggedIn, restore, login, logout, refreshMembership, reloadAccount }
})
