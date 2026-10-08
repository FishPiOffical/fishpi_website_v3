import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError } from '@/api/http'
import { fetchAccount, fetchMembership, login as loginApi, type AccountInfo } from '@/api/fishpi'

const KEY = 'fp.apiKey'

function readStoredKey() {
  if (import.meta.env.SSR || typeof localStorage === 'undefined') return null
  return localStorage.getItem(KEY)
}

function persistKey(key: string | null) {
  if (import.meta.env.SSR || typeof localStorage === 'undefined') return
  if (key) localStorage.setItem(KEY, key)
  else localStorage.removeItem(KEY)
}

function isInvalidKeyError(e: unknown) {
  if (e instanceof ApiError) {
    if (e.status === 401) return true
    const msg = e.message || ''
    return /api\s*key|密钥|未登录|登录|auth/i.test(msg)
  }
  if (e instanceof Error) {
    return /api\s*key|密钥|Invalid|未登录/i.test(e.message)
  }
  return false
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
    } catch (e) {
      // Keep cached apiKey on transient/network failures; only clear when key is rejected.
      if (isInvalidKeyError(e)) logout()
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

  async function applyApiKey(key: string) {
    apiKey.value = key
    persistKey(key)
    account.value = await fetchAccount(key)
    await refreshMembership()
  }

  /** Password login → getKey once, then persist apiKey for subsequent sessions. */
  async function login(username: string, passwd: string, mfaCode = '') {
    loading.value = true
    error.value = ''
    try {
      const key = await loginApi(username, passwd, mfaCode)
      await applyApiKey(key)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '登录失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Reuse an existing apiKey (no /api/getKey). */
  async function loginWithApiKey(key: string) {
    loading.value = true
    error.value = ''
    try {
      await applyApiKey(key.trim())
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'apiKey 无效'
      throw e
    } finally {
      loading.value = false
    }
  }

  function logout() {
    apiKey.value = null
    account.value = null
    isVip.value = false
    persistKey(null)
    void import('@/api/pageAuth').then((m) => m.clearPageAuthCache()).catch(() => {})
  }

  async function reloadAccount() {
    if (!apiKey.value) return
    account.value = await fetchAccount(apiKey.value)
  }

  return {
    apiKey,
    account,
    isVip,
    loading,
    error,
    isLoggedIn,
    restore,
    login,
    loginWithApiKey,
    logout,
    refreshMembership,
    reloadAccount,
  }
})
